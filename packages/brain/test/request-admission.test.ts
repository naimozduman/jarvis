import { describe, expect, it, vi } from 'vitest';

import { loadApiEnvironment } from '@jarvis/config';
import type { BrainRequest } from '@jarvis/contracts';
import { isModelAccountingSafe } from '@jarvis/contracts';

import {
  directAdmissionProfile,
  profileFromGatewayCatalog,
} from '../src/model/admission-profile.js';
import { offlineAdmissionFormula } from '../src/model/request-admission.js';
import type { ModelAdmissionProfile } from '@jarvis/contracts';

import { ContextAssembler } from '../src/context/assembler.js';
import { ModelBudgetGuard } from '../src/model/budget-guard.js';
import type { ModelGatewayRequest } from '../src/model/gateway.js';
import {
  OpenAiResponsesModelGateway,
  type OpenAiResponsesClient,
} from '../src/model/openai-responses-gateway.js';
import {
  assembleResponsesRequest,
  createRequestAdmission,
  responseUsageAccounting,
} from '../src/model/request-admission.js';
import {
  VercelAiGatewayModelGateway,
  type VercelAiGatewayClient,
} from '../src/model/vercel-ai-gateway.js';

const now = '2099-04-07T12:00:00.000Z';
const request: BrainRequest = {
  id: '00000000-0000-4000-8000-000000000001',
  ownerId: '00000000-0000-4000-8000-000000000002',
  conversationId: null,
  sourceEventId: null,
  messageId: null,
  purpose: 'conversation',
  idempotencyKey: 'synthetic-full-request-admission',
  correlationId: '00000000-0000-4000-8000-000000000003',
  causationId: null,
  requestedAt: now,
  state: 'model_requested',
};
const context = new ContextAssembler({
  maxContextRecords: 10,
  maxRecentMessages: 5,
  maxApproxPromptTokens: 6_000,
}).assemble({ request, now, records: [], hardOverrideIds: [], availableData: [] });
const input: ModelGatewayRequest = {
  request,
  context,
  route: 'fast',
  instructions: 'Synthetic constitution and security instructions.',
  input: JSON.stringify({
    ownerMessage: 'Synthetic owner message.',
    context: { records: [], hardAnchor: 'synthetic' },
  }),
};
const environment = loadApiEnvironment({
  APP_ENV: 'test',
  JARVIS_ZERO_COST_MODE: 'false',
  JARVIS_MODEL_PROVIDER: 'openai-responses',
  OPENAI_API_KEY: 'synthetic-unit-test-never-sent',
  JARVIS_OPENAI_FAST_MODEL: 'gpt-6-luna',
  JARVIS_OPENAI_FAST_REASONING_EFFORT: 'medium',
  JARVIS_OPENAI_FAST_MAX_OUTPUT_TOKENS: '2500',
  JARVIS_BRAIN_MAX_APPROX_PROMPT_TOKENS: '6000',
});
const decision = {
  decisionType: 'answer',
  conversationResponse: { message: 'Synthetic response.', nextAction: null, tone: 'neutral' },
  reasoningSummary: {
    decisionSummary: 'Synthetic summary.',
    importantEvidenceIds: [],
    materialTradeoffs: [],
    confidenceBasisPoints: 5000,
    missingInformation: [],
  },
  evidence: [],
  clarification: null,
  proposedActions: [],
  memoryCandidates: [],
  planProposal: null,
  reminderProposal: null,
  interventionProposal: null,
};
const testStructuredOutputFormat = {
  type: 'json_schema',
  name: 'jarvis_brain_decision',
  strict: true,
  schema: { description: 'synthetic-strict-schema-'.repeat(600) },
};
function response(overrides: Record<string, unknown> = {}) {
  return {
    id: 'synthetic-response',
    model: 'gpt-6-luna',
    status: 'completed',
    output: [
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(decision) }] },
    ],
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 200 },
    },
    ...overrides,
  };
}
function direct(counted = 1000, result = response()) {
  const count = vi
    .fn()
    .mockResolvedValue({ object: 'response.input_tokens', input_tokens: counted });
  const create = vi.fn().mockResolvedValue(result);
  const client = {
    responses: { create, inputTokens: { count } },
  } as unknown as OpenAiResponsesClient;
  return { gateway: new OpenAiResponsesModelGateway(environment.openAi, client), count, create };
}

