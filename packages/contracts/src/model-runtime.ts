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
    errorCategory: z.string().trim().min(1).max(80).nullable(),
    createdAt: utcTimestampSchema,
  })
  .strict();

export type ModelRoute = z.infer<typeof modelRouteSchema>;
export type ModelGatewayStatus = z.infer<typeof modelGatewayStatusSchema>;
export type ModelRun = z.infer<typeof modelRunSchema>;
