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

  it('contains every server-owned state and preserves cleanup recovery', () => {
    const states = new Set([
      ...COMMISSIONING_SUCCESS_STATES,
      'CLEANUP_PENDING',
    ])
    for (const state of [
      'CREATED', 'CLAIM_CHALLENGE', 'CLAIM_VERIFIED', 'GRANT_ISSUED',
      'PASE_ESTABLISHED', 'ATTESTATION_VERIFIED', 'THREAD_PROVISIONING',
      'THREAD_ATTACHING', 'TEMP_FABRIC_COMMISSIONED', 'WINDOW_OPEN',
      'BBB_FABRIC_COMMISSIONING', 'ENDPOINT_DISCOVERY', 'SUBSCRIBING',
      'TEMP_FABRIC_REMOVING', 'CLEANUP_PENDING', 'COMPLETE',
    ]) expect(states.has(state)).toBe(true)

    expect(transition('TEMP_FABRIC_REMOVING', 'CLEANUP_PENDING')).toBe('CLEANUP_PENDING')
    expect(transition('CLEANUP_PENDING', 'TEMP_FABRIC_REMOVING')).toBe('TEMP_FABRIC_REMOVING')
    expect(transition('PASE_FAILED', 'CANCELLED')).toBe('CANCELLED')
  })
})