const bounds = { dynamicContextBudgetTokens: 6000, dynamicContextEstimate: 200 };
function profile(overrides: Partial<ModelAdmissionProfile> = {}): ModelAdmissionProfile {
  return {
    ...directAdmissionProfile(environment.openAi.fast),
    nativeCounter: 'none',
    ...overrides,
  };
}
function admission(overrides: Partial<ModelAdmissionProfile> = {}) {
  return createRequestAdmission(
    assembleResponsesRequest(input, environment.openAi.fast, testStructuredOutputFormat),
    profile(overrides),
    bounds,
  );
}
function gatewayHarness(
  result = response(),
  profileOverrides: Partial<ModelAdmissionProfile> = {},
) {
  const model = {
    ...environment.model,
    provider: 'vercel-ai-gateway' as const,
    oidcToken: 'synthetic-oidc',
    fast: { ...environment.model.fast, model: 'openai/gpt-6-luna' },
  };
  const count = vi.fn().mockRejectedValue({ status: 404 });
  const create = vi.fn().mockResolvedValue(result);
  const gateway = new VercelAiGatewayModelGateway(
    model,
    { responses: { create, inputTokens: { count } } } as unknown as VercelAiGatewayClient,
    async () => 'synthetic-oidc',
    async () => profile({ modelId: model.fast.model, ...profileOverrides }),
  );
  return { gateway, create, count, model };
}

