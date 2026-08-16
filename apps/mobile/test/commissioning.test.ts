import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_COMMISSIONING_MODE', 'mock')
  setActivePinia(createPinia())
})

describe('development commissioning wizard', () => {
  it('runs the complete mock state sequence', async () => {
    const { useCommissioningStore } = await import('../src/stores/commissioning')
    const store = useCommissioningStore()
    expect(store.mock).toBe(true)
    await store.scan()
    await store.select(store.devices[0]!)
    await store.commission()
    expect(store.state).toBe('COMPLETE')
  })

  it('surfaces an injected failure as recoverable state', async () => {
    const { useCommissioningStore } = await import('../src/stores/commissioning')
    const store = useCommissioningStore()
    store.failureAt = 'BBB_COMMISSION_FAILED'
    await store.scan()
    await store.select(store.devices[0]!)
    await store.commission()
    expect(store.state).toBe('BBB_COMMISSION_FAILED')
    expect(store.retryable).toBe(true)
  })
})
