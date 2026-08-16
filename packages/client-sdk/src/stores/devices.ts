import type { CommandResponse, MatterEvent } from '../contracts.js'
import { defineStore } from 'pinia'

export interface DeviceState {
  node_id: string
  endpoint: number
  clusters: Record<number, Record<string, unknown>>
}

export const useDeviceStore = defineStore('devices', {
  state: () => ({ devices: {} as Record<string, DeviceState> }),
  actions: {
    apply(message: CommandResponse | MatterEvent) {
      if (!message.node_id || message.endpoint === null || message.cluster === null) return
      let attributes: Record<string, unknown> | undefined
      if ('type' in message) attributes = message.attributes
      else if (message.status === 'ok' && isRecord(message.result) && isRecord(message.result.attributes)) {
        attributes = message.result.attributes
      }
      if (!attributes) return
      const key = `${message.node_id}:${message.endpoint}`
      const device = this.devices[key] ?? {
        node_id: message.node_id,
        endpoint: message.endpoint,
        clusters: {},
      }
      device.clusters[message.cluster] = { ...device.clusters[message.cluster], ...attributes }
      this.devices[key] = device
    },
    attributes(nodeId: string, endpoint: number, cluster: number): Record<string, unknown> {
      return this.devices[`${nodeId}:${endpoint}`]?.clusters[cluster] ?? {}
    },
  },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
