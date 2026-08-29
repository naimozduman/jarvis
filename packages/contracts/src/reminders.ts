import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

export const reminderKindSchema = z.enum([
  'fixed_time',
  'before_event',
  'after_event',
  'deadline_countdown',
  'context',
  'until_completed',
  'follow_up',
  'conditional',
  'open_loop',
  'recurring',
  'escalating',
]);

export const ghostingStateSchema = z.enum([
  'waiting',
  'follow_up_scheduled',
  'escalated',
  'replan_needed',
  'expired_without_completion',
  'needs_review',
]);

export const reminderProposalSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    commitmentId: uuidSchema.nullable(),
    kind: reminderKindSchema,
    title: z.string().trim().min(1).max(512),
    scheduledFor: utcTimestampSchema.nullable(),
    critical: z.boolean(),
    escalationLevel: z.number().int().min(0).max(5),
    groupedWithReminderIds: z.array(uuidSchema).max(12),
    rationale: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const quietModeSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    startsAt: utcTimestampSchema,
    endsAt: utcTimestampSchema.nullable(),
    reviewAt: utcTimestampSchema.nullable(),
    reason: z.string().trim().min(1).max(500).nullable(),
    active: z.boolean(),
  })
  .strict();

export type ReminderKind = z.infer<typeof reminderKindSchema>;
export type GhostingState = z.infer<typeof ghostingStateSchema>;
export type ReminderProposal = z.infer<typeof reminderProposalSchema>;
export type QuietMode = z.infer<typeof quietModeSchema>;
