import { RhophiCommissioning } from '@rhophi/commissioning-plugin'
import type { CommissioningService, DiscoveredDevice } from './types'

export class NativeCommissioningService implements CommissioningService {
  createEphemeralKey(options: { transactionHint: string }) {
    return RhophiCommissioning.generateEphemeralKey(options)
  }
  async scanDevices(options: { timeoutMs?: number } = {}) {
    const result = await RhophiCommissioning.scanDevices({ timeoutMs: options.timeoutMs ?? 10_000 })
    const devices: DiscoveredDevice[] = result.devices.map(device => ({
      address: device.address,
      claimId: device.claimId,
      productId: device.productId,
      productName: device.productId === 1 ? 'Rhophi Plug' : `Rhophi product ${device.productId}`,
      serialSuffix: device.claimId.slice(-4),
      rssi: device.rssi,
    }))
    return { devices }
  }
  identifyDevice(options: { address: string }) { return Promise.resolve() }
  claimDevice(options: { address: string; challenge: string }) { return RhophiCommissioning.claimDevice(options) }
  commissionBle(options: Parameters<CommissioningService['commissionBle']>[0]) {
    const grant = options.grant
    return RhophiCommissioning.commissionBle({
      address: options.address,
      keyId: options.keyId,
      grant: {
        version: grant.version,
        algorithm: grant.algorithm,
        serverEphemeralPublicKey: grant.server_ephemeral_public_key,
        nonce: grant.nonce,
        ciphertext: grant.ciphertext,
        authenticationTag: grant.authentication_tag,
        transactionId: grant.transaction_id,
        expiresAt: grant.expires_at,
      },
    })
  }
  openCommissioningWindow(options: { temporaryNodeId: string; timeoutSeconds: number }) {
    return RhophiCommissioning.openCommissioningWindow(options)
  }
  removeTemporaryFabric(options: { temporaryNodeId: string }) {
    return RhophiCommissioning.removeTemporaryFabric(options)
  }
  cancel(options: { transactionId?: string }) { return RhophiCommissioning.cancel(options) }
}
