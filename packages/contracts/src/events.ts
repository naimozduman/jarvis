import { z } from 'zod';

import {
  causationIdSchema,
  correlationIdSchema,
  jsonObjectSchema,
  schemaVersionSchema,
  utcTimestampSchema,
  uuidSchema,
} from './common.js';

export const channelSchema = z.enum([
  'web',
  'whatsapp',
  'telegram',
  'ios',
  'poke',
  'system',
  'internal',
]);

export const eventSourceSchema = z.enum([
  'web',
  'whatsapp',
  'telegram',
  'ios',
  'poke',
  'system',
  'internal',
  'gmail',
  'google_calendar',
  'plaid',
  'whoop',
  'iron_and_intervals',
  'food_logging',
  'healthkit',
  'hermes',
]);
export const eventProcessingStatusSchema = z.enum([
  'received',
  'queued',
  'processing',
  'processed',
  'failed',
  'ignored',
]);

export const incomingEventEnvelopeSchema = z
  .object({
    eventType: z.string().trim().min(1).max(160),
    source: eventSourceSchema,
    sourceEventId: z.string().trim().min(1).max(512).optional(),
    idempotencyKey: z.string().trim().min(16).max(256),
    occurredAt: utcTimestampSchema,
    payload: jsonObjectSchema,
    schemaVersion: schemaVersionSchema,
    correlationId: correlationIdSchema.optional(),
    causationId: causationIdSchema.optional(),
  })
  .strict();

export const canonicalEventSchema = incomingEventEnvelopeSchema.extend({
  id: uuidSchema,
  ownerId: uuidSchema,
  receivedAt: utcTimestampSchema,
  processingStatus: eventProcessingStatusSchema,
  correlationId: correlationIdSchema,
});

export type Channel = z.infer<typeof channelSchema>;
export type EventSource = z.infer<typeof eventSourceSchema>;
export type EventProcessingStatus = z.infer<typeof eventProcessingStatusSchema>;
export type IncomingEventEnvelope = z.infer<typeof incomingEventEnvelopeSchema>;
export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;
