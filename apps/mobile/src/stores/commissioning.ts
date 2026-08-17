import { defineStore } from 'pinia'
import {
  canRetry,
  encodeBase64Url,
  retryTarget,
  transition,
  type CommissioningFailureState,
  type CommissioningState,
  type EncryptedCommissioningGrant,
} from '@rhophi/client-sdk'
import { commissioningApi } from '../services/api'
import {
  commissioningService,
  mockCommissioningEnabled,
  nativeCommissioningEnabled,
  type DiscoveredDevice,
} from '../services/commissioning'
import { commissioningTransactionStore } from '../services/commissioning/transactionStore'

interface RuntimeTransaction {
  transactionId: string
  expiresAt: string
  keyId: string
  temporaryNodeId?: string
  bbbNodeId?: string
}

export const useCommissioningStore = defineStore('commissioning', {
  state: () => ({
    state: 'CREATED' as CommissioningState,
    devices: [] as DiscoveredDevice[],
    selected: undefined as DiscoveredDevice | undefined,
    transaction: undefined as RuntimeTransaction | undefined,
    error: '',
    failureAt: '' as CommissioningFailureState | '',
    mock: mockCommissioningEnabled,
    native: nativeCommissioningEnabled,
    running: false,
  }),
  getters: {
    retryable: state => state.state === 'CLEANUP_PENDING' || canRetry(state.state),
    available: state => state.mock || state.native,
  },
  actions: {
    reset() {
      this.state = 'CREATED'
      this.devices = []
      this.selected = undefined
      this.transaction = undefined
      this.error = ''
      this.running = false
      commissioningTransactionStore.clear()
    },
    async scan() {
      this.running = true
      this.error = ''
      try {
        this.state = transition(this.state, 'BLE_SCANNING')
        this.devices = (await commissioningService.scanDevices({ timeoutMs: 10_000 })).devices
      } catch (error) {
        this.fail('BLE_TIMEOUT', error)
      } finally { this.running = false }
    },
    async select(device: DiscoveredDevice) {
      this.selected = device
      this.state = transition(this.state, 'DEVICE_SELECTED')
      this.running = true
      try {
        this.state = transition(this.state, 'IDENTIFYING')
        await commissioningService.identifyDevice({ address: device.address })
        this.inject('INVALID_DEVICE')
        this.state = transition(this.state, 'CLAIM_CHALLENGE')
      } catch (error) {
        if (this.state !== 'INVALID_DEVICE') this.fail('INVALID_DEVICE', error)
      } finally { this.running = false }
    },
    async commission() {
      if (!this.selected) return
      this.running = true
      this.error = ''
      try {
        const key = await commissioningService.createEphemeralKey({ transactionHint: crypto.randomUUID() })
        const created = this.mock
          ? {
              transaction_id: '11111111-1111-4111-8111-111111111111',
              challenge: encodeBase64Url(new Uint8Array(32).fill(0x31)),
              expires_at: new Date(Date.now() + 600_000).toISOString(),
              state: 'CLAIM_CHALLENGE' as const,
            }
          : await commissioningApi.createSession({
              claim_id: this.selected.claimId,
              product_id: this.selected.productId,
              mobile_ephemeral_public_key: key.publicKey,
            })
        this.transaction = {
          transactionId: created.transaction_id,
          expiresAt: created.expires_at,
          keyId: key.keyId,
        }
        this.persist()

        const claim = await commissioningService.claimDevice({
          address: this.selected.address,
          challenge: created.challenge,
        })
        if (claim.claimId !== this.selected.claimId || claim.productId !== this.selected.productId) {
          throw new Error('Claim identity changed during provisioning')
        }
        this.inject('CLAIM_FAILED')
        await this.advance('CLAIM_VERIFIED')
        const proofResponse = this.mock
          ? { state: 'GRANT_ISSUED' as const, transaction_id: created.transaction_id, grant: mockGrant(created.transaction_id, created.expires_at) }
          : await commissioningApi.submitClaim(created.transaction_id, {
              device_nonce: claim.deviceNonce,
              proof: claim.proof,
              ble_address_hint: this.selected.address,
            })
        await this.advance('GRANT_ISSUED')
        await this.advance('BLE_CONNECTING')
        const node = await commissioningService.commissionBle({
          address: this.selected.address,
          keyId: key.keyId,
          grant: proofResponse.grant,
        })
        this.inject('PASE_FAILED')
        await this.advance('PASE_ESTABLISHED')
        this.inject('ATTESTATION_FAILED')
        await this.advance('ATTESTATION_VERIFIED')
        await this.advance('THREAD_PROVISIONING')
        this.inject('THREAD_ATTACH_FAILED')
        await this.advance('THREAD_ATTACHING')
        if (!this.mock) await commissioningApi.threadAttached(created.transaction_id, node.temporaryNodeId)
        this.transaction.temporaryNodeId = node.temporaryNodeId
        await this.advance('TEMP_FABRIC_COMMISSIONED')
        this.persist()

        const window = await commissioningService.openCommissioningWindow({
          temporaryNodeId: node.temporaryNodeId,
          timeoutSeconds: 900,
        })
        await this.advance('WINDOW_OPEN')
        this.inject('BBB_COMMISSION_FAILED')
        await this.advance('BBB_FABRIC_COMMISSIONING')
        const handoff = this.mock
          ? { session: { bbb_node_id: '0x0000000000000100' } }
          : await commissioningApi.handoffWindow(created.transaction_id, {
              temporary_node_id: node.temporaryNodeId,
              discriminator: window.discriminator,
              setup_passcode: window.setupPasscode,
              timeout_seconds: 900,
            })
        await this.advance('ENDPOINT_DISCOVERY')
        this.inject('SUBSCRIPTION_FAILED')
        await this.advance('SUBSCRIBING')
        await this.advance('TEMP_FABRIC_REMOVING')
        const bbbNodeId = handoff.session.bbb_node_id
        if (!bbbNodeId) throw new Error('BBB did not return a permanent node ID')
        this.transaction.bbbNodeId = bbbNodeId
        this.persist()
        await this.removeTemporaryFabric()
      } catch (error) {
        if (!this.error && this.state !== 'CLEANUP_PENDING') this.fail(this.failureForState(), error)
      } finally { this.running = false }
    },
    async removeTemporaryFabric() {
      if (!this.transaction?.temporaryNodeId || !this.transaction.bbbNodeId) throw new Error('Cleanup context unavailable')
      try {
        await commissioningService.removeTemporaryFabric({ temporaryNodeId: this.transaction.temporaryNodeId })
        this.inject('TEMP_FABRIC_REMOVE_FAILED')
        if (!this.mock) await commissioningApi.complete(this.transaction.transactionId, this.transaction.bbbNodeId, true)
        await this.advance('COMPLETE')
        commissioningTransactionStore.clear()
      } catch (error) {
        if (!this.mock) {
          await commissioningApi.complete(this.transaction.transactionId, this.transaction.bbbNodeId, false).catch(() => undefined)
        }
        this.state = 'CLEANUP_PENDING'
        this.error = error instanceof Error ? error.message : 'Temporary fabric cleanup pending'
        this.persist()
      }
    },
    async resume() {
      const snapshot = commissioningTransactionStore.load()
      if (!snapshot || new Date(snapshot.expiresAt).getTime() <= Date.now()) {
        commissioningTransactionStore.clear()
        return
      }
      this.transaction = {
        transactionId: snapshot.transactionId,
        expiresAt: snapshot.expiresAt,
        keyId: snapshot.keyId,
        ...(snapshot.temporaryNodeId ? { temporaryNodeId: snapshot.temporaryNodeId } : {}),
        ...(snapshot.bbbNodeId ? { bbbNodeId: snapshot.bbbNodeId } : {}),
      }
      this.selected = {
        address: snapshot.address,
        claimId: snapshot.claimId,
        productId: snapshot.productId,
        productName: snapshot.productId === 1 ? 'Rhophi Plug' : `Rhophi product ${snapshot.productId}`,
        serialSuffix: snapshot.claimId.slice(-4),
        rssi: 0,
      }
      if (!this.mock) {
        const session = await commissioningApi.getSession(snapshot.transactionId)
        this.state = session.state as CommissioningState
      } else {
        this.state = snapshot.state
      }
    },
    async cancel() {
      try {
        if (this.transaction) {
          await commissioningService.cancel({ transactionId: this.transaction.keyId })
          if (!this.mock) await commissioningApi.cancel(this.transaction.transactionId).catch(() => undefined)
        }
      } finally {
        if (this.state !== 'COMPLETE' && this.state !== 'CANCELLED') this.state = transition(this.state, 'CANCELLED')
        this.running = false
        commissioningTransactionStore.clear()
      }
    },
    async retry() {
      if (this.state === 'CLEANUP_PENDING') {
        this.state = 'TEMP_FABRIC_REMOVING'
        await this.removeTemporaryFabric()
        return
      }
      if (['BBB_COMMISSION_FAILED', 'NODE_NOT_DISCOVERED', 'SUBSCRIPTION_FAILED'].includes(this.state)) {
        await this.retryGatewayHandoff()
        return
      }
      if (!retryTarget(this.state)) return
      await this.cancel()
      this.reset()
      await this.scan()
    },
    async retryGatewayHandoff() {
      if (!this.transaction?.temporaryNodeId) throw new Error('Temporary fabric context unavailable')
      this.running = true
      this.error = ''
      try {
        const window = await commissioningService.openCommissioningWindow({
          temporaryNodeId: this.transaction.temporaryNodeId,
          timeoutSeconds: 900,
        })
        this.state = transition(this.state, 'WINDOW_OPEN')
        this.state = transition(this.state, 'BBB_FABRIC_COMMISSIONING')
        const handoff = await commissioningApi.handoffWindow(this.transaction.transactionId, {
          temporary_node_id: this.transaction.temporaryNodeId,
          discriminator: window.discriminator,
          setup_passcode: window.setupPasscode,
          timeout_seconds: 900,
        })
        this.state = transition(this.state, 'ENDPOINT_DISCOVERY')
        this.state = transition(this.state, 'SUBSCRIBING')
        this.state = transition(this.state, 'TEMP_FABRIC_REMOVING')
        const bbbNodeId = handoff.session.bbb_node_id
        if (!bbbNodeId) throw new Error('BBB did not return a permanent node ID')
        this.transaction.bbbNodeId = bbbNodeId
        this.persist()
        await this.removeTemporaryFabric()
      } catch (error) {
        if (this.state !== 'CLEANUP_PENDING') this.fail(this.failureForState(), error)
      } finally {
        this.running = false
      }
    },
    async advance(next: CommissioningState) {
      if (this.mock) await new Promise(resolve => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 140))
      this.state = transition(this.state, next)
      this.persist()
    },
    inject(failure: CommissioningFailureState) {
      if (this.mock && this.failureAt === failure) {
        this.state = transition(this.state, failure)
        this.error = `Injected development failure: ${failure}`
        throw new Error(this.error)
      }
    },
    fail(failure: CommissioningFailureState, error: unknown) {
      if (this.state !== failure) this.state = transition(this.state, failure)
      this.error = error instanceof Error ? error.message : failure
      this.persist()
    },
    persist() {
      if (!this.transaction || !this.selected) return
      commissioningTransactionStore.save({
        state: this.state,
        transactionId: this.transaction.transactionId,
        expiresAt: this.transaction.expiresAt,
        keyId: this.transaction.keyId,
        address: this.selected.address,
        claimId: this.selected.claimId,
        productId: this.selected.productId,
        ...(this.transaction.temporaryNodeId ? { temporaryNodeId: this.transaction.temporaryNodeId } : {}),
        ...(this.transaction.bbbNodeId ? { bbbNodeId: this.transaction.bbbNodeId } : {}),
      })
    },
    failureForState(): CommissioningFailureState {
      if (this.state === 'CLAIM_CHALLENGE' || this.state === 'CLAIM_VERIFIED') return 'CLAIM_FAILED'
      if (this.state === 'GRANT_ISSUED' || this.state === 'BLE_CONNECTING') return 'PASE_FAILED'
      if (this.state === 'PASE_ESTABLISHED') return 'ATTESTATION_FAILED'
      if (this.state === 'THREAD_PROVISIONING' || this.state === 'THREAD_ATTACHING') return 'THREAD_ATTACH_FAILED'
      if (this.state === 'ENDPOINT_DISCOVERY') return 'NODE_NOT_DISCOVERED'
      if (this.state === 'SUBSCRIBING') return 'SUBSCRIPTION_FAILED'
      if (this.state === 'TEMP_FABRIC_REMOVING') return 'TEMP_FABRIC_REMOVE_FAILED'
      return 'BBB_COMMISSION_FAILED'
    },
  },
})

function mockGrant(transactionId: string, expiresAt: string): EncryptedCommissioningGrant {
  return {
    version: 1,
    algorithm: 'X25519-HKDF-SHA256-AES-256-GCM',
    server_ephemeral_public_key: 'bW9jay1zZXJ2ZXIta2V5',
    nonce: 'bW9jay1ub25jZQ',
    ciphertext: 'bW9jay1jaXBoZXJ0ZXh0',
    authentication_tag: 'bW9jay10YWc',
    transaction_id: transactionId,
    expires_at: expiresAt,
  }
}
