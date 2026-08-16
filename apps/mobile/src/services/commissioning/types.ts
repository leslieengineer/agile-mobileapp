export interface DiscoveredDevice {
  claimId: string
  productId: number
  productName: string
  serialSuffix: string
  rssi: number
}
export interface ClaimResult { verified: boolean }
export interface TemporaryNode { temporaryNodeId: string }
export interface CommissioningWindow { windowId: string; expiresAt: string }

export interface CommissioningService {
  scanDevices(options?: { timeoutMs?: number }): Promise<{ devices: DiscoveredDevice[] }>
  identifyDevice(options: { claimId: string }): Promise<void>
  claimDevice(options: { transactionId: string; claimId: string; challenge: string }): Promise<ClaimResult>
  commissionBle(options: { transactionId: string; encryptedCommissioningPayload: string; gatewayEphemeralPublicKey: string }): Promise<TemporaryNode>
  openCommissioningWindow(options: { temporaryNodeId: string }): Promise<CommissioningWindow>
  removeTemporaryFabric(options: { temporaryNodeId: string }): Promise<void>
  cancel(options: { transactionId: string }): Promise<void>
}
