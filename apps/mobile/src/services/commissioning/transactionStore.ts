import type { CommissioningState } from '@rhophi/client-sdk'

export interface CommissioningSnapshot {
  state: CommissioningState
  transactionId: string
  expiresAt: string
  keyId: string
  address: string
  claimId: string
  productId: number
  temporaryNodeId?: string
  bbbNodeId?: string
}

const KEY = 'rhophi-commissioning-v1'
const memory = new Map<string, string>()
const storage = typeof localStorage === 'undefined'
  ? { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) }
  : localStorage

export const commissioningTransactionStore = {
  load(): CommissioningSnapshot | undefined {
    const raw = storage.getItem(KEY)
    if (!raw) return undefined
    try {
      const value = JSON.parse(raw) as CommissioningSnapshot
      if (!value.transactionId || !value.keyId || !value.address || !value.expiresAt) return undefined
      return value
    } catch {
      storage.removeItem(KEY)
      return undefined
    }
  },
  save(value: CommissioningSnapshot) {
    storage.setItem(KEY, JSON.stringify(value))
  },
  clear() { storage.removeItem(KEY) },
}
