import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDeviceStore } from '../src/stores/devices.js'

describe('device store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('merges realtime attributes by node and endpoint', () => {
    const store = useDeviceStore()
    store.apply({ type: 'event', request_id: null, node_id: '0x01', endpoint: 1, cluster: 6, attributes: { OnOff: true }, timestamp: '2026-08-17T00:00:00.000Z' })
    store.apply({ type: 'event', request_id: null, node_id: '0x01', endpoint: 1, cluster: 6, attributes: { GlobalSceneControl: true }, timestamp: '2026-08-17T00:00:01.000Z' })
    expect(store.attributes('0x01', 1, 6)).toEqual({ OnOff: true, GlobalSceneControl: true })
  })
})
