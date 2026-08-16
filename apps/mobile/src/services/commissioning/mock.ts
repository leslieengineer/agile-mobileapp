import type { CommissioningService } from './types'

const wait = () => new Promise(resolve => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 180))

export class MockCommissioningService implements CommissioningService {
  async scanDevices() {
    await wait()
    return { devices: [
      { claimId: 'mock-device-a', productId: 1, productName: 'Rhophi Plug', serialSuffix: 'A104', rssi: -42 },
      { claimId: 'mock-device-b', productId: 1, productName: 'Rhophi Plug', serialSuffix: 'B217', rssi: -67 },
    ] }
  }
  async identifyDevice() { await wait() }
  async claimDevice() { await wait(); return { verified: true } }
  async commissionBle() { await wait(); return { temporaryNodeId: 'mock-temporary-node' } }
  async openCommissioningWindow() { await wait(); return { windowId: 'mock-window', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } }
  async removeTemporaryFabric() { await wait() }
  async cancel() { await wait() }
}
