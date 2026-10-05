import { directAdmissionProfile } from './admission-profile.js';
import { randomUUID } from 'node:crypto';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import type { OpenAiModelRouteConfiguration, OpenAiRuntimeConfiguration } from '@jarvis/config';
import type { ModelRequestAdmission, ModelRoute, ModelRun } from '@jarvis/contracts';

import type { ModelGateway, ModelGatewayRequest, ModelGatewayResult } from './gateway.js';
import { effectiveModelRouteConfiguration } from './gateway.js';
import { modelDecisionEnvelopeSchema } from './decision-schema.js';
import {
  assembleResponsesRequest,
  createRequestAdmission,
  parseDecisionResponse,
  requestHash,
  responseUsageAccounting,
} from './request-admission.js';

function structuredOutputFormat() {
  return zodTextFormat(modelDecisionEnvelopeSchema, 'jarvis_brain_decision');
}

export interface OpenAiResponsesClient {
  readonly responses: Pick<OpenAI['responses'], 'create'> &
    Partial<Pick<OpenAI['responses'], 'inputTokens'>>;
}

function configurationForRoute(
  configuration: OpenAiRuntimeConfiguration,
  route: ModelRoute,
): OpenAiModelRouteConfiguration {
  return configuration[route];
}

function estimatedCostUsd(
  route: OpenAiModelRouteConfiguration,
  usage:
    | {
        readonly input_tokens: number;
        readonly output_tokens: number;
        readonly input_tokens_details: { readonly cached_tokens: number };
      }
    | undefined,
): number | null {
  if (
    !usage ||
    ![usage.input_tokens, usage.output_tokens, usage.input_tokens_details?.cached_tokens].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  ) {
    return null;
  }

  const cachedInputTokens = Math.max(0, usage.input_tokens_details.cached_tokens);
  const standardInputTokens = Math.max(0, usage.input_tokens - cachedInputTokens);
  const rateCard = route.rateCard;
  if (
    rateCard.inputCostPerMillionUsd === null ||
    rateCard.cachedInputCostPerMillionUsd === null ||
    rateCard.outputCostPerMillionUsd === null
  ) {
    return null;
  }

  return Number(
    (
      (standardInputTokens * rateCard.inputCostPerMillionUsd +
        cachedInputTokens * rateCard.cachedInputCostPerMillionUsd +
        usage.output_tokens * rateCard.outputCostPerMillionUsd) /
      1_000_000
    ).toFixed(8),
  );
}

function errorCategory(error: unknown): string {
  if (error instanceof OpenAI.RateLimitError) {
    return 'rate_limited';
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return 'authentication';
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return 'permission_denied';
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return 'network';
  }
  if (error instanceof OpenAI.APIError) {
    return 'provider_api';
  }
  return 'unknown_provider_error';
}

function incompleteResult(
  status: Exclude<ModelGatewayResult['status'], 'completed'>,
  safeError: string,
  request: ModelGatewayRequest,
  configuration: OpenAiModelRouteConfiguration,
  startedAtMs: number,
  category: string,
  admission?: ModelRequestAdmission,
  response?: OpenAI.Responses.Response,
): ModelGatewayResult {
  const run: ModelRun = {
    id: randomUUID(),
    ownerId: request.request.ownerId,
    brainRequestId: request.request.id,
    provider: 'openai-responses',
    route: request.route,
    configuredModelId: configuration.model,
    actualModelId: null,
    reasoningEffort: configuration.reasoningEffort,
    status,
    latencyMs: Math.max(0, Date.now() - startedAtMs),
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cachedInputTokens: null,
    estimatedCostUsd: null,
    errorCategory: category,
    createdAt: new Date().toISOString(),
    ...(admission ? { admission, ...responseUsageAccounting(response, admission) } : {}),
  };
  if (response) {
    run.estimatedCostUsd = estimatedCostUsd(configuration, response.usage);
    run.actualModelId = response.model ?? null;
  }

  return { status, safeError, run };
}

/**
 * Stateless Responses API adapter. It deliberately passes neither a Conversation nor a
 * previous_response_id: PostgreSQL and the deterministic ContextAssembler own continuity.
 * OpenAI response storage is explicitly disabled and no hosted tools are exposed.
 */
export class OpenAiResponsesModelGateway implements ModelGateway {
  private readonly client: OpenAiResponsesClient | null;
  private readonly admissions = new WeakSet<ModelRequestAdmission>();

  public constructor(
    private readonly configuration: OpenAiRuntimeConfiguration,
    clientOverride?: OpenAiResponsesClient,
  ) {
    this.client = configuration.apiKey
      ? (clientOverride ?? new OpenAI({ apiKey: configuration.apiKey, maxRetries: 0 }))
      : null;
  }

