import { Capacitor } from '@capacitor/core'
import { MockCommissioningService } from './mock'
import { NativeCommissioningService } from './native'
import type { CommissioningService } from './types'

class UnavailableCommissioningService implements CommissioningService {
  private unavailable(): never { throw new Error('Commissioning requires the native Android build') }
  async createEphemeralKey(): Promise<never> { return this.unavailable() }
  async scanDevices(): Promise<never> { return this.unavailable() }
  async identifyDevice(): Promise<never> { return this.unavailable() }
  async claimDevice(): Promise<never> { return this.unavailable() }
  async commissionBle(): Promise<never> { return this.unavailable() }
  async openCommissioningWindow(): Promise<never> { return this.unavailable() }
  async removeTemporaryFabric(): Promise<never> { return this.unavailable() }
  async cancel(): Promise<never> { return this.unavailable() }
}

export const mockCommissioningEnabled = import.meta.env.DEV && import.meta.env.VITE_COMMISSIONING_MODE === 'mock'
export const nativeCommissioningEnabled = Capacitor.isNativePlatform()
export const commissioningService: CommissioningService = nativeCommissioningEnabled
  ? new NativeCommissioningService()
  : mockCommissioningEnabled
    ? new MockCommissioningService()
    : new UnavailableCommissioningService()
export * from './types'
