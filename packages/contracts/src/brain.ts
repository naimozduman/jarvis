import { z } from 'zod';

import {
  causationIdSchema,
  correlationIdSchema,
  jsonObjectSchema,
  utcTimestampSchema,
  uuidSchema,
} from './common.js';
import { memoryCandidateSchema } from './memory.js';
import { planProposalSchema } from './planning.js';
import { reminderProposalSchema } from './reminders.js';

/**
 * These values deliberately describe the *epistemic state* of a record, rather than its database
 * lifecycle. A caller must not upgrade inferred or stale information to known data merely because
 * a model used it in a response.
 */
export const informationStateSchema = z.enum([
  'known',
  'inferred',
  'conflicting',
  'missing',
  'stale',
  'not_connected',
]);

export const brainRequestPurposeSchema = z.enum([
  'conversation',
  'classification',
  'memory_extraction',
  'accountability',
  'replan',
  'reminder',
  'weekly_review',
  'clarification',
]);

export const brainRequestStateSchema = z.enum([
  'received',
  'context_assembled',
  'model_requested',
  'decision_persisted',
  'completed',
  'not_configured',
  'failed',
]);

export const brainDecisionTypeSchema = z.enum([
  'answer',
  'capture',
  'clarify',
  'remind',
  'replan',
  'negotiate',
  'summarize',
  'alert',
  'propose_action',
  'request_approval',
  'no_message',
]);

export const brainEvidenceSchema = z
  .object({
    recordId: uuidSchema,
    recordType: z.string().trim().min(1).max(80),
    source: z.string().trim().min(1).max(160),
    informationState: informationStateSchema,
    observedAt: utcTimestampSchema.nullable(),
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
    sensitivity: z.enum(['normal', 'sensitive', 'restricted']),
  })
  .strict();

export const brainReasoningSummarySchema = z
  .object({
    decisionSummary: z.string().trim().min(1).max(2_000),
    importantEvidenceIds: z.array(uuidSchema).max(24),
    materialTradeoffs: z.array(z.string().trim().min(1).max(500)).max(8),
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
    missingInformation: z.array(z.string().trim().min(1).max(500)).max(8),
  })
  .strict();

export const clarificationRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(500),
    blocking: z.boolean(),
    relatedRecordIds: z.array(uuidSchema).max(12),
  })
  .strict();

/**
 * This is intentionally a strict intent envelope instead of an arbitrary action payload. The
 * server maps a recognized intent to a typed persisted ProposedAction and creates its identifier,
 * idempotency key, and payload. Unknown intents are still safe to record and deny through policy.
 */
export const modelActionProposalSchema = z
  .object({
    actionType: z.string().trim().min(1).max(160),
    riskClass: z.enum(['READ', 'LOW_RISK_INTERNAL', 'CONTROLLED_WRITE', 'HIGH_IMPACT']),
    targetRecordId: uuidSchema.nullable(),
    title: z.string().trim().min(1).max(512).nullable(),
    scheduledFor: utcTimestampSchema.nullable(),
    completionEvidenceId: uuidSchema.nullable(),
    planProposalReference: z.string().trim().min(1).max(160).nullable(),
    rationale: z.string().trim().min(1).max(1_000),
    evidenceIds: z.array(uuidSchema).max(24),
  })
  .strict();

export const conversationResponseSchema = z
  .object({
    message: z.string().trim().min(1).max(4_000),
    nextAction: z.string().trim().min(1).max(500).nullable(),
    tone: z.enum(['direct', 'warm', 'neutral', 'supportive']),
  })
  .strict();

export const interventionProposalSchema = z
  .object({
    interventionId: z.string().trim().min(1).max(160),
    purpose: z.string().trim().min(1).max(1_000),
    commitmentId: uuidSchema.nullable(),
    contextKey: z.string().trim().min(1).max(512),
    rationale: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const brainRequestSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    conversationId: uuidSchema.nullable(),
    sourceEventId: uuidSchema.nullable(),
    messageId: uuidSchema.nullable(),
    purpose: brainRequestPurposeSchema,
    idempotencyKey: z.string().trim().min(16).max(256),
    correlationId: correlationIdSchema,
    causationId: causationIdSchema.nullable(),
    requestedAt: utcTimestampSchema,
    state: brainRequestStateSchema,
  })
  .strict();

export const contextRecordSchema = z
  .object({
    recordId: uuidSchema,
    recordType: z.string().trim().min(1).max(80),
    ownerId: uuidSchema,
    source: z.string().trim().min(1).max(160),
    informationState: informationStateSchema,
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
    sensitivity: z.enum(['normal', 'sensitive', 'restricted']),
    observedAt: utcTimestampSchema.nullable(),
    content: z.string().trim().min(1).max(8_000),
    entityReferences: z.array(uuidSchema).max(24),
    constitutionalRelevance: z.number().int().min(0).max(100),
    activeCommitmentRelevance: z.number().int().min(0).max(100),
    deadlineProximityMinutes: z.number().int().min(0).nullable(),
    currentDayRelevance: z.number().int().min(0).max(100),
    sourceAuthority: z.number().int().min(0).max(100),
  })
  .strict();

