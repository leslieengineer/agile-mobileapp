const SENSITIVE_KEY = /pass(code|word)|dataset|pskd|secret|private|cookie|token|nonce/i

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, entry]) => [key, redact(entry)]),
  )
}

export function safeLog(logger: (value: unknown) => void, value: unknown) {
  logger(redact(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
