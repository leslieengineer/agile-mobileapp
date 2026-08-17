import { describe, expect, it } from 'vitest'
import { CommissioningApi, type RhophiApiClient } from '../src/index.js'

const transactionId = '11111111-1111-4111-8111-111111111111'
const session = {
  transaction_id: transactionId,
  claim_id: 'UFJSU1RVVldYWVpbXF1eXw',
  product_id: 1,
  state: 'TEMP_FABRIC_REMOVING',
  created_at: '2026-08-17T00:00:00.000Z',
  expires_at: '2026-08-17T00:10:00.000Z',
  temporary_node_id: '0x1',
  bbb_node_id: '0x100',
}

describe('CommissioningApi', () => {
  it('uses authenticated REST endpoints and parses strict responses', async () => {
    const calls: Array<{ path: string; method?: string }> = []
    const client = {
      async request(path: string, init: RequestInit = {}) {
        calls.push({ path, method: init.method })
        if (path.endsWith('/window')) return { session, descriptor: {} }
        if (path === '/api/devices') return { devices: [] }
        return session
      },
    } as unknown as RhophiApiClient
    const api = new CommissioningApi(client)
    await api.getSession(transactionId)
    await api.threadAttached(transactionId, '0x1')
    await api.handoffWindow(transactionId, {
      temporary_node_id: '0x1', discriminator: 1234, setup_passcode: 34567890, timeout_seconds: 900,
    })
    await api.complete(transactionId, '0x100', true)
    await api.listDevices()
    expect(calls.map(call => call.path)).toEqual([
      `/api/commissioning/sessions/${transactionId}`,
      `/api/commissioning/sessions/${transactionId}/thread-attached`,
      `/api/commissioning/sessions/${transactionId}/window`,
      `/api/commissioning/sessions/${transactionId}/complete`,
      '/api/devices',
    ])
  })

  it('rejects malformed server state', async () => {
    const client = { request: async () => ({ ...session, state: 'MADE_UP' }) } as unknown as RhophiApiClient
    await expect(new CommissioningApi(client).getSession(transactionId)).rejects.toThrow()
  })
})
