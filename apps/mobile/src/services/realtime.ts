import { AuthenticatedSseClient, useActivityStore, useConnectionStore, useDeviceStore } from '@rhophi/client-sdk'
import { tokenStore } from './tokenStore'

let client: AuthenticatedSseClient | undefined

export function startRealtime() {
  stopRealtime()
  const connection = useConnectionStore()
  const devices = useDeviceStore()
  const activity = useActivityStore()
  connection.startConnecting()
  client = new AuthenticatedSseClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'https://dashboard.rhophi.uk',
    tokens: tokenStore,
    onConnection: (connected, error) => connection.update(connected, error),
    onEnvelope: envelope => {
      if (envelope.type === 'response' || envelope.type === 'event') {
        devices.apply(envelope.data)
        activity.push(envelope.data)
      }
    },
  })
  client.connect()
}

export function stopRealtime() {
  client?.disconnect()
  client = undefined
}
