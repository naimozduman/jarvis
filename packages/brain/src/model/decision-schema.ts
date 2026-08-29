import { z } from 'zod';

import {
  brainDecisionTypeSchema,
  conversationResponseSchema,
  informationStateSchema,
  interventionProposalSchema,
  modelActionProposalSchema,
} from '@jarvis/contracts';
import { utcTimestampSchema, uuidSchema } from '@jarvis/contracts';

/**
 * The schema exposed to a model is intentionally narrower than the application decision schema.
 * Identifiers, ownership, timestamps, and durable state are always assigned by the server after
 * validation. This makes a model output an intent document rather than a database mutation.
 *
 * Every property is required (nullable where an absence is meaningful) because OpenAI Structured
 * Outputs requires a strict object schema with no optional properties.
 */
export const modelMemoryCandidateSchema = z
  .object({
    kind: z.enum([
      'fact',
      'preference',
      'person',
      'relationship',
      'project',
      'observation',
      'hypothesis',
      'open_loop',
      'personality_trait',
      'constitution_candidate',
    ]),
    normalizedStatement: z.string().trim().min(1).max(2_000),
    authority: z.enum([
      'explicit_owner_statement',
      'owner_review',
      'trusted_source',
      'repeated_observation',
      'single_observation',
      'model_inference',
      'untrusted_external_content',
    ]),
    evidenceIds: z.array(uuidSchema).min(1).max(24),
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
    sensitivity: z.enum(['normal', 'sensitive', 'restricted']),
    validFrom: utcTimestampSchema.nullable(),
    validTo: utcTimestampSchema.nullable(),
    reviewAt: utcTimestampSchema.nullable(),
    requiresOwnerConfirmation: z.boolean(),
    relatedEntityIds: z.array(uuidSchema).max(24),
  })
  .strict();

export const modelPlanBlockSchema = z
  .object({
    reference: z.string().trim().min(1).max(160),
    /** Reference an existing block only when preserving or relocating a known server-owned block. */
    existingBlockId: uuidSchema.nullable(),
    commitmentId: uuidSchema.nullable(),
    title: z.string().trim().min(1).max(512),
    role: z.enum([
      'commitment',
      'hard_external_anchor',
      'travel_buffer',
      'preparation_buffer',
      'sleep_window',
      'training_window',
      'work_block',
      'optional_block',
      'other',
    ]),
    anchorClass: z.enum([
      'hard_external_anchor',
      'fixed',
      'flexible',
      'preferred',
      'optional',
      'commitment_linked',
    ]),
    priority: z.number().int().min(0).max(100),
    startAt: utcTimestampSchema.nullable(),
    endAt: utcTimestampSchema.nullable(),
    earliestStartAt: utcTimestampSchema.nullable(),
    latestFinishAt: utcTimestampSchema.nullable(),
    estimatedDurationMinutes: z.number().int().positive().max(1_440),
    minimumDurationMinutes: z.number().int().positive().max(1_440).nullable(),
    dependencyIds: z.array(uuidSchema).max(24),
    reasonForPlacement: z.string().trim().min(1).max(1_000),
    source: z.string().trim().min(1).max(160),
  })
  .strict();

export const modelPlanProposalSchema = z
  .object({
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
    proposedBlocks: z.array(modelPlanBlockSchema).max(80),
    tradeoffs: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict();

export const modelReminderProposalSchema = z
  .object({
    commitmentId: uuidSchema.nullable(),
    kind: z.enum([
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
    ]),
    title: z.string().trim().min(1).max(512),
    scheduledFor: utcTimestampSchema.nullable(),
    critical: z.boolean(),
    escalationLevel: z.number().int().min(0).max(5),
    groupedWithReminderIds: z.array(uuidSchema).max(12),
    rationale: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const modelReasoningSummarySchema = z
  .object({
    decisionSummary: z.string().trim().min(1).max(2_000),
    importantEvidenceIds: z.array(uuidSchema).max(24),
    materialTradeoffs: z.array(z.string().trim().min(1).max(500)).max(8),
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
    missingInformation: z.array(z.string().trim().min(1).max(500)).max(8),
  })
  .strict();

export const modelClarificationRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(500),
    blocking: z.boolean(),
    relatedRecordIds: z.array(uuidSchema).max(12),
  })
  .strict();

export const modelEvidenceReferenceSchema = z
  .object({
    recordId: uuidSchema,
    informationState: informationStateSchema,
  })
  .strict();

export const modelDecisionEnvelopeSchema = z
  .object({
    decisionType: brainDecisionTypeSchema,
    conversationResponse: conversationResponseSchema.nullable(),
    reasoningSummary: modelReasoningSummarySchema,
    evidence: z.array(modelEvidenceReferenceSchema).max(24),
    clarification: modelClarificationRequestSchema.nullable(),
    proposedActions: z.array(modelActionProposalSchema).max(12),
    memoryCandidates: z.array(modelMemoryCandidateSchema).max(24),
    planProposal: modelPlanProposalSchema.nullable(),
    reminderProposal: modelReminderProposalSchema.nullable(),
    interventionProposal: interventionProposalSchema.nullable(),
  })
  .strict();

export type ModelMemoryCandidate = z.infer<typeof modelMemoryCandidateSchema>;
export type ModelPlanBlock = z.infer<typeof modelPlanBlockSchema>;
export type ModelPlanProposal = z.infer<typeof modelPlanProposalSchema>;
export type ModelReminderProposal = z.infer<typeof modelReminderProposalSchema>;
export type ModelDecisionEnvelope = z.infer<typeof modelDecisionEnvelopeSchema>;