export const contextManifestRecordSchema = z
  .object({
    recordId: uuidSchema,
    recordType: z.string().trim().min(1).max(80),
    rank: z.number().int().positive(),
    score: z.number().int().min(0).max(100_000),
    selectionReasons: z.array(z.string().trim().min(1).max(120)).max(12),
    sensitivity: z.enum(['normal', 'sensitive', 'restricted']),
    redactedForModel: z.boolean(),
  })
  .strict();

export const contextManifestSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    brainRequestId: uuidSchema,
    contextVersion: z.string().trim().min(1).max(64),
    promptTokenEstimate: z.number().int().min(0),
    recordLimit: z.number().int().positive(),
    selectedRecords: z.array(contextManifestRecordSchema),
    excludedRecordCount: z.number().int().min(0),
    createdAt: utcTimestampSchema,
  })
  .strict();

export const brainContextSchema = z
  .object({
    request: brainRequestSchema,
    now: utcTimestampSchema,
    records: z.array(contextRecordSchema),
    manifest: contextManifestSchema,
    hardOverrideIds: z.array(uuidSchema),
    availableData: z.array(
      z
        .object({
          domain: z.string().trim().min(1).max(80),
          state: informationStateSchema,
        })
        .strict(),
    ),
  })
  .strict();

/**
 * Root-object envelope for OpenAI Structured Outputs. All model-visible fields are required. The
 * nullable extension slots are parsed into narrow Phase 2 services after this structural check.
 */
export const brainDecisionSchema = z
  .object({
    decisionType: brainDecisionTypeSchema,
    conversationResponse: conversationResponseSchema.nullable(),
    reasoningSummary: brainReasoningSummarySchema,
    evidence: z.array(brainEvidenceSchema).max(24),
    clarification: clarificationRequestSchema.nullable(),
    proposedActions: z.array(modelActionProposalSchema).max(12),
    memoryCandidates: z.array(memoryCandidateSchema).max(24),
    planProposal: planProposalSchema.nullable(),
    reminderProposal: reminderProposalSchema.nullable(),
    interventionProposal: interventionProposalSchema.nullable(),
  })
  .strict();

export const brainResponseSchema = z
  .object({
    requestId: uuidSchema,
    status: z.enum([
      'completed',
      'duplicate',
      'not_configured',
      'provider_unavailable',
      'invalid_model_output',
      'failed',
    ]),
    decisionId: uuidSchema.nullable(),
    conversationResponse: conversationResponseSchema.nullable(),
    actionIds: z.array(uuidSchema),
    approvalRequested: z.boolean(),
    safeError: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();

export const brainTelemetrySchema = z
  .object({
    brainRequestId: uuidSchema,
    correlationId: correlationIdSchema,
    ownerReference: z.string().trim().min(12).max(128),
    promptVersion: z.string().trim().min(1).max(256),
    contextManifestId: uuidSchema.nullable(),
    modelRoute: z.enum(['fast', 'standard', 'deep']).nullable(),
    modelId: z.string().trim().min(1).max(160).nullable(),
    latencyMs: z.number().int().min(0).nullable(),
    inputTokens: z.number().int().min(0).nullable(),
    outputTokens: z.number().int().min(0).nullable(),
    estimatedCostUsd: z.number().min(0).nullable(),
    decisionType: brainDecisionTypeSchema.nullable(),
    validationSuccess: z.boolean(),
    policyResult: z.enum(['allowed', 'approval', 'denied', 'not_applicable']).nullable(),
    actionCount: z.number().int().min(0),
    errorCategory: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

export type InformationState = z.infer<typeof informationStateSchema>;
export type BrainRequestPurpose = z.infer<typeof brainRequestPurposeSchema>;
export type BrainRequestState = z.infer<typeof brainRequestStateSchema>;
export type BrainDecisionType = z.infer<typeof brainDecisionTypeSchema>;
export type BrainEvidence = z.infer<typeof brainEvidenceSchema>;
export type BrainReasoningSummary = z.infer<typeof brainReasoningSummarySchema>;
export type ClarificationRequest = z.infer<typeof clarificationRequestSchema>;
export type ModelActionProposal = z.infer<typeof modelActionProposalSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type InterventionProposal = z.infer<typeof interventionProposalSchema>;
export type BrainRequest = z.infer<typeof brainRequestSchema>;
export type ContextRecord = z.infer<typeof contextRecordSchema>;
export type ContextManifestRecord = z.infer<typeof contextManifestRecordSchema>;
export type ContextManifest = z.infer<typeof contextManifestSchema>;
export type BrainContext = z.infer<typeof brainContextSchema>;
export type BrainDecision = z.infer<typeof brainDecisionSchema>;
export type BrainResponse = z.infer<typeof brainResponseSchema>;
export type BrainTelemetry = z.infer<typeof brainTelemetrySchema>;

/** A safe, serializable payload used only for internal persistence extensions. */
export const brainSafeMetadataSchema = jsonObjectSchema;
