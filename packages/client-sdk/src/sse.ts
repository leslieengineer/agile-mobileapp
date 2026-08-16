import { SseEnvelopeSchema, type SseEnvelope } from './contracts.js'
import type { TokenProvider } from './http.js'

export interface ParsedSseEvent {
  id?: string
  event?: string
  data: string
  retry?: number
}

export class SseParser {
  private buffer = ''
  private id: string | undefined
  private event: string | undefined
  private data: string[] = []
  private retry: number | undefined

  push(chunk: string): ParsedSseEvent[] {
    this.buffer += chunk.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    const output: ParsedSseEvent[] = []
    let boundary = this.buffer.indexOf('\n')
    while (boundary >= 0) {
      const line = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 1)
      const event = this.consumeLine(line)
      if (event) output.push(event)
      boundary = this.buffer.indexOf('\n')
    }
    return output
  }

  private consumeLine(line: string): ParsedSseEvent | undefined {
    if (line === '') {
      if (this.data.length === 0) {
        this.resetEventFields()
        return
      }
      const result = {
        id: this.id,
        event: this.event,
        data: this.data.join('\n'),
        retry: this.retry,
      }
      this.resetEventFields()
      return result
    }
    if (line.startsWith(':')) return
    const separator = line.indexOf(':')
    const field = separator < 0 ? line : line.slice(0, separator)
    const raw = separator < 0 ? '' : line.slice(separator + 1)
    const value = raw.startsWith(' ') ? raw.slice(1) : raw
    if (field === 'id' && !value.includes('\0')) this.id = value
    else if (field === 'event') this.event = value
    else if (field === 'data') this.data.push(value)
    else if (field === 'retry' && /^\d+$/.test(value)) this.retry = Number(value)
    return
  }

  private resetEventFields() {
    this.event = undefined
    this.data = []
  }
}

export interface SseClientOptions {
  baseUrl: string
  tokens: TokenProvider
  fetcher?: typeof fetch
  onEnvelope(envelope: SseEnvelope): void
  onConnection(connected: boolean, error?: string): void
}

export class AuthenticatedSseClient {
  private abort?: AbortController
  private lastEventId?: string
  private retryMs = 3000

  constructor(private readonly options: SseClientOptions) {}

  connect() {
    this.disconnect()
    this.abort = new AbortController()
    void this.run(this.abort.signal)
  }

  disconnect() {
    this.abort?.abort()
    this.abort = undefined
    this.options.onConnection(false)
  }

  private async run(signal: AbortSignal) {
    let failures = 0
    while (!signal.aborted) {
      try {
        await this.open(signal)
        failures = 0
      } catch (error) {
        if (signal.aborted) return
        failures += 1
        this.options.onConnection(false, error instanceof Error ? error.message : 'Realtime connection lost')
      }
      if (!signal.aborted) await delay(Math.min(this.retryMs * 2 ** Math.min(failures, 4), 30_000), signal)
    }
  }

  private async open(signal: AbortSignal) {
    const token = await this.options.tokens.get()
    if (!token) throw new Error('Login required')
    const response = await (this.options.fetcher ?? fetch)(`${this.options.baseUrl}/api/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(this.lastEventId ? { 'Last-Event-ID': this.lastEventId } : {}),
      },
      signal,
    })
    if (!response.ok || !response.body) throw new Error(`Realtime HTTP ${response.status}`)
    this.options.onConnection(true)
    const parser = new SseParser()
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) throw new Error('Realtime connection closed')
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (event.id !== undefined) this.lastEventId = event.id
        if (event.retry !== undefined) this.retryMs = Math.max(1000, Math.min(event.retry, 30_000))
        try {
          const parsed = SseEnvelopeSchema.safeParse(JSON.parse(event.data))
          if (parsed.success) this.options.onEnvelope(parsed.data)
        } catch {
          // Ignore malformed events without dropping a healthy stream.
        }
      }
    }
  }
}

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}
