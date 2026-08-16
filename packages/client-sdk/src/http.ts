import {
  ApiErrorSchema,
  CommandResponseSchema,
  MobileLoginResponseSchema,
  MobileSessionInfoSchema,
  type ApiErrorCode,
  type CommandInput,
  type CommandResponse,
  type MobileSessionInfo,
} from './contracts.js'

export interface TokenProvider {
  get(): Promise<string | undefined>
  set(token: string): Promise<void>
  clear(): Promise<void>
}

export interface HealthStatus {
  ok: boolean
  mqtt_connected: boolean
  sse_clients: number
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class RhophiApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: TokenProvider,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async login(username: string, password: string) {
    const response = MobileLoginResponseSchema.parse(await this.request('/api/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, false))
    await this.tokens.set(response.token)
    return response
  }

  async session(): Promise<MobileSessionInfo> {
    return MobileSessionInfoSchema.parse(await this.request('/api/session'))
  }

  async logout() {
    try {
      await this.request('/api/logout', { method: 'POST' })
    } finally {
      await this.tokens.clear()
    }
  }

  async sendCommand(input: CommandInput): Promise<CommandResponse> {
    return CommandResponseSchema.parse(await this.request('/api/command', { method: 'POST', body: JSON.stringify(input) }))
  }

  async health(): Promise<HealthStatus> {
    return this.request('/api/health', {}, false)
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticate = true): Promise<T> {
    const token = authenticate ? await this.tokens.get() : undefined
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
    const data = response.status === 204 ? undefined : await response.json()
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse((data as { error?: unknown } | undefined)?.error)
      if (parsed.success) {
        throw new ApiError(parsed.data.code, parsed.data.message, response.status, parsed.data.retry_after_s)
      }
      throw new ApiError('INTERNAL', `HTTP ${response.status}`, response.status)
    }
    return data as T
  }
}
