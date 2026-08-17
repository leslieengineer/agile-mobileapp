import { RhophiApiClient } from '../http.js'
import {
  ClaimProofResponseSchema,
  CommissioningSessionCreateResponseSchema,
  CommissioningSessionSchema,
  CommissioningWindowResponseSchema,
  DeviceInventoryResponseSchema,
  type CommissioningSessionCreateRequest,
} from './contracts.js'

export class CommissioningApi {
  constructor(private readonly client: RhophiApiClient) {}

  async createSession(input: CommissioningSessionCreateRequest) {
    return CommissioningSessionCreateResponseSchema.parse(await this.client.request('/api/commissioning/sessions', {
      method: 'POST', body: JSON.stringify(input),
    }))
  }
  async submitClaim(transactionId: string, input: { device_nonce: string; proof: string; ble_address_hint?: string }) {
    return ClaimProofResponseSchema.parse(await this.client.request(`/api/commissioning/sessions/${transactionId}/claim`, {
      method: 'POST', body: JSON.stringify(input),
    }))
  }
  async getSession(transactionId: string) {
    return CommissioningSessionSchema.parse(await this.client.request(`/api/commissioning/sessions/${transactionId}`))
  }
  async cancel(transactionId: string) {
    return CommissioningSessionSchema.parse(await this.client.request(`/api/commissioning/sessions/${transactionId}`, { method: 'DELETE' }))
  }
  async threadAttached(transactionId: string, temporaryNodeId: string) {
    return CommissioningSessionSchema.parse(await this.client.request(`/api/commissioning/sessions/${transactionId}/thread-attached`, {
      method: 'POST', body: JSON.stringify({ temporary_node_id: temporaryNodeId, attestation_verified: true }),
    }))
  }
  async handoffWindow(transactionId: string, input: {
    temporary_node_id: string
    discriminator: number
    setup_passcode: number
    timeout_seconds: number
    known_ipv6_address?: string
  }) {
    return CommissioningWindowResponseSchema.parse(await this.client.request(`/api/commissioning/sessions/${transactionId}/window`, {
      method: 'POST', body: JSON.stringify(input),
    }))
  }
  async complete(transactionId: string, bbbNodeId: string, temporaryFabricRemoved: boolean) {
    return CommissioningSessionSchema.parse(await this.client.request(`/api/commissioning/sessions/${transactionId}/complete`, {
      method: 'POST', body: JSON.stringify({ bbb_node_id: bbbNodeId, temporary_fabric_removed: temporaryFabricRemoved }),
    }))
  }
  async listDevices() {
    return DeviceInventoryResponseSchema.parse(await this.client.request('/api/devices'))
  }
  async removeDevice(nodeId: string) {
    return this.client.request(`/api/devices/${nodeId}`, { method: 'DELETE' })
  }
}
