import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredModelGateway,
  ModelBudgetGuard,
  reportedGatewayCostUsd,
  vercelAiGatewayResponsesUrl,
  VercelAiGatewayModelGateway,
  type ModelBudgetUsage,
  type VercelAiGatewayClient,
  type ModelGatewayRequest,
} from '@jarvis/brain';
import {
  EnvironmentValidationError,
  isVerifiedZeroCostGatewayRoute,
  loadApiEnvironment,
  type OpenAiModelRouteConfiguration,
} from '@jarvis/config';
import type { ModelAdmissionProfile } from '@jarvis/contracts';

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

function guardedZeroCostEnvironment(overrides: Record<string, string | undefined> = {}) {
  return zeroCostEnvironment({
    JARVIS_ZERO_COST_VERIFIED_MODEL_IDS: 'provider/possible-free-model',
    JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD: '0',
    JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_AS_OF: '2026-09-01T00:00:00.000Z',
    // Nonzero provider list rates are deliberately compatible with Vercel's Free Tier. They are
    // only a conservative preflight bound against included credits, never eligibility evidence.
    JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION: '0.3',
    JARVIS_VERCEL_AI_GATEWAY_FAST_OUTPUT_COST_PER_MILLION: '1.2',
    JARVIS_VERCEL_AI_GATEWAY_STANDARD_INPUT_COST_PER_MILLION: '0.3',
    JARVIS_VERCEL_AI_GATEWAY_STANDARD_OUTPUT_COST_PER_MILLION: '1.2',
    JARVIS_VERCEL_AI_GATEWAY_DEEP_INPUT_COST_PER_MILLION: '0.3',
    JARVIS_VERCEL_AI_GATEWAY_DEEP_OUTPUT_COST_PER_MILLION: '1.2',
    ...overrides,
  });
}

function guardUsage(overrides: Partial<ModelBudgetUsage> = {}): ModelBudgetUsage {
  return {
    callsAlreadyMade: 0,
    dailySpendEstimateUsd: 0,
    dailyDeepCallsUsed: 0,
    approximatePromptTokens: 1_000,
    zeroCostCreditAccounting: {
      reportedCostUsdSinceSnapshot: 0,
      hasUnknownCompletedCost: false,
    },
    ...overrides,
  };
}

