import type { CommissioningService } from './types'

const wait = () => new Promise(resolve => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 180))

export class MockCommissioningService implements CommissioningService {
  async createEphemeralKey() { await wait(); return { publicKey: 'bW9jay1wdWJsaWMta2V5', keyId: 'mock-key' } }
  async scanDevices() {
    await wait()
    return { devices: [
      { address: '00:00:00:00:00:01', claimId: 'bW9jay1kZXZpY2UtYTAxNA', productId: 1, productName: 'Rhophi Plug', serialSuffix: 'A104', rssi: -42 },
      { address: '00:00:00:00:00:02', claimId: 'bW9jay1kZXZpY2UtYjIxNw', productId: 1, productName: 'Rhophi Plug', serialSuffix: 'B217', rssi: -67 },
    ] }
  }
  async identifyDevice() { await wait() }
  async claimDevice(options: { address: string; challenge: string }) {
    await wait()
    return {
      deviceNonce: 'bW9jay1ub25jZS0wMDE',
      proof: 'bW9jay1wcm9vZi0wMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw',
      claimId: options.address.endsWith('01') ? 'bW9jay1kZXZpY2UtYTAxNA' : 'bW9jay1kZXZpY2UtYjIxNw',
      productId: 1,
    }
  }
  async commissionBle() { await wait(); return { temporaryNodeId: '0x0000000000000001', attestationVerified: true as const } }
  async openCommissioningWindow() {
    await wait()
    return { discriminator: 1234, setupPasscode: 34567890, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }
  }
  async removeTemporaryFabric() { await wait() }
  async cancel() { await wait() }
}
