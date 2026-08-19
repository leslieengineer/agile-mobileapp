import type { PluginListenerHandle } from '@capacitor/core'

export interface NativeDiscoveredDevice {
  address: string
  claimId: string
  productId: number
  protocolVersion: number
  flags: number
  rssi: number
}

export interface NativeEncryptedGrant {
  version: 1
  algorithm: 'X25519-HKDF-SHA256-AES-256-GCM'
  serverEphemeralPublicKey: string
  nonce: string
  ciphertext: string
  authenticationTag: string
  transactionId: string
  expiresAt: string
}

export interface CommissioningProgressEvent {
  transactionId?: string
  state: string
  errorCode?: string
}

export interface RhophiCommissioningPlugin {
  generateEphemeralKey(options: { transactionHint: string }): Promise<{ publicKey: string; keyId: string }>
  scanDevices(options: { timeoutMs: number }): Promise<{ devices: NativeDiscoveredDevice[] }>
  readIdentity(options: { address: string }): Promise<Omit<NativeDiscoveredDevice, 'address' | 'rssi'>>
  identifyDevice(options: { address: string }): Promise<void>
  claimDevice(options: { address: string; challenge: string }): Promise<{
    deviceNonce: string
    proof: string
    claimId: string
    productId: number
  }>
  commissionBle(options: { address: string; keyId: string; grant: NativeEncryptedGrant }): Promise<{
    temporaryNodeId: string
    attestationVerified: true
  }>
  openCommissioningWindow(options: { temporaryNodeId: string; timeoutSeconds: number }): Promise<{
    discriminator: number
    setupPasscode: number
    expiresAt: string
  }>
  removeTemporaryFabric(options: { temporaryNodeId: string }): Promise<void>
  cancel(options: { transactionId?: string }): Promise<void>
  addListener(eventName: 'commissioningProgress', listener: (event: CommissioningProgressEvent) => void): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}
