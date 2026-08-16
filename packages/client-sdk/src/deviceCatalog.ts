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
