import { z } from 'zod';

import {
  causationIdSchema,
  correlationIdSchema,
  jsonObjectSchema,
  utcTimestampSchema,
  uuidSchema,
} from './common.js';

export const auditActorTypeSchema = z.enum(['owner', 'system', 'service', 'connector', 'worker']);

export const auditStateReferenceSchema = z.object({
  entityType: z.string().trim().min(1).max(160),
  entityId: uuidSchema,
  version: z.number().int().positive().optional(),
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});

export const auditEventInputSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  actorType: auditActorTypeSchema,
  actorId: uuidSchema.nullable(),
  action: z.string().trim().min(1).max(160),
  targetType: z.string().trim().min(1).max(160),
  targetId: uuidSchema,
  occurredAt: utcTimestampSchema,
  correlationId: correlationIdSchema,
  causationId: causationIdSchema.optional(),
  previousState: auditStateReferenceSchema.nullable(),
  resultingState: auditStateReferenceSchema.nullable(),
  reason: z.string().trim().min(1).max(1_000).nullable(),
  source: z.string().trim().min(1).max(160),
  metadata: jsonObjectSchema,
});

export type AuditActorType = z.infer<typeof auditActorTypeSchema>;
export type AuditStateReference = z.infer<typeof auditStateReferenceSchema>;
export type AuditEventInput = z.infer<typeof auditEventInputSchema>;
