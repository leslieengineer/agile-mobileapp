import { z } from 'zod'

export const Base64UrlSchema = z.string().min(8).max(4096).regex(/^[A-Za-z0-9_-]+$/u)
const NodeIdSchema = z.string().regex(/^(?:0x)?[0-9a-fA-F]{1,16}$/u)

export const ServerProvisioningStateSchema = z.enum([
  'CREATED', 'CLAIM_CHALLENGE', 'CLAIM_VERIFIED', 'GRANT_ISSUED',
  'PASE_ESTABLISHED', 'ATTESTATION_VERIFIED', 'THREAD_PROVISIONING',
  'THREAD_ATTACHING', 'TEMP_FABRIC_COMMISSIONED', 'WINDOW_OPEN',
  'BBB_FABRIC_COMMISSIONING', 'ENDPOINT_DISCOVERY', 'SUBSCRIBING',
  'TEMP_FABRIC_REMOVING', 'CLEANUP_PENDING', 'COMPLETE',
  'INVALID_DEVICE', 'CLAIM_FAILED', 'BLE_TIMEOUT', 'PASE_FAILED',
  'ATTESTATION_FAILED', 'THREAD_ATTACH_FAILED', 'NODE_NOT_DISCOVERED',
  'BBB_COMMISSION_FAILED', 'SUBSCRIPTION_FAILED', 'TEMP_FABRIC_REMOVE_FAILED',
  'CANCELLED', 'EXPIRED',
])

export const CommissioningSessionCreateRequestSchema = z.object({
  claim_id: Base64UrlSchema.max(128),
  product_id: z.number().int().positive().max(0xffff),
  mobile_ephemeral_public_key: Base64UrlSchema.max(128),
}).strict()
export const CommissioningSessionCreateResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  challenge: Base64UrlSchema.max(128),
  expires_at: z.string().datetime(),
  state: z.literal('CLAIM_CHALLENGE'),
}).strict()
export const ClaimProofRequestSchema = z.object({
  device_nonce: Base64UrlSchema.max(128),
  proof: Base64UrlSchema.max(128),
  ble_address_hint: z.string().min(1).max(64).optional(),
}).strict()
export const EncryptedCommissioningGrantSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal('X25519-HKDF-SHA256-AES-256-GCM'),
  server_ephemeral_public_key: Base64UrlSchema.max(128),
  nonce: Base64UrlSchema.max(64),
  ciphertext: Base64UrlSchema,
  authentication_tag: Base64UrlSchema.max(64),
  transaction_id: z.string().uuid(),
  expires_at: z.string().datetime(),
}).strict()
export const ClaimProofResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  state: z.literal('GRANT_ISSUED'),
  grant: EncryptedCommissioningGrantSchema,
}).strict()
export const CommissioningSessionSchema = z.object({
  transaction_id: z.string().uuid(),
  claim_id: Base64UrlSchema.max(128),
  product_id: z.number().int().positive().max(0xffff),
  state: ServerProvisioningStateSchema,
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  temporary_node_id: z.string().optional(),
  bbb_node_id: z.string().optional(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).strict().optional(),
}).strict()
export const CommissioningWindowResponseSchema = z.object({
  session: CommissioningSessionSchema,
  descriptor: z.unknown(),
}).strict()
export const CommissioningNotificationSchema = z.object({
  type: z.literal('provisioning'),
  transaction_id: z.string().uuid(),
  state: ServerProvisioningStateSchema,
  timestamp: z.string().datetime(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).strict().optional(),
}).strict()
export const DeviceInventoryResponseSchema = z.object({ devices: z.array(z.object({ node_id: z.string(), descriptor: z.unknown() }).strict()) }).strict()

export type ServerProvisioningState = z.infer<typeof ServerProvisioningStateSchema>
export type CommissioningSession = z.infer<typeof CommissioningSessionSchema>
export type EncryptedCommissioningGrant = z.infer<typeof EncryptedCommissioningGrantSchema>
export type CommissioningNotification = z.infer<typeof CommissioningNotificationSchema>
export type CommissioningSessionCreateRequest = z.infer<typeof CommissioningSessionCreateRequestSchema>
