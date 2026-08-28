import { z } from 'zod';

import {
  causationIdSchema,
  correlationIdSchema,
  jsonObjectSchema,
  utcTimestampSchema,
  uuidSchema,
} from './common.js';

export const actionRiskClassSchema = z.enum([
  'READ',
  'LOW_RISK_INTERNAL',
  'CONTROLLED_WRITE',
  'HIGH_IMPACT',
]);

export const proposedActionStateSchema = z.enum([
  'proposed',
  'policy_allowed',
  'awaiting_approval',
  'approved',
  'rejected',
  'executed',
  'failed',
  'cancelled',
  'expired',
  'denied',
]);

export const approvalStateSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'consumed',
]);

export const proposedActionSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  actionType: z.string().trim().min(1).max(160),
  payload: jsonObjectSchema,
  riskClass: actionRiskClassSchema,
  idempotencyKey: z.string().trim().min(16).max(256),
  sourceEventId: uuidSchema.optional(),
  sourceDecisionId: uuidSchema.optional(),
  correlationId: correlationIdSchema,
  causationId: causationIdSchema.optional(),
  state: proposedActionStateSchema,
  expiresAt: utcTimestampSchema.nullable(),
});

export const policyEvaluationSchema = z.object({
  allowed: z.boolean(),
  requiresApproval: z.boolean(),
  denied: z.boolean(),
  reason: z.string().trim().min(1).max(1_000),
  policyVersion: z.string().trim().min(1).max(64),
  matchedRules: z.array(z.string().trim().min(1)).readonly(),
});

export const approvalRequestSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  proposedActionId: uuidSchema,
  riskClass: actionRiskClassSchema,
  actionSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: approvalStateSchema,
  requestedAt: utcTimestampSchema,
  expiresAt: utcTimestampSchema,
  resolvedAt: utcTimestampSchema.nullable(),
  actorId: uuidSchema.nullable(),
  result: jsonObjectSchema.nullable(),
});

export type ActionRiskClass = z.infer<typeof actionRiskClassSchema>;
export type ProposedActionState = z.infer<typeof proposedActionStateSchema>;
export type ApprovalState = z.infer<typeof approvalStateSchema>;
export type ProposedAction = z.infer<typeof proposedActionSchema>;
export type PolicyEvaluation = z.infer<typeof policyEvaluationSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
