import { z } from 'zod';

import {
  causationIdSchema,
  correlationIdSchema,
  jsonObjectSchema,
  schemaVersionSchema,
  utcTimestampSchema,
  uuidSchema,
} from './common.js';

/**
 * Transport contracts intentionally use opaque references. A concrete adapter may temporarily
 * handle a provider JID or token, but it must not leak provider-specific identifiers into the
 * Brain-facing contract, logs, or model context.
 */
/**
 * A transport kind identifies the narrow delivery adapter only. It never changes the canonical
 * conversation, memory, policy, or Brain contract.
 */
export const messagingTransportKindSchema = z.enum([
  'evolution_whatsapp',
  'whatsapp_cloud',
  'telegram_bot',
]);

export const messagingConnectionStateSchema = z.enum([
  'disabled',
  'unconfigured',
  'connecting',
  'qr_required',
  'connected',
  'degraded',
  'reconnecting',
  'disconnected',
  'logged_out',
  'blocked',
  'incompatible_dependency',
  'license_required',
  'unknown',
]);

export const messagingConnectionReadinessSchema = z.enum([
  'not_configured',
  'configured',
  'version_verified',
  'reachable',
  'authenticated',
  'connected',
  'degraded',
  'blocked',
]);

export const messagingAddressKindSchema = z.enum(['phone', 'lid', 'alternate', 'opaque']);
export const opaqueMessagingReferenceSchema = z.string().trim().min(16).max(512);

export const messagingAddressSchema = z
  .object({
    transport: messagingTransportKindSchema,
    /** A classification only; it must not be used as an authorization decision. */
    kind: messagingAddressKindSchema,
    /** Stable, opaque/restricted reference rather than a raw JID or telephone number. */
    reference: opaqueMessagingReferenceSchema,
  })
  .strict();

export const inboundMessageTypeSchema = z.enum([
  'text',
  'image',
  'audio',
  'document',
  'location',
  'contact',
  'reaction',
  'message_edit',
  'message_delete',
  'unsupported',
]);

export const mediaMetadataSchema = z
  .object({
    mediaType: z.enum(['image', 'audio', 'document']),
    mimeType: z.string().trim().min(1).max(160).nullable(),
    byteLength: z.number().int().nonnegative().nullable(),
    fileName: z.string().trim().min(1).max(512).nullable(),
    /** A provider-safe media reference; no base64, raw bytes, or signed download URL. */
    providerMediaReference: opaqueMessagingReferenceSchema.nullable(),
  })
  .strict();

export const quotedMessageReferenceSchema = z
  .object({
    providerMessageReference: opaqueMessagingReferenceSchema,
    senderReference: opaqueMessagingReferenceSchema.nullable(),
    conversationReference: opaqueMessagingReferenceSchema.nullable(),
  })
  .strict();

export const normalizedInboundMessageSchema = z
  .object({
    transport: messagingTransportKindSchema,
    instanceReference: opaqueMessagingReferenceSchema,
    providerMessageReference: opaqueMessagingReferenceSchema,
    conversationReference: opaqueMessagingReferenceSchema,
    sender: messagingAddressSchema,
    messageType: inboundMessageTypeSchema,
    occurredAt: utcTimestampSchema,
    /** Text/caption only. Media bytes and raw provider payloads never enter this field. */
    text: z.string().max(8_000).nullable(),
    replyTo: quotedMessageReferenceSchema.nullable(),
    media: mediaMetadataSchema.nullable(),
    /** Message state supplied by the provider, never a commitment or plan completion signal. */
    deliveryState: z.string().trim().min(1).max(80).nullable(),
    metadata: jsonObjectSchema,
  })
  .strict();

export const messagingDeliveryStateSchema = z.enum([
  'pending',
  'leased',
  'sent',
  'delivered',
  'read',
  'failed_retryable',
  'failed_terminal',
]);

export const normalizedDeliveryUpdateSchema = z
  .object({
    transport: messagingTransportKindSchema,
    instanceReference: opaqueMessagingReferenceSchema,
    providerMessageReference: opaqueMessagingReferenceSchema,
    state: messagingDeliveryStateSchema,
    occurredAt: utcTimestampSchema,
    metadata: jsonObjectSchema,
  })
  .strict();

