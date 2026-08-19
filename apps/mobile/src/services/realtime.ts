import { AuthenticatedSseClient, useActivityStore, useConnectionStore, useDeviceStore } from '@rhophi/client-sdk'
import { tokenStore } from './tokenStore'
import { useCommissioningStore } from '../stores/commissioning'

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
      } else if (envelope.type === 'provisioning') {
        const commissioning = useCommissioningStore()
        if (commissioning.transaction?.transactionId === envelope.transaction_id && !commissioning.running) {
          commissioning.state = envelope.state
          commissioning.error = envelope.error?.message ?? ''
          commissioning.persist()
        }
      }
    },
  })
  client.connect()
}

export function stopRealtime() {
  client?.disconnect()
  client = undefined
}
