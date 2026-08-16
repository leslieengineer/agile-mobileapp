import { MockCommissioningService } from './mock'
import type { CommissioningService } from './types'

class UnavailableCommissioningService implements CommissioningService {
  private unavailable(): never { throw new Error('Commissioning is unavailable in this build') }
  async scanDevices(): Promise<never> { return this.unavailable() }
  async identifyDevice(): Promise<never> { return this.unavailable() }
  async claimDevice(): Promise<never> { return this.unavailable() }
  async commissionBle(): Promise<never> { return this.unavailable() }
  async openCommissioningWindow(): Promise<never> { return this.unavailable() }
  async removeTemporaryFabric(): Promise<never> { return this.unavailable() }
  async cancel(): Promise<never> { return this.unavailable() }
}

export const mockCommissioningEnabled = import.meta.env.DEV && import.meta.env.VITE_COMMISSIONING_MODE === 'mock'
export const commissioningService: CommissioningService = mockCommissioningEnabled
  ? new MockCommissioningService()
  : new UnavailableCommissioningService()
export * from './types'