export const normalizedConnectionUpdateSchema = z
  .object({
    transport: messagingTransportKindSchema,
    instanceReference: opaqueMessagingReferenceSchema,
    state: messagingConnectionStateSchema,
    occurredAt: utcTimestampSchema,
    errorCategory: z.string().trim().min(1).max(80).nullable(),
    metadata: jsonObjectSchema,
  })
  .strict();

export const normalizedTransportEventKindSchema = z.enum([
  'message.received',
  'message.edited',
  'message.deleted',
  'delivery.updated',
  'connection.updated',
]);

/**
 * Provider-neutral event given to canonical ingress. An adapter does not select an owner or
 * mutate JARVIS state; the API binds an owner from trusted configuration after this parse.
 */
export const normalizedTransportEventSchema = z
  .object({
    kind: normalizedTransportEventKindSchema,
    transport: messagingTransportKindSchema,
    instanceReference: opaqueMessagingReferenceSchema,
    providerEventReference: opaqueMessagingReferenceSchema,
    idempotencyKey: z.string().trim().min(16).max(256),
    occurredAt: utcTimestampSchema,
    schemaVersion: schemaVersionSchema,
    message: normalizedInboundMessageSchema.nullable(),
    delivery: normalizedDeliveryUpdateSchema.nullable(),
    connection: normalizedConnectionUpdateSchema.nullable(),
    metadata: jsonObjectSchema,
  })
  .strict();

export const messagingTextSendRequestSchema = z
  .object({
    deliveryId: uuidSchema,
    ownerId: uuidSchema,
    connectionId: uuidSchema,
    targetReference: opaqueMessagingReferenceSchema,
    operationKey: z.string().trim().min(16).max(256),
    text: z.string().trim().min(1).max(4_000),
    correlationId: correlationIdSchema,
    causationId: causationIdSchema.nullable(),
  })
  .strict();

export const messagingMediaSendRequestSchema = z
  .object({
    deliveryId: uuidSchema,
    ownerId: uuidSchema,
    connectionId: uuidSchema,
    targetReference: opaqueMessagingReferenceSchema,
    operationKey: z.string().trim().min(16).max(256),
    objectReference: z.string().trim().min(1).max(1_024),
    mimeType: z.string().trim().min(1).max(160),
    fileName: z.string().trim().min(1).max(512).nullable(),
    caption: z.string().trim().min(1).max(4_000).nullable(),
    correlationId: correlationIdSchema,
    causationId: causationIdSchema.nullable(),
  })
  .strict();

export const messagingMarkReadRequestSchema = z
  .object({
    connectionId: uuidSchema,
    messageReference: opaqueMessagingReferenceSchema,
    conversationReference: opaqueMessagingReferenceSchema,
    correlationId: correlationIdSchema,
  })
  .strict();

export const messagingSendResultSchema = z
  .object({
    disposition: z.enum(['accepted', 'retryable_failure', 'terminal_failure', 'not_configured']),
    providerMessageReference: opaqueMessagingReferenceSchema.nullable(),
    acceptedAt: utcTimestampSchema.nullable(),
    errorCategory: z.string().trim().min(1).max(80).nullable(),
    /** A timeout after request dispatch requires reconciliation before any retry. */
    requiresReconciliation: z.boolean(),
    /** Only explicit provider nonacceptance may supply a safe retry wait. */
    retryAfterSeconds: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict();

export const messagingConnectionStatusSchema = z
  .object({
    transport: messagingTransportKindSchema,
    connectionId: uuidSchema,
    state: messagingConnectionStateSchema,
    readiness: messagingConnectionReadinessSchema,
    checkedAt: utcTimestampSchema,
    safeErrorCategory: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

/**
 * A generic outbox intent. It is created from an already-persisted JARVIS response/reminder and
 * contains no model-selected number, JID, provider credential, or arbitrary provider payload.
 */
export const outboundDeliveryIntentSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    messageId: uuidSchema,
    conversationId: uuidSchema,
    connectionId: uuidSchema,
    transport: messagingTransportKindSchema,
    targetReference: opaqueMessagingReferenceSchema,
    operationKey: z.string().trim().min(16).max(256),
    contentType: z.enum(['text', 'image', 'audio', 'document']),
    content: z.string().trim().min(1).max(4_000).nullable(),
    mediaObjectReference: z.string().trim().min(1).max(1_024).nullable(),
    sourceEventId: uuidSchema.nullable(),
    brainRequestId: uuidSchema.nullable(),
    reminderId: uuidSchema.nullable(),
    critical: z.boolean(),
    correlationId: correlationIdSchema,
    causationId: causationIdSchema.nullable(),
    createdAt: utcTimestampSchema,
  })
  .strict();

/**
 * Transport-neutral product intent emitted by the reminder engine. A worker later selects a
 * configured owner transport; reminder code never imports WhatsApp/Evolution types.
 */
export const proactiveDeliveryIntentSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    reminderId: uuidSchema,
    message: z.string().trim().min(1).max(4_000),
    critical: z.boolean(),
    correlationId: correlationIdSchema,
    causationId: causationIdSchema.nullable(),
    createdAt: utcTimestampSchema,
  })
  .strict();

