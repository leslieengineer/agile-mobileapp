import { describe, expect, it } from 'vitest'
import { COMMISSIONING_SUCCESS_STATES, canRetry, retryTarget, transition } from '../src/commissioning/stateMachine.js'

describe('commissioning state machine', () => {
  it('walks the complete success path', () => {
    let state = COMMISSIONING_SUCCESS_STATES[0]
    for (const next of COMMISSIONING_SUCCESS_STATES.slice(1)) state = transition(state, next)
    expect(state).toBe('COMPLETE')
  })

  it('rejects skipped transitions', () => {
    expect(() => transition('CREATED', 'DEVICE_SELECTED')).toThrow('Invalid transition')
  })

  it('defines explicit retry targets', () => {
    expect(canRetry('BLE_TIMEOUT')).toBe(true)
    expect(retryTarget('BLE_TIMEOUT')).toBe('BLE_SCANNING')
    expect(transition('BLE_TIMEOUT', 'BLE_SCANNING')).toBe('BLE_SCANNING')
    expect(canRetry('ATTESTATION_FAILED')).toBe(false)
  })
})
