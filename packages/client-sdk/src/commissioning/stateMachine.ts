export const COMMISSIONING_SUCCESS_STATES = [
  'CREATED',
  'BLE_SCANNING',
  'DEVICE_SELECTED',
  'IDENTIFYING',
  'CLAIM_CHALLENGE',
  'CLAIM_VERIFIED',
  'GRANT_ISSUED',
  'BLE_CONNECTING',
  'PASE_ESTABLISHED',
  'ATTESTATION_VERIFIED',
  'THREAD_PROVISIONING',
  'THREAD_ATTACHING',
  'TEMP_FABRIC_COMMISSIONED',
  'WINDOW_OPEN',
  'BBB_FABRIC_COMMISSIONING',
  'ENDPOINT_DISCOVERY',
  'SUBSCRIBING',
  'TEMP_FABRIC_REMOVING',
  'COMPLETE',
] as const

export const COMMISSIONING_FAILURE_STATES = [
  'INVALID_DEVICE',
  'CLAIM_FAILED',
  'BLE_TIMEOUT',
  'PASE_FAILED',
  'ATTESTATION_FAILED',
  'THREAD_ATTACH_FAILED',
  'NODE_NOT_DISCOVERED',
  'BBB_COMMISSION_FAILED',
  'SUBSCRIPTION_FAILED',
  'TEMP_FABRIC_REMOVE_FAILED',
  'CANCELLED',
  'EXPIRED',
] as const

export const COMMISSIONING_RECOVERY_STATES = ['CLEANUP_PENDING'] as const

export type CommissioningSuccessState = typeof COMMISSIONING_SUCCESS_STATES[number]
export type CommissioningRecoveryState = typeof COMMISSIONING_RECOVERY_STATES[number]
export type CommissioningFailureState = typeof COMMISSIONING_FAILURE_STATES[number]
export type CommissioningState = CommissioningSuccessState | CommissioningRecoveryState | CommissioningFailureState

const nextSuccess = new Map<CommissioningState, CommissioningState>(
  COMMISSIONING_SUCCESS_STATES.slice(0, -1).map((state, index) => [state, COMMISSIONING_SUCCESS_STATES[index + 1]!]),
)
nextSuccess.set('TEMP_FABRIC_REMOVING', 'COMPLETE')

const retryTargets: Partial<Record<CommissioningFailureState, CommissioningSuccessState>> = {
  CLAIM_FAILED: 'CLAIM_CHALLENGE',
  BLE_TIMEOUT: 'BLE_SCANNING',
  PASE_FAILED: 'BLE_CONNECTING',
  THREAD_ATTACH_FAILED: 'THREAD_PROVISIONING',
  NODE_NOT_DISCOVERED: 'WINDOW_OPEN',
  BBB_COMMISSION_FAILED: 'WINDOW_OPEN',
  SUBSCRIPTION_FAILED: 'WINDOW_OPEN',
  TEMP_FABRIC_REMOVE_FAILED: 'TEMP_FABRIC_REMOVING',
}

export function transition(current: CommissioningState, next: CommissioningState): CommissioningState {
  if (next === 'CANCELLED' && current !== 'COMPLETE') return next
  if (isFailure(next)) {
    if (isTerminal(current)) throw new Error(`Cannot fail terminal state ${current}`)
    return next
  }
  if (isFailure(current)) {
    if (retryTargets[current] === next) return next
    if (current === 'TEMP_FABRIC_REMOVE_FAILED' && next === 'CLEANUP_PENDING') return next
    throw new Error(`Invalid retry transition ${current} -> ${next}`)
  }
  if (current === 'TEMP_FABRIC_REMOVING' && next === 'CLEANUP_PENDING') return next
  if (current === 'CLEANUP_PENDING' && next === 'TEMP_FABRIC_REMOVING') return next
  if (nextSuccess.get(current) !== next) throw new Error(`Invalid transition ${current} -> ${next}`)
  return next
}

export function retryTarget(state: CommissioningState) {
  return isFailure(state) ? retryTargets[state] : undefined
}

export function canRetry(state: CommissioningState) {
  return retryTarget(state) !== undefined
}

export function isTerminal(state: CommissioningState) {
  return state === 'COMPLETE' || isFailure(state)
}

export function isFailure(state: CommissioningState): state is CommissioningFailureState {
  return (COMMISSIONING_FAILURE_STATES as readonly string[]).includes(state)
}
