import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

export const planBlockRoleSchema = z.enum([
  'commitment',
  'hard_external_anchor',
  'travel_buffer',
  'preparation_buffer',
  'sleep_window',
  'training_window',
  'work_block',
  'optional_block',
  'other',
]);

export const planAnchorClassSchema = z.enum([
  'hard_external_anchor',
  'fixed',
  'flexible',
  'preferred',
  'optional',
  'commitment_linked',
]);

export const planBlockSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    dayPlanId: uuidSchema,
    commitmentId: uuidSchema.nullable(),
    title: z.string().trim().min(1).max(512),
    role: planBlockRoleSchema,
    anchorClass: planAnchorClassSchema,
    priority: z.number().int().min(0).max(100),
    startAt: utcTimestampSchema.nullable(),
    endAt: utcTimestampSchema.nullable(),
    earliestStartAt: utcTimestampSchema.nullable(),
    latestFinishAt: utcTimestampSchema.nullable(),
    estimatedDurationMinutes: z.number().int().positive().max(1_440),
    minimumDurationMinutes: z.number().int().positive().max(1_440).nullable(),
    dependencyIds: z.array(uuidSchema).max(24),
    completionState: z.enum([
      'planned',
      'in_progress',
      'completed',
      'skipped',
      'moved',
      'cancelled',
    ]),
    reasonForPlacement: z.string().trim().min(1).max(1_000),
    source: z.string().trim().min(1).max(160),
  })
  .strict();

export const planProposalSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    dayPlanId: uuidSchema,
    trigger: z.enum([
      'late_wake_up',
      'missed_commitment',
      'unexpected_appointment',
      'new_deadline',
      'work_running_long',
      'free_time_opening',
      'task_overrun',
      'hard_override',
      'conflict',
      'insufficient_time',
    ]),
    proposedBlocks: z.array(planBlockSchema).max(80),
    tradeoffs: z.array(z.string().trim().min(1).max(500)).max(12),
    valid: z.boolean(),
    validationErrors: z.array(z.string().trim().min(1).max(500)).max(24),
    createdAt: utcTimestampSchema,
  })
  .strict();

export type PlanBlockRole = z.infer<typeof planBlockRoleSchema>;
export type PlanAnchorClass = z.infer<typeof planAnchorClassSchema>;
export type PlanBlock = z.infer<typeof planBlockSchema>;
export type PlanProposal = z.infer<typeof planProposalSchema>;
