import { defineStore } from 'pinia'
import {
  canRetry,
  retryTarget,
  transition,
  type CommissioningFailureState,
  type CommissioningState,
} from '@rhophi/client-sdk'
import { commissioningService, mockCommissioningEnabled, type DiscoveredDevice } from '../services/commissioning'

const transactionId = 'mock-transaction'
const challenge = 'mock-challenge'

export const useCommissioningStore = defineStore('commissioning', {
  state: () => ({
    state: 'CREATED' as CommissioningState,
    devices: [] as DiscoveredDevice[],
    selected: undefined as DiscoveredDevice | undefined,
    error: '',
    failureAt: '' as CommissioningFailureState | '',
    mock: mockCommissioningEnabled,
    running: false,
  }),
  getters: {
    retryable: state => canRetry(state.state),
  },
  actions: {
    reset() {
      this.state = 'CREATED'
      this.devices = []
      this.selected = undefined
      this.error = ''
      this.running = false
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
        await commissioningService.identifyDevice({ claimId: device.claimId })
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
        const claim = await commissioningService.claimDevice({ transactionId, claimId: this.selected.claimId, challenge })
        if (!claim.verified) throw new Error('Device verification failed')
        this.inject('CLAIM_FAILED')
        await this.advance('CLAIM_VERIFIED')
        await this.advance('BLE_CONNECTING')
        const node = await commissioningService.commissionBle({ transactionId, encryptedCommissioningPayload: 'mock-opaque', gatewayEphemeralPublicKey: 'mock-opaque' })
        this.inject('PASE_FAILED')
        await this.advance('PASE_ESTABLISHED')
        this.inject('ATTESTATION_FAILED')
        await this.advance('ATTESTATION_VERIFIED')
        await this.advance('THREAD_PROVISIONING')
        this.inject('THREAD_ATTACH_FAILED')
        await this.advance('THREAD_ATTACHING')
        await this.advance('TEMP_FABRIC_COMMISSIONED')
        await commissioningService.openCommissioningWindow({ temporaryNodeId: node.temporaryNodeId })
        await this.advance('WINDOW_OPEN')
        this.inject('BBB_COMMISSION_FAILED')
        await this.advance('BBB_FABRIC_COMMISSIONING')
        await this.advance('ENDPOINT_DISCOVERY')
        this.inject('SUBSCRIPTION_FAILED')
        await this.advance('SUBSCRIBING')
        await this.advance('TEMP_FABRIC_REMOVING')
        await commissioningService.removeTemporaryFabric({ temporaryNodeId: node.temporaryNodeId })
        this.inject('TEMP_FABRIC_REMOVE_FAILED')
        await this.advance('COMPLETE')
      } catch (error) {
        if (!this.error) this.fail(this.failureForState(), error)
      } finally { this.running = false }
    },
    async cancel() {
      try { await commissioningService.cancel({ transactionId }) } finally {
        if (this.state !== 'COMPLETE') this.state = transition(this.state, 'CANCELLED')
        this.running = false
      }
    },
    async retry() {
      if (!retryTarget(this.state)) return
      this.reset()
      await this.scan()
    },
    async advance(next: CommissioningState) {
      await new Promise(resolve => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 140))
      this.state = transition(this.state, next)
    },
    inject(failure: CommissioningFailureState) {
      if (this.failureAt === failure) {
        this.state = transition(this.state, failure)
        this.error = `Injected development failure: ${failure}`
        throw new Error(this.error)
      }
    },
    fail(failure: CommissioningFailureState, error: unknown) {
      if (this.state !== failure) this.state = transition(this.state, failure)
      this.error = error instanceof Error ? error.message : failure
    },
    failureForState(): CommissioningFailureState {
      if (this.state === 'CLAIM_CHALLENGE') return 'CLAIM_FAILED'
      if (this.state === 'BLE_CONNECTING') return 'PASE_FAILED'
      if (this.state === 'THREAD_PROVISIONING' || this.state === 'THREAD_ATTACHING') return 'THREAD_ATTACH_FAILED'
      if (this.state === 'ENDPOINT_DISCOVERY') return 'NODE_NOT_DISCOVERED'
      if (this.state === 'SUBSCRIBING') return 'SUBSCRIPTION_FAILED'
      if (this.state === 'TEMP_FABRIC_REMOVING') return 'TEMP_FABRIC_REMOVE_FAILED'
      return 'BBB_COMMISSION_FAILED'
    },
  },
})
