import { describe, expect, it, vi } from 'vitest'
import { redact, safeLog } from '../src/redact.js'

describe('redaction', () => {
  it('removes sensitive fields recursively', () => {
    expect(redact({ transaction_id: 'tx', nested: { setupPasscode: 'x', result: 'ok' }, token: 'secret' })).toEqual({
      transaction_id: 'tx',
      nested: { result: 'ok' },
    })
  })

  it('only sends redacted values to a logger', () => {
    const logger = vi.fn()
    safeLog(logger, { state: 'COMPLETE', threadDataset: 'hidden' })
    expect(logger).toHaveBeenCalledWith({ state: 'COMPLETE' })
  })
})