describe('provider-neutral conservative full-request admission', () => {
  it('admits and generates the identical Luna-low request selected by trusted chat routing', async () => {
    const model = {
      ...environment.model,
      provider: 'vercel-ai-gateway' as const,
      oidcToken: 'synthetic-oidc',
      standard: {
        ...environment.model.fast,
        model: 'openai/gpt-6-luna',
        reasoningEffort: 'medium' as const,
      },
    };
    const create = vi.fn().mockResolvedValue(response());
    const source = vi.fn(async (route) =>
      profile({ modelId: route.model, reasoningEffort: route.reasoningEffort }),
    );
    const gateway = new VercelAiGatewayModelGateway(
      model,
      { responses: { create } } as unknown as VercelAiGatewayClient,
      async () => 'synthetic-oidc',
      source,
    );
    const request = {
      ...input,
      route: 'standard' as const,
      reasoningEffortOverride: 'low' as const,
    };
    const receipt = await gateway.preflight(request, bounds);
    expect(source.mock.calls[0]?.[0].reasoningEffort).toBe('low');
    expect(receipt.allowed).toBe(true);
    expect((await gateway.decide({ ...request, admission: receipt })).status).toBe('completed');
    expect(create.mock.calls[0]?.[0].reasoning.effort).toBe('low');
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('never invokes the unavailable Gateway /responses/input_tokens endpoint and admits text offline', async () => {
    const h = gatewayHarness();
    const receipt = await h.gateway.preflight(input, bounds);
    expect(receipt).toMatchObject({
      allowed: true,
      measurementMethod: 'conservative_utf8',
      measuredInputTokens: null,
    });
    expect(h.count).not.toHaveBeenCalled();
    expect((await h.gateway.decide({ ...input, admission: receipt })).status).toBe('completed');
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.count).not.toHaveBeenCalled();
  });
  it('measures exact UTF-8 serialization including instructions, context, options and strict schema', () => {
    const body = assembleResponsesRequest(
      { ...input, input: 'Synthetic 😀漢字' },
      environment.openAi.fast,
      testStructuredOutputFormat,
    );
    const result = createRequestAdmission(body, profile(), bounds);
    expect(result.requestBytes).toBe(Buffer.byteLength(JSON.stringify(body), 'utf8'));
    expect(result.schemaBytes).toBeGreaterThan(10000);
    expect(result).toMatchObject({
      estimationVersion: 'utf8-text-json-v1',
      safetyFactor: 2,
      framingAllowanceTokens: 4096,
    });
    expect(result.fullRequestInputTokens).toBe(result.requestBytes * 2 + 4096);
    expect(offlineAdmissionFormula.framingAllowanceTokens).toBe(4096);
  });
  it('keeps the dynamic 6000 context budget separate from a complete request above 6000', () => {
    const result = admission();
    expect(result).toMatchObject({
      allowed: true,
      dynamicContextBudgetTokens: 6000,
      dynamicContextEstimate: 200,
      contextWindowTokens: 1050000,
    });
    expect(result.fullRequestInputTokens).toBeGreaterThan(6000);
    const guard = new ModelBudgetGuard(environment.model, environment.brain);
    expect(guard.dynamicContextBudgetTokens()).toBe(6000);
    expect(
      guard.evaluate('fast', {
        callsAlreadyMade: 0,
        dailyDeepCallsUsed: 0,
        dailySpendEstimateUsd: 0,
        approximatePromptTokens: 200,
        admission: result,
      }).allowed,
    ).toBe(true);
  });
  it('rejects when input plus reserved generation cannot fit the verified context window', () => {
    expect(admission({ contextWindowTokens: 10000 })).toMatchObject({
      allowed: false,
      errorCategory: 'model_context_window_exceeded',
    });
  });
  it('independently rejects spend even though context safety passes without increasing the guard', () => {
    const result = admission();
    const guard = new ModelBudgetGuard(environment.model, environment.brain);
    expect(result.allowed).toBe(true);
    const budget = guard.evaluate('fast', {
      callsAlreadyMade: 0,
      dailyDeepCallsUsed: 0,
      dailySpendEstimateUsd: environment.brain.dailyModelSpendLimitUsd,
      approximatePromptTokens: 200,
      admission: result,
    });
    expect(budget.allowed).toBe(false);
    expect(budget.reason).toContain('daily model-spend');
    expect(budget.worstCaseRequestCostUsd).toBe(result.worstCaseCostUsd);
  });
  it.each([null, -1, NaN, Infinity])('rejects unavailable/invalid input pricing %s', (rate) => {
    expect(admission({ inputCostPerMillionUsd: rate })).toMatchObject({
      allowed: false,
      errorCategory: 'request_cost_bound_unavailable',
    });
  });
  it('rejects missing context metadata, unknown profiles and stale verification', () => {
    expect(admission({ contextWindowTokens: null }).allowed).toBe(false);
    expect(admission({ verificationState: 'unverified' }).allowed).toBe(false);
    expect(admission({ verifiedAt: '2020-01-01T00:00:00.000Z' }).errorCategory).toBe(
      'admission_profile_mismatch',
    );
  });
  it.each(['input_image', 'input_file', 'input_audio'])(
    'fails closed for unbounded %s input',
    (type) => {
      const body = {
        ...assembleResponsesRequest(input, environment.openAi.fast, testStructuredOutputFormat),
        input: [{ type, data: 'synthetic' }],
      };
      expect(
        createRequestAdmission(
          body as unknown as ReturnType<typeof assembleResponsesRequest>,
          profile(),
          bounds,
        ),
      ).toMatchObject({
        allowed: false,
        errorCategory: 'input_modality_unbounded',
        fullRequestInputTokens: null,
      });
    },
  );
  it('blocks Muse independently of its inexpensive fitting input', async () => {
    const h = gatewayHarness(response(), {
      verificationState: 'blocked',
      outputSemantics: 'unverified',
      reasoningCountsAgainstControl: null,
      verificationReason: 'Observed 2599 output exceeded 2500; reverify.',
    });
    const result = await h.gateway.decide(input);
    expect(result.run.errorCategory).toBe('provider_output_limit_unverified');
    expect(h.create).not.toHaveBeenCalled();
    expect(h.count).not.toHaveBeenCalled();
  });
  it('uses approved native counting when available and falls back on failure without acquiring credentials', async () => {
    const h = direct(6589);
    const exact = await h.gateway.preflight(input, bounds);
    expect(exact).toMatchObject({
      allowed: true,
      measurementMethod: 'provider_count',
      measuredInputTokens: 6589,
      fullRequestInputTokens: 7248,
    });
    h.count.mockRejectedValue({ status: 404 });
    const fallback = await h.gateway.preflight(input, bounds);
    expect(fallback).toMatchObject({
      allowed: true,
      measurementMethod: 'conservative_utf8',
      measuredInputTokens: null,
    });
    expect(h.create).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER])(
    'invalid native count %s cannot understate the byte bound',
    async (counted) => {
      const h = direct(counted);
      const result = await h.gateway.preflight(input, bounds);
      expect(result.allowed ? result.fullRequestInputTokens! >= result.requestBytes : true).toBe(
        true,
      );
    },
  );
  it('binds admission to the exact payload and refuses reuse on replay', async () => {
    const h = gatewayHarness();
    const receipt = await h.gateway.preflight(input, bounds);
    expect(
      (await h.gateway.decide({ ...input, admission: receipt, input: 'Changed synthetic message' }))
        .run.errorCategory,
    ).toBe('admission_mismatch');
    expect(h.create).not.toHaveBeenCalled();
    expect((await h.gateway.decide({ ...input, admission: receipt })).status).toBe('completed');
    expect((await h.gateway.decide({ ...input, admission: receipt })).run.errorCategory).toBe(
      'admission_mismatch',
    );
    expect(h.create).toHaveBeenCalledTimes(1);
  });
  it.each(['input', 'output'])(
    'retains usage but rejects actual %s above admission before materialization',
    async (kind) => {
      const h = gatewayHarness(
        response({
          usage: {
            input_tokens: kind === 'input' ? 100000 : 1000,
            output_tokens: kind === 'output' ? 2599 : 500,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 200 },
          },
        }),
      );
      const result = await h.gateway.decide(input);
      expect(result.status).toBe('invalid_model_output');
      expect(result.run.errorCategory).toBe('provider_usage_bound_violation');
      expect(
        result.run.usageAccounting?.[
          kind === 'input' ? 'inputBoundExceeded' : 'outputBoundExceeded'
        ],
      ).toBe(true);
      expect('decision' in result).toBe(false);
    },
  );
  it.each(['incomplete', 'malformed'])(
    'keeps exact receipt and usage on %s output',
    async (kind) => {
      const h = gatewayHarness(
        response({
          status: kind === 'incomplete' ? 'incomplete' : 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: '{broken' }] }],
          provider_metadata: { gateway: { cost: '0.000123456789' } },
        }),
      );
      const result = await h.gateway.decide(input);
      expect(result.run.estimatedCostUsd).toBe(0.000123456789);
      expect(result.run.usageAccounting).toMatchObject({
        providerTotalOutputTokens: 500,
        reasoningTokens: 200,
        nonReasoningOutputTokens: 300,
        visibleOutputTokens: null,
      });
    },
  );
  it('missing or inconsistent usage is not success', () => {
    expect(responseUsageAccounting({}, admission()).usageAccounting.usageValid).toBe(false);
    expect(
      responseUsageAccounting(
        {
          usage: {
            input_tokens: 100,
            output_tokens: 1,
            output_tokens_details: { reasoning_tokens: 2 },
          },
        },
        admission(),
      ).usageAccounting.usageValid,
    ).toBe(false);
  });
  it('uses the smallest endpoint window and maximum regional/tier prices without rerouting', () => {
    const route = { ...environment.openAi.fast, model: 'openai/gpt-6-luna' };
    const endpoint = {
      provider_name: 'openai',
      context_length: 1000000,
      max_completion_tokens: 128000,
      supported_parameters: ['response_format', 'structured_outputs'],
      pricing: {
        prompt: '0.0000001',
        completion: '0.0000005',
        request: '0',
        internal_reasoning: '0',
      },
      inference_regions: [{ pricing: { prompt: '0.00000011', completion: '0.00000055' } }],
    };
    const result = profileFromGatewayCatalog(route, {
      data: {
        id: route.model,
        reasoning: { supported_efforts: ['medium'] },
        endpoints: [endpoint, { ...endpoint, provider_name: 'azure', context_length: 900000 }],
      },
    });
    expect(result).toMatchObject({
      verificationState: 'verified',
      contextWindowTokens: 900000,
      inputCostPerMillionUsd: 0.11,
      outputCostPerMillionUsd: 0.55,
      nativeCounter: 'none',
      providerRoute: ['openai', 'azure'],
    });
  });
});

