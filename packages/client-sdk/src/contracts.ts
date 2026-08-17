import { z } from 'zod'
import { CommissioningNotificationSchema } from './commissioning/contracts.js'

export const CLUSTERS = {
  OnOff: 0x0006,
  LevelControl: 0x0008,
  WindowCovering: 0x0102,
  VendorCooktop: 0xfc01,
} as const

export const TEST_VENDOR_ID = 0xfff1

const IdOrNameSchema = z.union([
  z.number().int().nonnegative().max(0xffff_ffff),
  z.string().min(1).max(64),
])

const NodeIdSchema = z.union([
  z.number().int().positive().safe(),
  z.string().regex(/^(?:0x)?[0-9a-fA-F]{1,16}$/),
])

const CommandRequestSchema = z.object({
  request_id: z.string().uuid(),
  node_id: NodeIdSchema,
  endpoint: z.number().int().nonnegative().max(0xffff),
  cluster: IdOrNameSchema,
  command: IdOrNameSchema,
  payload: z.record(z.unknown()).default({}),
}).strict()

export const CommandInputSchema = CommandRequestSchema.omit({ request_id: true }).strict()

const GatewayErrorSchema = z.object({
  code: z.enum([
    'INVALID_ENVELOPE',
    'UNKNOWN_CLUSTER',
    'UNKNOWN_COMMAND',
    'INVALID_PAYLOAD',
    'NODE_UNKNOWN',
    'NODE_UNREACHABLE',
    'TIMEOUT',
    'PAYLOAD_TOO_LARGE',
    'CONTROLLER_ERROR',
    'INTERNAL',
  ]),
  message: z.string(),
  details: z.unknown().optional(),
}).strict()

const ResponseBaseSchema = z.object({
  request_id: z.string().uuid().nullable(),
  node_id: z.string().nullable(),
  endpoint: z.number().int().nonnegative().nullable(),
  cluster: z.number().int().nonnegative().nullable(),
  command: z.number().int().nonnegative().nullable(),
  latency_ms: z.number().nonnegative(),
  timestamp: z.string().datetime(),
})

export const CommandResponseSchema = z.discriminatedUnion('status', [
  ResponseBaseSchema.extend({ status: z.literal('ok'), result: z.unknown() }).strict(),
  ResponseBaseSchema.extend({ status: z.literal('error'), error: GatewayErrorSchema }).strict(),
])

export const MatterEventSchema = z.object({
  type: z.literal('event'),
  request_id: z.null(),
  node_id: z.string(),
  endpoint: z.number().int().nonnegative(),
  cluster: z.number().int().nonnegative(),
  attributes: z.record(z.unknown()),
  timestamp: z.string().datetime(),
}).strict()

export const MobileSessionInfoSchema = z.object({
  authenticated: z.literal(true),
  username: z.string(),
  expires_at: z.string().datetime(),
}).strict()

export const MobileLoginResponseSchema = MobileSessionInfoSchema.extend({
  token: z.string().min(43).max(128),
}).strict()

export const ApiErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'CSRF_INVALID',
  'FORBIDDEN_ORIGIN',
  'RATE_LIMITED',
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'UPSTREAM_TIMEOUT',
  'MQTT_UNAVAILABLE',
  'INVALID_DEVICE',
  'CLAIM_NOT_FOUND',
  'CLAIM_INVALID',
  'CLAIM_REPLAYED',
  'CLAIM_EXPIRED',
  'CLAIM_RATE_LIMITED',
  'TRANSACTION_CONFLICT',
  'TRANSACTION_NOT_FOUND',
  'TRANSACTION_STATE_INVALID',
  'THREAD_ATTACH_FAILED',
  'BBB_COMMISSION_FAILED',
  'NODE_NOT_FOUND',
  'SUBSCRIPTION_FAILED',
  'CLEANUP_REQUIRED',
  'INTERNAL',
])

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  retry_after_s: z.number().optional(),
}).strict()

export const SseEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('response'), data: CommandResponseSchema }).strict(),
  z.object({ type: z.literal('event'), data: MatterEventSchema }).strict(),
  z.object({ type: z.literal('status'), data: z.record(z.unknown()) }).strict(),
  z.object({ type: z.literal('snapshot'), data: z.object({ devices: z.record(z.unknown()) }) }).strict(),
  CommissioningNotificationSchema,
])

export type CommandInput = z.infer<typeof CommandInputSchema>
export type CommandResponse = z.infer<typeof CommandResponseSchema>
export type MatterEvent = z.infer<typeof MatterEventSchema>
export type MobileSessionInfo = z.infer<typeof MobileSessionInfoSchema>
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>
export type SseEnvelope = z.infer<typeof SseEnvelopeSchema>