/** Provider-free verified fixture: the real SDK retry tests must reach inference, not catalog I/O. */
async function syntheticGatewayProfile(
  route: OpenAiModelRouteConfiguration,
): Promise<ModelAdmissionProfile> {
  return {
    version: 'synthetic-retry-v1',
    modelId: route.model,
    providerRoute: ['openai'],
    contextWindowTokens: 1050000,
    maximumOutputTokens: 128000,
    inputCostPerMillionUsd: 0.3,
    outputCostPerMillionUsd: 1.2,
    reasoningEffort: route.reasoningEffort,
    requestedOutputControl: 'max_output_tokens',
    requestedOutputTokens: route.maxOutputTokens,
    outputSemantics: 'total_including_reasoning',
    reasoningCountsAgainstControl: true,
    verificationState: 'verified',
    verificationReason: 'Synthetic profile for provider-free HTTP retry coverage.',
    verifiedAt: new Date().toISOString(),
    nativeCounter: 'none',
    sources: [],
  };
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

  it('rejects partial Free Tier accounting and partial route-rate configuration rather than guessing', () => {
    expect(() =>
      zeroCostEnvironment({ JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD: '0.25' }),
    ).toThrow(EnvironmentValidationError);
    expect(() =>
      zeroCostEnvironment({
        JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION: '0.3',
      }),
    ).toThrow(EnvironmentValidationError);
    expect(guardedZeroCostEnvironment().model.freeTierCreditGuard.monthlyCreditGuardUsd).toBe(3);
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

  it('allows a verified Free Tier route with nonzero list-price accounting only below the configured safety guard', () => {
    const environment = guardedZeroCostEnvironment();
    const guard = new ModelBudgetGuard(environment.model, environment.brain, {
      now: () => new Date('2026-09-02T12:00:00.000Z'),
    });

    const decision = guard.evaluate('fast', guardUsage());

    expect(decision).toMatchObject({
      allowed: true,
      failureStatus: null,
    });
    expect(decision.worstCaseRequestCostUsd).toBeGreaterThan(0);
  });

  it('fails closed as explicitly unavailable when Free Tier accounting is unknown', () => {
    const environment = guardedZeroCostEnvironment();
    const guard = new ModelBudgetGuard(environment.model, environment.brain, {
      now: () => new Date('2026-09-02T12:00:00.000Z'),
    });

    const decision = guard.evaluate(
      'fast',
      guardUsage({
        zeroCostCreditAccounting: {
          reportedCostUsdSinceSnapshot: 0,
          hasUnknownCompletedCost: true,
        },
      }),
    );

    expect(decision).toMatchObject({ allowed: false, failureStatus: 'provider_unavailable' });
    expect(decision.reason).toContain('no safely reported cost');
  });

  it('refuses a request before the conservative credit guard could reach Vercel included-credit exhaustion', () => {
    const environment = guardedZeroCostEnvironment({
      JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD: '2.999',
    });
    const guard = new ModelBudgetGuard(environment.model, environment.brain, {
      now: () => new Date('2026-09-02T12:00:00.000Z'),
    });

    const decision = guard.evaluate('fast', guardUsage());

    expect(decision).toMatchObject({ allowed: false, failureStatus: 'provider_unavailable' });
    expect(decision.reason).toContain('credit safety guard');
  });

  it('rejects an unknown Gateway profile without probing a token counter or generating', async () => {
    const environment = guardedZeroCostEnvironment();
    const count = vi.fn().mockRejectedValue({ status: 429 });
    const create = vi.fn();
    const client = {
      responses: { create, inputTokens: { count } },
    } as unknown as VercelAiGatewayClient;
    const gateway = new VercelAiGatewayModelGateway(environment.model, client);

    const result = await gateway.decide(gatewayRequest());

    expect(result).toMatchObject({
      status: 'configuration_error',
      run: {
        configuredModelId: 'provider/possible-free-model',
        errorCategory: 'provider_output_limit_unverified',
      },
    });
    if (result.status !== 'configuration_error') {
      throw new Error('Expected a denied Gateway admission.');
    }
    expect(result.safeError).toContain('metadata is unavailable');
    expect(count).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('uses an explicitly injected request identity when the test configuration has no token', async () => {
    const environment = loadApiEnvironment({
      APP_ENV: 'test',
      JARVIS_MODEL_PROVIDER: 'vercel-ai-gateway',
      JARVIS_ZERO_COST_MODE: 'false',
      JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL: 'openai/gpt-6-luna',
      JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION: '0.11',
      JARVIS_VERCEL_AI_GATEWAY_FAST_OUTPUT_COST_PER_MILLION: '0.55',
    });
    const count = vi.fn().mockRejectedValue({ status: 429 });
    const create = vi.fn().mockRejectedValue({ status: 429 });
    const tokenProvider = vi.fn(async () => 'request-scoped-oidc-token');
    const gateway = new VercelAiGatewayModelGateway(
      environment.model,
      { responses: { create, inputTokens: { count } } } as unknown as VercelAiGatewayClient,
      tokenProvider,
      async (route) => ({
        version: 'synthetic-v1',
        modelId: route.model,
        providerRoute: ['openai'],
        contextWindowTokens: 1050000,
        maximumOutputTokens: 128000,
        inputCostPerMillionUsd: 0.11,
        outputCostPerMillionUsd: 0.55,
        reasoningEffort: route.reasoningEffort,
        requestedOutputControl: 'max_output_tokens',
        requestedOutputTokens: route.maxOutputTokens,
        outputSemantics: 'total_including_reasoning',
        reasoningCountsAgainstControl: true,
        verificationState: 'verified',
        verificationReason: 'Synthetic profile.',
        verifiedAt: new Date().toISOString(),
        nativeCounter: 'none',
        sources: [],
      }),
    );

    const result = await gateway.decide(gatewayRequest());

    expect(result).toMatchObject({
      status: 'unavailable',
      run: { errorCategory: 'rate_limited' },
    });
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('maps a Gateway quota/rate-limit error to unavailable and does not invoke a fallback model', async () => {
    const create = vi.fn().mockRejectedValue({ status: 429 });
    const client = { responses: { create } } as unknown as VercelAiGatewayClient;
    const gateway = new VercelAiGatewayModelGateway(
      guardedZeroCostEnvironment().model,
      client,
      undefined,
      syntheticGatewayProfile,
    );
    const result = await gateway.decide(gatewayRequest());
    expect(result).toMatchObject({
      status: 'unavailable',
      run: { configuredModelId: 'provider/possible-free-model', errorCategory: 'rate_limited' },
    });
    if (result.status !== 'unavailable') throw new Error('Expected a Gateway unavailable result.');
    expect(result.safeError).toContain('did not select a fallback model');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'provider/possible-free-model' }),
      { maxRetries: 0 },
    );
  });

  it('records only an exact Gateway-reported cost receipt and never substitutes a list price', () => {
    expect(reportedGatewayCostUsd({ providerMetadata: { gateway: { cost: '0.00125' } } })).toBe(
      0.00125,
    );
    expect(
      reportedGatewayCostUsd({ pricing: { input: '0.0000003', output: '0.0000012' } }),
    ).toBeNull();
  });

  it.each(['provider_api', 'network'] as const)(
    'makes exactly one HTTP attempt on a retryable %s failure through the real SDK client',
    async (category) => {
      const fetch = vi.spyOn(globalThis, 'fetch');
      if (category === 'network') {
        fetch.mockRejectedValue(new TypeError('Synthetic provider-free connection failure.'));
      } else {
        fetch.mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'Synthetic provider-free failure.' } }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      try {
        const gateway = new VercelAiGatewayModelGateway(
          guardedZeroCostEnvironment().model,
          undefined,
          undefined,
          syntheticGatewayProfile,
        );

        const result = await gateway.decide(gatewayRequest());

        expect(result).toMatchObject({ status: 'unavailable', run: { errorCategory: category } });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(String(fetch.mock.calls[0]?.[0])).toBe(`${vercelAiGatewayResponsesUrl}/responses`);
      } finally {
        fetch.mockRestore();
      }
    },
  );
});