describe('verified Muse maximum-output admission', () => {
  function muse() {
    const route = { ...environment.openAi.fast, model: 'meta/muse-spark-1.3-contributor' };
    const p = profileFromGatewayCatalog(route, {
      data: {
        id: route.model,
        reasoning: { supported_efforts: ['medium'] },
        endpoints: [
          {
            provider_name: 'meta',
            context_length: 1048576,
            max_completion_tokens: 1048576,
            supported_parameters: ['response_format', 'structured_outputs'],
            pricing: {
              prompt: '0.0000001',
              completion: '0.0000002',
              request: '0',
              internal_reasoning: '0',
            },
          },
        ],
      },
    });
    return createRequestAdmission(
      assembleResponsesRequest(input, route, testStructuredOutputFormat),
      p,
      bounds,
    );
  }
  it('keeps requested 2500 but reserves full model output cost without adding impossible context maxima', () => {
    const a = muse();
    expect(a).toMatchObject({
      allowed: true,
      maxOutputTokens: 2500,
      outputSafetyBoundTokens: 1048576,
      outputLimitSemantics: 'provider_maximum_shared_context',
      contextWindowTokens: 1048576,
    });
    expect(a.worstCaseCostUsd).toBeCloseTo(
      (a.fullRequestInputTokens! * 0.1 + 1048576 * 0.2) / 1000000,
      10,
    );
    const guard = new ModelBudgetGuard(
      { ...environment.model, fast: { ...environment.model.fast, model: a.modelId } },
      environment.brain,
    );
    const usage = {
      admission: a,
      callsAlreadyMade: 0,
      dailySpendEstimateUsd: 0,
      dailyDeepCallsUsed: 0,
      approximatePromptTokens: 200,
    };
    expect(guard.evaluate('fast', usage).allowed).toBe(true);
    expect(
      guard.evaluate('fast', {
        ...usage,
        dailySpendEstimateUsd: environment.brain.dailyModelSpendLimitUsd - 0.1,
      }).allowed,
    ).toBe(false);
  });
  it('persists an updated profile and distinguishes requested-control overshoot from safety violations', () => {
    const a = muse();
    const usage = responseUsageAccounting(
      response({
        usage: {
          input_tokens: 6589,
          output_tokens: 2599,
          output_tokens_details: { reasoning_tokens: 2320 },
        },
      }),
      a,
    ).usageAccounting;
    expect(usage).toMatchObject({
      requestedOutputControlExceeded: true,
      outputBoundExceeded: false,
      contextBoundExceeded: false,
      profileAfterRun: {
        verificationState: 'verified',
        lastObservedUsage: {
          inputTokens: 6589,
          outputTokens: 2599,
          reasoningTokens: 2320,
          requestedControlExceeded: true,
        },
      },
    });
    const violation = responseUsageAccounting(
      response({
        usage: {
          input_tokens: 6589,
          output_tokens: 1048577,
          output_tokens_details: { reasoning_tokens: 100 },
        },
      }),
      a,
    ).usageAccounting;
    expect(violation).toMatchObject({
      outputBoundExceeded: true,
      contextBoundExceeded: true,
      profileAfterRun: { verificationState: 'blocked' },
    });
  });
  it('blocks a combined-context violation even when independent output fits its maximum', () => {
    const usage = responseUsageAccounting(
      response({
        usage: {
          input_tokens: 6589,
          output_tokens: 1048000,
          output_tokens_details: { reasoning_tokens: 100 },
        },
      }),
      muse(),
    ).usageAccounting;
    expect(usage).toMatchObject({
      outputBoundExceeded: false,
      contextBoundExceeded: true,
      profileAfterRun: { verificationState: 'blocked' },
    });
  });
  it('allows only reviewed legacy Muse output-control violations to be superseded', () => {
    const current = muse();
    const previous = {
      ...current,
      outputSafetyBoundTokens: 2500,
      outputLimitSemantics: 'unverified' as const,
      profile: { ...current.profile!, version: 'model-admission-v2-20260929' },
    };
    const accounting = responseUsageAccounting(
      response({
        usage: {
          input_tokens: 6589,
          output_tokens: 2599,
          output_tokens_details: { reasoning_tokens: 2320 },
        },
      }),
      previous,
    ).usageAccounting;
    expect(isModelAccountingSafe(accounting, previous, current, 6589)).toBe(true);
    expect(
      isModelAccountingSafe({ ...accounting, inputBoundExceeded: true }, previous, current, 6589),
    ).toBe(false);
    expect(isModelAccountingSafe(accounting, current, current, 6589)).toBe(false);
    expect(isModelAccountingSafe(accounting, previous, undefined, 6589)).toBe(false);
  });
});

