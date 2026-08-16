import { describe, expect, it, vi } from 'vitest'
import { ApiError, RhophiApiClient, type TokenProvider } from '../src/http.js'

function provider(): TokenProvider & { value?: string } {
  return {
    value: undefined,
    async get() { return this.value },
    async set(token) { this.value = token },
    async clear() { this.value = undefined },
  }
}

describe('Rhophi API client', () => {
  it('stores login token and sends it as bearer auth', async () => {
    const tokens = provider()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true, username: 'admin', expires_at: '2026-08-17T00:00:00.000Z', token: 'a'.repeat(43) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true, username: 'admin', expires_at: '2026-08-17T00:00:00.000Z' }), { status: 200 }))
    const client = new RhophiApiClient('https://example.test', tokens, fetcher)

    await client.login('admin', 'password1')
    await client.session()

    expect(tokens.value).toBe('a'.repeat(43))
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${'a'.repeat(43)}`)
  })

  it('maps typed API errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Login required' } }), { status: 401 }))
    const client = new RhophiApiClient('', provider(), fetcher)
    await expect(client.session()).rejects.toEqual(expect.objectContaining<ApiError>({ code: 'UNAUTHENTICATED', status: 401 }))
  })
})
