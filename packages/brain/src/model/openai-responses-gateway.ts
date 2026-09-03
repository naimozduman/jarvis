import { randomUUID } from 'node:crypto';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import type { OpenAiModelRouteConfiguration, OpenAiRuntimeConfiguration } from '@jarvis/config';
import type { ModelRoute, ModelRun } from '@jarvis/contracts';

import { modelDecisionEnvelopeSchema } from './decision-schema.js';
import type { ModelGateway, ModelGatewayRequest, ModelGatewayResult } from './gateway.js';

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
  if (!usage) {
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
  };

  return { status, safeError, run };
}

/**
 * Stateless Responses API adapter. It deliberately passes neither a Conversation nor a
 * previous_response_id: PostgreSQL and the deterministic ContextAssembler own continuity.
 * OpenAI response storage is explicitly disabled and no hosted tools are exposed.
 */
export class OpenAiResponsesModelGateway implements ModelGateway {
  private readonly client: OpenAI | null;

  public constructor(private readonly configuration: OpenAiRuntimeConfiguration) {
    this.client = configuration.apiKey ? new OpenAI({ apiKey: configuration.apiKey }) : null;
  }

  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const configuredRoute = configurationForRoute(this.configuration, request.route);
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

    try {
      const response = await this.client.responses.parse({
        model: configuredRoute.model,
        store: false,
        truncation: 'disabled',
        instructions: request.instructions,
        input: request.input,
        max_output_tokens: configuredRoute.maxOutputTokens,
        reasoning: {
          effort: configuredRoute.reasoningEffort,
          mode: configuredRoute.reasoningMode,
          context: configuredRoute.reasoningContext,
        },
        text: {
          verbosity: configuredRoute.verbosity,
          format: zodTextFormat(modelDecisionEnvelopeSchema, 'jarvis_brain_decision'),
        },
      });

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
        );
      }

      const parsed = modelDecisionEnvelopeSchema.safeParse(response.output_parsed);
      if (!parsed.success) {
        return incompleteResult(
          'invalid_model_output',
          'The model response did not match the required decision schema.',
          request,
          configuredRoute,
          startedAtMs,
          'invalid_structured_output',
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
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        reasoningTokens: usage?.output_tokens_details.reasoning_tokens ?? null,
        cachedInputTokens: usage?.input_tokens_details.cached_tokens ?? null,
        estimatedCostUsd: estimatedCostUsd(configuredRoute, usage),
        errorCategory: null,
        createdAt: new Date().toISOString(),
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
      );
    }
  }
}