describe('restricted model output audit', () => {
  it('rejects legacy protected emissions while retaining proposal evidence and exact usage/cost', async () => {
    const plan = {
      dayPlanId: '00000000-0000-4000-8000-000000000002',
      trigger: 'conflict',
      tradeoffs: [],
      proposedBlocks: [
        {
          reference: 'legacy-anchor',
          existingBlockId: null,
          commitmentId: null,
          title: 'Synthetic anchor',
          role: 'hard_external_anchor',
          anchorClass: 'fixed',
          priority: 100,
          startAt: '2099-04-07T16:00:00.000Z',
          endAt: '2099-04-07T17:00:00.000Z',
          earliestStartAt: null,
          latestFinishAt: null,
          estimatedDurationMinutes: 60,
          minimumDurationMinutes: null,
          dependencyIds: [],
          reasonForPlacement: 'Legacy emission',
          source: 'synthetic',
        },
      ],
    };
    const h = gatewayHarness(
      response({
        provider_metadata: { gateway: { cost: '0.000123456789' } },
        output: [
          { type: 'reasoning', summary: [{ text: 'Hidden reasoning must not be retained' }] },
          {
            type: 'message',
            content: [
              { type: 'output_text', text: JSON.stringify({ ...decision, planProposal: plan }) },
            ],
          },
        ],
      }),
    );
    const result = await h.gateway.decide(input);
    expect(result.status).toBe('invalid_model_output');
    expect(result.run.estimatedCostUsd).toBe(0.000123456789);
    expect(result.run.outputAudit).toMatchObject({
      schemaValid: false,
      contractVersion: 'flexible_delta_v2',
      planJson: JSON.stringify(plan),
      planJsonTruncated: false,
    });
    expect(result.run.outputAudit?.issuePaths.join(' ')).toContain('operations');
    expect(JSON.stringify(result.run.outputAudit)).not.toContain('Hidden reasoning');
    expect(result.run.outputAudit?.responseTextSha256).toHaveLength(64);
    expect('decision' in result).toBe(false);
  });
});
