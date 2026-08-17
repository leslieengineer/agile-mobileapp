import type { EncryptedCommissioningGrant } from '@rhophi/client-sdk'

export interface DiscoveredDevice {
  address: string
  claimId: string
  productId: number
  productName: string
  serialSuffix: string
  rssi: number
}
export interface ClaimResult {
  deviceNonce: string
  proof: string
  claimId: string
  productId: number
}
export interface TemporaryNode { temporaryNodeId: string; attestationVerified: true }
export interface CommissioningWindow {
  discriminator: number
  setupPasscode: number
  expiresAt: string
}

export interface CommissioningService {
  createEphemeralKey(options: { transactionHint: string }): Promise<{ publicKey: string; keyId: string }>
  scanDevices(options?: { timeoutMs?: number }): Promise<{ devices: DiscoveredDevice[] }>
  identifyDevice(options: { address: string }): Promise<void>
  claimDevice(options: { address: string; challenge: string }): Promise<ClaimResult>
  commissionBle(options: { address: string; keyId: string; grant: EncryptedCommissioningGrant }): Promise<TemporaryNode>
  openCommissioningWindow(options: { temporaryNodeId: string; timeoutSeconds: number }): Promise<CommissioningWindow>
  removeTemporaryFabric(options: { temporaryNodeId: string }): Promise<void>
  cancel(options: { transactionId?: string }): Promise<void>
}
