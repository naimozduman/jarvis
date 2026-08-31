import { describe, expect, it } from 'vitest';

import {
  createConfiguredModelGateway,
  vercelAiGatewayResponsesUrl,
  type ModelGatewayRequest,
} from '@jarvis/brain';
import {
  EnvironmentValidationError,
  isVerifiedZeroCostGatewayRoute,
  loadApiEnvironment,
} from '@jarvis/config';

const ownerId = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000002';
const correlationId = '00000000-0000-4000-8000-000000000003';

function gatewayRequest(): ModelGatewayRequest {
  return {
    route: 'fast',
    instructions: 'Return a bounded structured response.',
    input: '{}',
    request: {
      id: requestId,
      ownerId,
      conversationId: null,
      sourceEventId: null,
      messageId: null,
      purpose: 'conversation',
      idempotencyKey: 'zero-cost-gateway-test-request-0001',
      correlationId,
      causationId: null,
      requestedAt: '2026-08-31T12:00:00.000Z',
      state: 'model_requested',
    },
    context: {
      request: {
        id: requestId,
        ownerId,
        conversationId: null,
        sourceEventId: null,
        messageId: null,
        purpose: 'conversation',
        idempotencyKey: 'zero-cost-gateway-test-request-0001',
        correlationId,
        causationId: null,
        requestedAt: '2026-08-31T12:00:00.000Z',
        state: 'model_requested',
      },
      now: '2026-08-31T12:00:00.000Z',
      records: [],
      manifest: {
        id: '00000000-0000-4000-8000-000000000004',
        ownerId,
        brainRequestId: requestId,
        contextVersion: 'test',
        promptTokenEstimate: 0,
        recordLimit: 1,
        selectedRecords: [],
        excludedRecordCount: 0,
        createdAt: '2026-08-31T12:00:00.000Z',
      },
      hardOverrideIds: [],
      availableData: [],
    },
  };
}

function zeroCostEnvironment(overrides: Record<string, string | undefined> = {}) {
  return loadApiEnvironment({
    APP_ENV: 'test',
    JARVIS_ZERO_COST_MODE: 'true',
    JARVIS_MODEL_PROVIDER: 'vercel-ai-gateway',
    VERCEL_OIDC_TOKEN: 'oidc-token-for-provider-free-unit-test-only',
    JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL: 'provider/possible-free-model',
    JARVIS_VERCEL_AI_GATEWAY_STANDARD_MODEL: 'provider/possible-free-model',
    JARVIS_VERCEL_AI_GATEWAY_DEEP_MODEL: 'provider/possible-free-model',
    ...overrides,
  });
}

describe('zero-cost Vercel AI Gateway boundary', () => {
  it('blocks direct paid OpenAI and Gateway API-key configuration when zero-cost mode is enabled', () => {
    expect(() =>
      loadApiEnvironment({
        APP_ENV: 'test',
        JARVIS_ZERO_COST_MODE: 'true',
        JARVIS_MODEL_PROVIDER: 'openai-responses',
        OPENAI_API_KEY: 'paid-direct-openai-key-must-not-be-used',
      }),
    ).toThrow(EnvironmentValidationError);
    expect(() =>
      zeroCostEnvironment({ AI_GATEWAY_API_KEY: 'paid-gateway-key-must-not-be-used' }),
    ).toThrow(EnvironmentValidationError);
  });

  it('does not infer free pricing from a model name and fails closed when the verifier allow-list is absent', async () => {
    const environment = zeroCostEnvironment();
    expect(isVerifiedZeroCostGatewayRoute(environment.model, 'fast')).toBe(false);

    const result = await createConfiguredModelGateway(environment.model).decide(gatewayRequest());
    expect(result).toMatchObject({
      status: 'not_configured',
      run: {
        configuredModelId: 'provider/possible-free-model',
        errorCategory: 'zero_cost_model_unverified',
      },
    });
  });

  it('permits only an exact deployment-verifier model allow-list and keeps OIDC at the Gateway boundary', () => {
    const environment = zeroCostEnvironment({
      JARVIS_ZERO_COST_VERIFIED_MODEL_IDS: 'provider/possible-free-model',
    });
    expect(isVerifiedZeroCostGatewayRoute(environment.model, 'fast')).toBe(true);
    expect(environment.model.apiKey).toBeUndefined();
    expect(environment.model.oidcToken).toBeDefined();
    expect(vercelAiGatewayResponsesUrl).toBe('https://ai-gateway.vercel.sh/v1');
  });

  it('reports a missing configured free model as explicitly unavailable instead of selecting a paid fallback', async () => {
    const environment = zeroCostEnvironment({
      JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL: undefined,
      JARVIS_VERCEL_AI_GATEWAY_STANDARD_MODEL: undefined,
      JARVIS_VERCEL_AI_GATEWAY_DEEP_MODEL: undefined,
      JARVIS_ZERO_COST_VERIFIED_MODEL_IDS: undefined,
    });
    const result = await createConfiguredModelGateway(environment.model).decide(gatewayRequest());
    expect(result).toMatchObject({
      status: 'not_configured',
      run: { configuredModelId: 'not_configured', errorCategory: 'zero_cost_model_unverified' },
    });
  });
});
