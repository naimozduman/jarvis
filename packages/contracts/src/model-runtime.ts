import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

export const modelRouteSchema = z.enum(['fast', 'standard', 'deep']);
export const modelGatewayStatusSchema = z.enum([
  'completed',
  'not_configured',
  'unavailable',
  'configuration_error',
  'incomplete_output',
  'filtered',
  'refused',
  'invalid_model_output',
]);
export const modelProviderSchema = z.enum([
  'openai-responses',
  'vercel-ai-gateway',
  'fake',
  'not_configured',
]);

export const modelAdmissionProfileSchema = z
  .object({
    version: z.string(),
    modelId: z.string(),
    providerRoute: z.array(z.string()),
    contextWindowTokens: z.number().int().positive().nullable(),
    maximumOutputTokens: z.number().int().positive().nullable(),
    inputCostPerMillionUsd: z.number().nonnegative().nullable(),
    outputCostPerMillionUsd: z.number().nonnegative().nullable(),
    reasoningEffort: z.string(),
    requestedOutputControl: z.literal('max_output_tokens'),
    requestedOutputTokens: z.number().int().positive(),
    outputSemantics: z.enum([
      'total_including_reasoning',
      'provider_maximum_shared_context',
      'unverified',
    ]),
    lastObservedUsage: z
      .object({
        inputTokens: z.number().int().nonnegative().nullable(),
        outputTokens: z.number().int().nonnegative().nullable(),
        reasoningTokens: z.number().int().nonnegative().nullable(),
        requestedControlExceeded: z.boolean(),
        safetyBoundExceeded: z.boolean(),
        observedAt: utcTimestampSchema,
      })
      .strict()
      .optional(),
    reasoningCountsAgainstControl: z.boolean().nullable(),
    verificationState: z.enum(['verified', 'unverified', 'blocked']),
    verificationReason: z.string(),
    verifiedAt: utcTimestampSchema,
    nativeCounter: z.enum(['none', 'openai_responses_input_tokens']),
    sources: z.array(z.string()),
  })
  .strict();

export const modelRequestAdmissionSchema = z
  .object({
    requestHash: z.string(),
    modelId: z.string(),
    providerScope: z.string(),
    reasoningEffort: z.string(),
    measurementMethod: z.enum(['provider_count', 'conservative_utf8', 'unavailable']),
    estimationVersion: z.string().optional(),
    safetyFactor: z.number().positive().optional(),
    framingAllowanceTokens: z.number().int().nonnegative().optional(),
    dynamicContextEstimate: z.number().int().nonnegative().optional(),
    dynamicContextBudgetTokens: z.number().int().positive().optional(),
    contextWindowTokens: z.number().int().positive().nullable().optional(),
    profile: modelAdmissionProfileSchema.optional(),
    measuredInputTokens: z.number().int().nonnegative().nullable(),
    safetyMarginTokens: z.number().int().nonnegative(),
    fullRequestInputTokens: z.number().int().nonnegative().nullable(),
    maxInputTokens: z.number().int().positive().nullable(),
    maxOutputTokens: z.number().int().positive(),
    outputSafetyBoundTokens: z.number().int().positive().nullable().optional(),
    worstCaseCostUsd: z.number().nonnegative().nullable().optional(),
    outputLimitSemantics: z.enum([
      'total_including_reasoning',
      'provider_maximum_shared_context',
      'unverified',
    ]),
    allowed: z.boolean(),
    reason: z.string(),
    errorCategory: z.string().nullable(),
    requestBytes: z.number().int().nonnegative(),
    instructionsBytes: z.number().int().nonnegative(),
    inputBytes: z.number().int().nonnegative(),
    schemaBytes: z.number().int().nonnegative(),
    measuredAt: utcTimestampSchema,
  })
  .strict();

export const modelUsageAccountingSchema = z
  .object({
    providerTotalOutputTokens: z.number().int().nonnegative().nullable(),
    nonReasoningOutputTokens: z.number().int().nonnegative().nullable(),
    visibleOutputTokens: z.number().int().nonnegative().nullable(),
    reasoningTokens: z.number().int().nonnegative().nullable(),
    visibleMeasurement: z.literal('unreported'),
    inputBoundExceeded: z.boolean(),
    outputBoundExceeded: z.boolean(),
    requestedOutputControlExceeded: z.boolean().optional(),
    contextBoundExceeded: z.boolean().optional(),
    profileAfterRun: modelAdmissionProfileSchema.optional(),
    usageValid: z.boolean(),
  })
  .strict();

export const modelRunSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    brainRequestId: uuidSchema,
    provider: modelProviderSchema,
    route: modelRouteSchema,
    configuredModelId: z.string().trim().min(1).max(160),
    actualModelId: z.string().trim().min(1).max(160).nullable(),
    reasoningEffort: z.string().trim().min(1).max(32).nullable(),
    status: modelGatewayStatusSchema,
    latencyMs: z.number().int().min(0).nullable(),
    inputTokens: z.number().int().min(0).nullable(),
    outputTokens: z.number().int().min(0).nullable(),
    reasoningTokens: z.number().int().min(0).nullable(),
    cachedInputTokens: z.number().int().min(0).nullable(),
    estimatedCostUsd: z.number().min(0).nullable(),
    admission: modelRequestAdmissionSchema.optional(),
    usageAccounting: modelUsageAccountingSchema.optional(),
    outputAudit: z
      .object({
        contractVersion: z.literal('flexible_delta_v2'),
        responseTextSha256: z.string().length(64),
        schemaValid: z.boolean(),
        issuePaths: z.array(z.string()).max(32),
        // Restricted owner-scoped audit text, never an executable proposal or normal telemetry.
        planJson: z.string().max(65536).nullable(),
        planJsonTruncated: z.boolean(),
      })
      .strict()
      .optional(),
    errorCategory: z.string().trim().min(1).max(80).nullable(),
    createdAt: utcTimestampSchema,
  })
  .strict();

export type ModelRoute = z.infer<typeof modelRouteSchema>;
export type ModelGatewayStatus = z.infer<typeof modelGatewayStatusSchema>;
export type ModelRun = z.infer<typeof modelRunSchema>;
export type ModelRequestAdmission = z.infer<typeof modelRequestAdmissionSchema>;
export type ModelAdmissionProfile = z.infer<typeof modelAdmissionProfileSchema>;

/** Reviewed v3 Muse semantics may supersede only the old requested-output cap violation. */
export function isModelAccountingSafe(
  accounting: ModelRun['usageAccounting'],
  previous: ModelRequestAdmission | null | undefined,
  current: ModelRequestAdmission | undefined,
  inputTokens: number | null,
): boolean {
  if (!accounting) return false;
  if (!accounting.usageValid || accounting.inputBoundExceeded || accounting.contextBoundExceeded)
    return false;
  if (!accounting.outputBoundExceeded) return true;
  return (
    current?.allowed === true &&
    current.profile?.version === 'model-admission-v3-20260929' &&
    current.modelId === 'meta/muse-spark-1.3-contributor' &&
    current.outputLimitSemantics === 'provider_maximum_shared_context' &&
    previous?.modelId === current.modelId &&
    previous.profile?.version === 'model-admission-v2-20260929' &&
    previous.outputLimitSemantics !== 'provider_maximum_shared_context' &&
    inputTokens !== null &&
    accounting.providerTotalOutputTokens !== null &&
    current.outputSafetyBoundTokens != null &&
    current.contextWindowTokens != null &&
    accounting.providerTotalOutputTokens <= current.outputSafetyBoundTokens &&
    inputTokens + accounting.providerTotalOutputTokens <= current.contextWindowTokens
  );
}