  public async preflight(
    request: ModelGatewayRequest,
    limits = { dynamicContextBudgetTokens: 6000 },
  ): Promise<ModelRequestAdmission> {
    const route = effectiveModelRouteConfiguration(
      configurationForRoute(this.configuration, request.route),
      request,
    );
    const body = assembleResponsesRequest(request, route, structuredOutputFormat());
    const profile = directAdmissionProfile(route);
    let count: unknown;
    if (
      profile.nativeCounter === 'openai_responses_input_tokens' &&
      this.client?.responses.inputTokens
    ) {
      try {
        count = await this.client.responses.inputTokens.count(body, { maxRetries: 0 });
      } catch {
        /* Approved native counter unavailable: use bounded text/JSON fallback, no retry. */
      }
    }
    const admission = createRequestAdmission(
      body,
      profile,
      {
        dynamicContextBudgetTokens: limits.dynamicContextBudgetTokens,
        dynamicContextEstimate: request.context.manifest.promptTokenEstimate,
      },
      count,
    );
    this.admissions.add(admission);
    return admission;
  }

  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const configuredRoute = effectiveModelRouteConfiguration(
      configurationForRoute(this.configuration, request.route),
      request,
    );
    const startedAtMs = Date.now();

    if (!this.client) {
      return incompleteResult(
        'not_configured',
        'The model provider is not configured for this environment.',
        request,
        configuredRoute,
        startedAtMs,
        'not_configured',
      );
    }

    const body = assembleResponsesRequest(request, configuredRoute, structuredOutputFormat());
    const admission = request.admission ?? (await this.preflight(request));
    if (
      !admission.allowed ||
      !this.admissions.has(admission) ||
      admission.requestHash !== requestHash(body)
    ) {
      return incompleteResult(
        'configuration_error',
        admission.allowed
          ? 'Full-request admission does not match this exact request. No model call was made.'
          : admission.reason,
        request,
        configuredRoute,
        startedAtMs,
        admission.allowed
          ? 'admission_mismatch'
          : (admission.errorCategory ?? 'input_count_unavailable'),
        admission,
      );
    }
    this.admissions.delete(admission);
    try {
      const response = await this.client.responses.create(body, { maxRetries: 0 });
      const accounting = responseUsageAccounting(response, admission);
      if (
        !accounting.usageAccounting.usageValid ||
        accounting.usageAccounting.inputBoundExceeded ||
        accounting.usageAccounting.outputBoundExceeded ||
        accounting.usageAccounting.contextBoundExceeded
      ) {
        return incompleteResult(
          'invalid_model_output',
          'The provider usage could not be reconciled with its admitted token bounds. No proposal was applied.',
          request,
          configuredRoute,
          startedAtMs,
          'provider_usage_bound_violation',
          admission,
          response,
        );
      }

      if (response.status !== 'completed') {
        const isRefusal = response.output.some((item) =>
          item.type === 'message'
            ? item.content.some((content) => content.type === 'refusal')
            : false,
        );
        return incompleteResult(
          isRefusal ? 'refused' : 'incomplete_output',
          isRefusal
            ? 'The model declined this request.'
            : 'The model response did not complete with a valid structured decision.',
          request,
          configuredRoute,
          startedAtMs,
          isRefusal ? 'refusal' : 'incomplete',
          admission,
          response,
        );
      }

      const parsed = parseDecisionResponse(response);
      if (!parsed.success) {
        return incompleteResult(
          'invalid_model_output',
          'The model response did not match the required decision schema.',
          request,
          configuredRoute,
          startedAtMs,
          'invalid_structured_output',
          admission,
          response,
        );
      }

      const usage = response.usage;
      const run: ModelRun = {
        id: randomUUID(),
        ownerId: request.request.ownerId,
        brainRequestId: request.request.id,
        provider: 'openai-responses',
        route: request.route,
        configuredModelId: configuredRoute.model,
        actualModelId: response.model ?? configuredRoute.model,
        reasoningEffort: configuredRoute.reasoningEffort,
        status: 'completed',
        latencyMs: Math.max(0, Date.now() - startedAtMs),
        estimatedCostUsd: estimatedCostUsd(configuredRoute, usage),
        errorCategory: null,
        createdAt: new Date().toISOString(),
        admission,
        ...accounting,
      };

      return { status: 'completed', decision: parsed.data, run };
    } catch (error) {
      return incompleteResult(
        'unavailable',
        'The model provider could not complete this request. No state was changed by the provider.',
        request,
        configuredRoute,
        startedAtMs,
        errorCategory(error),
        admission,
      );
    }
  }
}
