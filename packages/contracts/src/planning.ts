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
    // Missing on historical records: read with the legacy validator, never rewrite in place.
    contractVersion: z.literal('flexible_delta_v2').optional(),
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
    // Server-only bindings; absent on historical proposals. Never rewritten into old records.
    commitmentSchedules: z
      .array(z.object({ blockId: uuidSchema, commitmentId: uuidSchema }).strict())
      .max(80)
      .optional(),
    preservedBlockIds: z.array(uuidSchema).max(80).optional(),
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

/** Reserved separate contract; intentionally absent from the current model/action schemas. */
export const protectedPlanMutationSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('modify'),
      existingBlockId: uuidSchema,
      replacement: planBlockSchema,
    })
    .strict(),
  z.object({ operation: z.literal('remove'), existingBlockId: uuidSchema }).strict(),
]);

/** Typed canonical projection obtained from the owner-scoped repository, never model prose. */
export interface PlanningCommitment {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly priority: number;
  readonly status: string;
  readonly flexibility: string;
  readonly source: string;
}

export function schedulableCommitment(commitment: PlanningCommitment, ownerId: string): boolean {
  return (
    commitment.ownerId === ownerId &&
    commitment.flexibility !== 'fixed' &&
    ['open', 'in_progress', 'overdue', 'deferred'].includes(commitment.status)
  );
}

export function commitmentPlanBlock(input: {
  id: string;
  dayPlanId: string;
  commitment: PlanningCommitment;
  startsAt: string;
  endsAt: string;
}): PlanBlock {
  const { commitment } = input;
  return planBlockSchema.parse({
    id: input.id,
    ownerId: commitment.ownerId,
    dayPlanId: input.dayPlanId,
    commitmentId: commitment.id,
    title: commitment.title,
    priority: commitment.priority,
    role: 'commitment',
    anchorClass: 'commitment_linked',
    startAt: input.startsAt,
    endAt: input.endsAt,
    earliestStartAt: null,
    latestFinishAt: null,
    estimatedDurationMinutes: (Date.parse(input.endsAt) - Date.parse(input.startsAt)) / 60000,
    minimumDurationMinutes: null,
    dependencyIds: [],
    completionState: 'planned',
    reasonForPlacement: 'Schedule canonical commitment at the proposed time.',
    source: commitment.source,
  });
}
