import { randomUUID } from 'node:crypto';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import {
  isVerifiedZeroCostGatewayRoute,
  type ModelRuntimeConfiguration,
  type OpenAiModelRouteConfiguration,
} from '@jarvis/config';
import type { ModelRoute, ModelRun } from '@jarvis/contracts';

import { modelDecisionEnvelopeSchema } from './decision-schema.js';
import type { ModelGateway, ModelGatewayRequest, ModelGatewayResult } from './gateway.js';

const vercelAiGatewayResponsesUrl = 'https://ai-gateway.vercel.sh/v1';

function routeConfiguration(
  configuration: ModelRuntimeConfiguration,
  route: ModelRoute,
): OpenAiModelRouteConfiguration {
  return configuration[route];
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
 * Stateless Vercel AI Gateway Responses adapter. In a deployed Vercel function the platform
 * injects `VERCEL_OIDC_TOKEN`; this adapter never accepts a gateway API key and never falls back
 * to a billable direct OpenAI credential. It retains the exact JARVIS structured-output and
 * `store: false` boundary used by the direct adapter.
 */
export class VercelAiGatewayModelGateway implements ModelGateway {
  private readonly client: OpenAI | null;

  public constructor(private readonly configuration: ModelRuntimeConfiguration) {
    this.client = configuration.oidcToken
      ? new OpenAI({
          apiKey: configuration.oidcToken,
          baseURL: vercelAiGatewayResponsesUrl,
        })
      : null;
  }

  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const configuredRoute = routeConfiguration(this.configuration, request.route);
    const startedAtMs = Date.now();
    if (
      this.configuration.zeroCostMode &&
      !isVerifiedZeroCostGatewayRoute(this.configuration, request.route)
    ) {
      return incompleteResult(
        'not_configured',
        'The configured zero-cost model is not verified by the deployment-time Gateway catalog check.',
        request,
        configuredRoute,
        startedAtMs,
        'zero_cost_model_unverified',
      );
    }
    if (!this.client) {
      return incompleteResult(
        'not_configured',
        'The Vercel AI Gateway OIDC identity is not available in this environment.',
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
        const refused = response.output.some((item) =>
          item.type === 'message'
            ? item.content.some((content) => content.type === 'refusal')
            : false,
        );
        return incompleteResult(
          refused ? 'refused' : 'incomplete_output',
          refused
            ? 'The model declined this request.'
            : 'The model response did not complete with a valid structured decision.',
          request,
          configuredRoute,
          startedAtMs,
          refused ? 'refusal' : 'incomplete',
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
        // A zero-cost request reaches this branch only after the exact model ID passed the
        // deployment-time public catalog verification. No model-name heuristic is accepted.
        estimatedCostUsd: this.configuration.zeroCostMode ? 0 : null,
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

export { vercelAiGatewayResponsesUrl };
