import { z } from 'zod';

import {
  causationIdSchema,
  correlationIdSchema,
  jsonObjectSchema,
  utcTimestampSchema,
  uuidSchema,
} from './common.js';

export const durableJobStatusSchema = z.enum([
  'queued',
  'leased',
  'retry_wait',
  'completed',
  'terminal_failed',
  'cancelled',
]);

export const jobErrorCategorySchema = z.enum([
  'transient_database',
  'transient_network',
  'timeout',
  'rate_limited',
  'concurrency_conflict',
  'validation',
  'unauthorized',
  'policy_denied',
  'unsupported_schema',
  'invariant_violation',
  'cancelled',
  'expired',
  'unknown',
]);

export const durableJobInputSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  jobType: z.string().trim().min(1).max(160),
  payload: jsonObjectSchema,
  priority: z.number().int().min(-100).max(100).default(0),
  scheduledFor: utcTimestampSchema,
  availableAfter: utcTimestampSchema,
  maximumAttempts: z.number().int().min(1).max(20).default(5),
  correlationId: correlationIdSchema,
  causationId: causationIdSchema.optional(),
  sourceEventId: uuidSchema.optional(),
  idempotencyKey: z.string().trim().min(16).max(256),
});

export const durableJobSchema = durableJobInputSchema.extend({
  status: durableJobStatusSchema,
  attemptCount: z.number().int().min(0),
  leaseOwner: z.string().trim().min(1).max(160).nullable(),
  leaseExpiresAt: utcTimestampSchema.nullable(),
  lastErrorCategory: jobErrorCategorySchema.nullable(),
  lastErrorSummary: z.string().trim().min(1).max(1_000).nullable(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  completedAt: utcTimestampSchema.nullable(),
});

export type DurableJobStatus = z.infer<typeof durableJobStatusSchema>;
export type JobErrorCategory = z.infer<typeof jobErrorCategorySchema>;
export type DurableJobInput = z.infer<typeof durableJobInputSchema>;
export type DurableJob = z.infer<typeof durableJobSchema>;
