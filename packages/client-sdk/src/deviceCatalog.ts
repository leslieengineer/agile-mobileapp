import type { CommissioningApi } from './commissioning/api.js'

export interface DeviceEndpointDescriptor {
  endpoint: number
  kind: 'onoff' | 'level' | 'window-covering' | 'cooktop'
  label: string
}

export interface DeviceDescriptor {
  nodeId: string
  name: string
  product: string
  endpoints: DeviceEndpointDescriptor[]
}

export interface DeviceCatalog {
  list(): Promise<DeviceDescriptor[]>
}

export class StaticDeviceCatalog implements DeviceCatalog {
  constructor(private readonly devices: DeviceDescriptor[]) {}

  async list() {
    return structuredClone(this.devices)
  }
}

export class ApiDeviceCatalog implements DeviceCatalog {
  constructor(private readonly api: CommissioningApi) {}

  async list(): Promise<DeviceDescriptor[]> {
    const response = await this.api.listDevices()
    return response.devices.map(device => {
      const descriptor = device.descriptor as { endpoints?: Array<{ endpoint?: number; server_clusters?: number[] }> }
      const endpoints: DeviceEndpointDescriptor[] = []
      for (const endpoint of descriptor.endpoints ?? []) {
        if (endpoint.endpoint === undefined) continue
        if (endpoint.server_clusters?.includes(0x0006)) endpoints.push({ endpoint: endpoint.endpoint, kind: 'onoff', label: 'Switch' })
        if (endpoint.server_clusters?.includes(0x0008)) endpoints.push({ endpoint: endpoint.endpoint, kind: 'level', label: 'Level' })
        if (endpoint.server_clusters?.includes(0x0102)) endpoints.push({ endpoint: endpoint.endpoint, kind: 'window-covering', label: 'Window' })
      }
      return { nodeId: device.node_id, name: 'Rhophi device', product: 'Matter device', endpoints }
    })
  }
}

export const phaseADeviceCatalog = new StaticDeviceCatalog([
  {
    nodeId: '0x0000000000000001',
    name: 'Rhophi Demo Node',
    product: 'Configured dashboard device',
    endpoints: [
      { endpoint: 1, kind: 'onoff', label: 'Switch' },
      { endpoint: 1, kind: 'level', label: 'Level' },
      { endpoint: 2, kind: 'window-covering', label: 'Window' },
      { endpoint: 3, kind: 'cooktop', label: 'Cooktop' },
    ],
  },
])
