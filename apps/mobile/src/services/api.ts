import { RhophiApiClient } from '@rhophi/client-sdk'
import { tokenStore } from './tokenStore'

export const api = new RhophiApiClient(import.meta.env.VITE_API_BASE_URL ?? 'https://dashboard.rhophi.uk', tokenStore)