export const messagingTransportHealthSchema = z
  .object({
    transport: messagingTransportKindSchema,
    configured: z.boolean(),
    versionVerified: z.boolean(),
    reachable: z.boolean(),
    authenticated: z.boolean(),
    connected: z.boolean(),
    state: messagingConnectionStateSchema,
    safeErrorCategory: z.string().trim().min(1).max(80).nullable(),
    checkedAt: utcTimestampSchema,
  })
  .strict();

export type MessagingTransportKind = z.infer<typeof messagingTransportKindSchema>;
export type MessagingConnectionState = z.infer<typeof messagingConnectionStateSchema>;
export type MessagingConnectionReadiness = z.infer<typeof messagingConnectionReadinessSchema>;
export type MessagingAddress = z.infer<typeof messagingAddressSchema>;
export type InboundMessageType = z.infer<typeof inboundMessageTypeSchema>;
export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;
export type NormalizedInboundMessage = z.infer<typeof normalizedInboundMessageSchema>;
export type MessagingDeliveryState = z.infer<typeof messagingDeliveryStateSchema>;
export type NormalizedDeliveryUpdate = z.infer<typeof normalizedDeliveryUpdateSchema>;
export type NormalizedConnectionUpdate = z.infer<typeof normalizedConnectionUpdateSchema>;
export type NormalizedTransportEvent = z.infer<typeof normalizedTransportEventSchema>;
export type MessagingTextSendRequest = z.infer<typeof messagingTextSendRequestSchema>;
export type MessagingMediaSendRequest = z.infer<typeof messagingMediaSendRequestSchema>;
export type MessagingMarkReadRequest = z.infer<typeof messagingMarkReadRequestSchema>;
export type MessagingSendResult = z.infer<typeof messagingSendResultSchema>;
export type MessagingConnectionStatus = z.infer<typeof messagingConnectionStatusSchema>;
export type OutboundDeliveryIntent = z.infer<typeof outboundDeliveryIntentSchema>;
export type ProactiveDeliveryIntent = z.infer<typeof proactiveDeliveryIntentSchema>;
export type MessagingTransportHealth = z.infer<typeof messagingTransportHealthSchema>;

/**
 * The sole provider-neutral outbound transport port. Brain and domain packages must never import
 * a concrete Evolution client; workers receive this port after durable outbox/policy processing.
 */
export interface MessagingTransport {
  readonly kind: MessagingTransportKind;
  sendText(input: MessagingTextSendRequest): Promise<MessagingSendResult>;
  sendImage(input: MessagingMediaSendRequest): Promise<MessagingSendResult>;
  sendAudio(input: MessagingMediaSendRequest): Promise<MessagingSendResult>;
  sendDocument(input: MessagingMediaSendRequest): Promise<MessagingSendResult>;
  markRead(input: MessagingMarkReadRequest): Promise<void>;
  getConnectionStatus(input: { readonly connectionId: string }): Promise<MessagingConnectionStatus>;
}
