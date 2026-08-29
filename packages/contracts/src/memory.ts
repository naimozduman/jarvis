import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

export const memoryCandidateKindSchema = z.enum([
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
]);

export const memoryAuthoritySchema = z.enum([
  'explicit_owner_statement',
  'owner_review',
  'trusted_source',
  'repeated_observation',
  'single_observation',
  'model_inference',
  'untrusted_external_content',
]);

export const memoryCandidateStateSchema = z.enum([
  'pending_review',
  'confirmed',
  'rejected',
  'superseded',
  'expired',
]);

export const memoryCandidateSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    kind: memoryCandidateKindSchema,
    normalizedStatement: z.string().trim().min(1).max(2_000),
    authority: memoryAuthoritySchema,
    sourceEventId: uuidSchema.nullable(),
    sourceMessageId: uuidSchema.nullable(),
    sourceDecisionId: uuidSchema.nullable(),
    evidenceIds: z.array(uuidSchema).min(1).max(24),
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
    sensitivity: z.enum(['normal', 'sensitive', 'restricted']),
    validFrom: utcTimestampSchema.nullable(),
    validTo: utcTimestampSchema.nullable(),
    reviewAt: utcTimestampSchema.nullable(),
    requiresOwnerConfirmation: z.boolean(),
    state: memoryCandidateStateSchema,
    relatedEntityIds: z.array(uuidSchema).max(24),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();

export const observationCandidateSchema = memoryCandidateSchema.extend({
  kind: z.literal('observation'),
});

export const hypothesisCandidateSchema = memoryCandidateSchema.extend({
  kind: z.literal('hypothesis'),
});

export const memoryEvidenceSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    memoryCandidateId: uuidSchema.nullable(),
    memoryRecordId: uuidSchema.nullable(),
    evidenceRecordId: uuidSchema,
    evidenceType: z.string().trim().min(1).max(80),
    authority: memoryAuthoritySchema,
    observedAt: utcTimestampSchema,
    confidenceDeltaBasisPoints: z.number().int().min(-10_000).max(10_000),
    createdAt: utcTimestampSchema,
  })
  .strict();

export type MemoryCandidateKind = z.infer<typeof memoryCandidateKindSchema>;
export type MemoryAuthority = z.infer<typeof memoryAuthoritySchema>;
export type MemoryCandidateState = z.infer<typeof memoryCandidateStateSchema>;
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
export type ObservationCandidate = z.infer<typeof observationCandidateSchema>;
export type HypothesisCandidate = z.infer<typeof hypothesisCandidateSchema>;
export type MemoryEvidence = z.infer<typeof memoryEvidenceSchema>;
