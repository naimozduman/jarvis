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

export const modelScheduleCommitmentSchema = z
  .object({
    operation: z.literal('schedule_existing_commitment'),
    commitmentId: uuidSchema,
    startsAt: utcTimestampSchema,
    endsAt: utcTimestampSchema,
  })
  .strict();

/** New free-form blocks require a matching trusted owner creation authorization. */
export const modelPlanBlockSchema = z
  .object({
    title: z.string().trim().min(1).max(512),
    startsAt: utcTimestampSchema,
    endsAt: utcTimestampSchema,
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
    operations: z.array(modelScheduleCommitmentSchema).max(80),
    newFlexibleBlocks: z.array(modelPlanBlockSchema).max(80),
    tradeoffs: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict();

export const modelReminderProposalSchema = z
  .object({
    commitmentId: uuidSchema.nullable(),
    title: z.string().trim().min(1).max(512),
    timeExpression: z.string().trim().min(1).max(160).nullable(),
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
