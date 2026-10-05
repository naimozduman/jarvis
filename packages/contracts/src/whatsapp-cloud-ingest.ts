import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

const externalReferenceSchema = z.string().trim().min(1).max(512);
const messageTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i);
const messageTextSchema = z.string().max(10_000);
const opaqueCloudDeliveryTargetReferenceSchema = z
  .string()
  .regex(
    /^wa-cloud:bridge-conversation:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
const mediaSchema = z
  .object({
    provider_media_id: externalReferenceSchema.optional(),
    mime_type: z.string().trim().min(1).max(160).optional(),
    caption: messageTextSchema.optional(),
  })
  .strict();

export const jarvisWhatsAppCategorySchema = z.enum([
  'daily_plan',
  'food',
  'fitness',
  'work_money',
  'school',
  'reminders',
  'us',
  'uncategorized',
]);

export const whatsappCloudBridgeIngestEventSchema = z
  .object({
    schema_version: z.literal('1.0'),
    event_id: uuidSchema,
    event_type: z.literal('message.observed'),
    occurred_at: utcTimestampSchema,
    source: z
      .object({
        provider: z.literal('whatsapp'),
        transport: z.enum(['cloud_api', 'groups_api', 'third_party_agent']),
        message_id: externalReferenceSchema.nullable(),
        conversation_id: externalReferenceSchema,
        conversation_type: z.enum(['direct', 'group', 'agent', 'unknown']),
        /**
         * Bridge-owned opaque target handle. It is a bridge database UUID, never a Meta ID or
         * telephone number, and lets JARVIS later request a reply without learning either.
         */
        bridge_conversation_reference: opaqueCloudDeliveryTargetReferenceSchema.optional(),
        raw_record_id: externalReferenceSchema.optional(),
      })
      .strict(),
    actor: z
      .object({
        external_id: externalReferenceSchema.nullable(),
        // This is bridge-owned mapping metadata. The ingress route never lets it choose the
        // canonical owner and does not persist it until a dedicated identity-link flow exists.
        jarvis_person_id: z.string().trim().min(1).max(256).nullable(),
        display_name: z.string().max(256).nullable().optional(),
      })
      .strict(),
    scope: z
      .object({
        owner_jarvis_id: z.string().trim().min(1).max(160),
        category: jarvisWhatsAppCategorySchema,
      })
      .strict(),
    content: z
      .object({
        message_type: messageTypeSchema,
        text: messageTextSchema.nullable().optional(),
        media: z.array(mediaSchema).max(10).optional(),
      })
      .strict(),
    // The bridge may evolve transport diagnostics. Jarvis validates and intentionally drops this
    // free-form record at the privacy boundary rather than treating it as canonical state.
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict();

export type WhatsAppCloudBridgeIngestEvent = z.infer<typeof whatsappCloudBridgeIngestEventSchema>;

const opaqueCloudReferenceSchema = z.string().regex(/^wa-cloud:[a-z-]+:[a-f0-9]{64}$/);

/**
 * The only WhatsApp Cloud payload allowed into JARVIS canonical storage. It contains no raw Meta
 * identifiers, raw-webhook link, phone metadata, display name, or bridge metadata.
 */
export const whatsappCloudCanonicalPayloadSchema = z
  .object({
    kind: z.literal('whatsapp_cloud_message_observed'),
    transport: z.literal('cloud_api'),
    conversationType: z.literal('direct'),
    category: jarvisWhatsAppCategorySchema,
    conversationReference: opaqueCloudReferenceSchema,
    providerMessageReference: opaqueCloudReferenceSchema,
    participantReference: opaqueCloudReferenceSchema.nullable(),
    /** True only when the bridge's stable participant mapping resolved to this canonical owner. */
    ownerVerified: z.boolean(),
    /** Bridge-only opaque reference used for direct replies and future proactive owner delivery. */
    deliveryTargetReference: opaqueCloudDeliveryTargetReferenceSchema.nullable(),
    messageType: messageTypeSchema,
    text: messageTextSchema.nullable(),
    media: z
      .array(
        z
          .object({
            mimeType: z.string().trim().min(1).max(160).nullable(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export type WhatsAppCloudCanonicalPayload = z.infer<typeof whatsappCloudCanonicalPayloadSchema>;
