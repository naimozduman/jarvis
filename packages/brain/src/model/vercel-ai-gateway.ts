import { randomUUID } from 'node:crypto';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import {
  isVerifiedZeroCostGatewayRoute,
  type ModelRuntimeConfiguration,
  type OpenAiModelRouteConfiguration,
} from '@jarvis/config';
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

import {
  loadGatewayAdmissionProfile,
  type GatewayAdmissionProfileSource,
} from './admission-profile.js';

const vercelAiGatewayResponsesUrl = 'https://ai-gateway.vercel.sh/v1';

export interface VercelAiGatewayClient {
  readonly responses: Pick<OpenAI['responses'], 'create'> &
    Partial<Pick<OpenAI['responses'], 'inputTokens'>>;
}

/**
 * Tests may inject an explicit identity provider. Production identity is resolved once by the
 * Vercel entrypoint and passed into invocation-local configuration; this adapter never resolves
 * ambient or development credentials, persists them, or logs them.
 */
export type VercelOidcTokenProvider = () => Promise<string | undefined>;

const noImplicitOidcToken: VercelOidcTokenProvider = async () => undefined;

/**
 * This is an authentication/configuration check only.  It does not contact a model, reserve a
 * budget, or emit a provider request. The configuration contains only the identity explicitly
 * supplied for the current invocation; a missing identity remains not configured.
 */
export async function hasVercelAiGatewayOidcToken(
  configuration: ModelRuntimeConfiguration,
  tokenProvider: VercelOidcTokenProvider = noImplicitOidcToken,
): Promise<boolean> {
  if (configuration.oidcToken) return true;
  try {
    return Boolean(await tokenProvider());
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Vercel AI Gateway may include an exact request receipt at
 * `providerMetadata.gateway.cost` (or OpenResponses' snake_case equivalent). JARVIS records only
 * a finite non-negative receipt from that exact provider namespace; token pricing and names are
 * never substituted when the receipt is absent.
 */
export function reportedGatewayCostUsd(response: unknown): number | null {
  if (!isRecord(response)) return null;
  const metadata =
    (isRecord(response.providerMetadata) && response.providerMetadata) ||
    (isRecord(response.provider_metadata) && response.provider_metadata);
  const gateway = metadata && isRecord(metadata.gateway) ? metadata.gateway : undefined;
  const cost = gateway?.cost;
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
    return cost;
  }
  if (typeof cost === 'string' && /^\d+(?:\.\d+)?$/.test(cost)) {
    const parsed = Number(cost);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function routeConfiguration(
  configuration: ModelRuntimeConfiguration,
  route: ModelRoute,
): OpenAiModelRouteConfiguration {
  return configuration[route];
}

export function vercelGatewayErrorCategory(error: unknown): string {
  if (isRecord(error) && error.status === 429) {
    return 'rate_limited';
  }
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
  response?: unknown,
): ModelGatewayResult {
  const run: ModelRun = {
    id: randomUUID(),
    ownerId: request.request.ownerId,
    brainRequestId: request.request.id,
    provider: 'vercel-ai-gateway',
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
  if (response !== undefined) {
    run.estimatedCostUsd = reportedGatewayCostUsd(response);
    if (isRecord(response) && typeof response.model === 'string')
      run.actualModelId = response.model;
  }
  return { status, safeError, run };
}

/**
 * Stateless Vercel AI Gateway Responses adapter. The Vercel entrypoint supplies invocation-local
 * OIDC identity; this adapter never accepts a gateway API key and never falls back
 * to a billable direct OpenAI credential. It retains the exact JARVIS structured-output and
 * `store: false` boundary used by the direct adapter.
 */
export class VercelAiGatewayModelGateway implements ModelGateway {
  private readonly admissions = new WeakSet<ModelRequestAdmission>();
  public constructor(
    private readonly configuration: ModelRuntimeConfiguration,
    private readonly clientOverride?: VercelAiGatewayClient,
    private readonly tokenProvider: VercelOidcTokenProvider = noImplicitOidcToken,
    private readonly profileSource: GatewayAdmissionProfileSource = loadGatewayAdmissionProfile,
  ) {}

  private async clientForCurrentRequest(): Promise<VercelAiGatewayClient | null> {
    let token = this.configuration.oidcToken;
    if (!token) {
      try {
        token = await this.tokenProvider();
      } catch {
        // Treat an unexpected request-context failure as unavailable without surfacing provider
        // details. The caller records a safe not-configured result below.
        token = undefined;
      }
    }
    if (!token) return null;
    // Do not cache this client: Vercel may rotate the request-scoped OIDC token between turns.
    return (
      this.clientOverride ??
      new OpenAI({
        apiKey: token,
        baseURL: vercelAiGatewayResponsesUrl,
        maxRetries: 0,
      })
    );
  }

  public async preflight(
    request: ModelGatewayRequest,
    limits = { dynamicContextBudgetTokens: 6000 },
  ): Promise<ModelRequestAdmission> {
    const route = effectiveModelRouteConfiguration(
      routeConfiguration(this.configuration, request.route),
      request,
    );
    const profile = await this.profileSource(route);
    const admission = createRequestAdmission(
      assembleResponsesRequest(request, route, structuredOutputFormat()),
      profile,
      {
        dynamicContextBudgetTokens: limits.dynamicContextBudgetTokens,
        dynamicContextEstimate: request.context.manifest.promptTokenEstimate,
      },
    );
    // Gateway has no verified native counting route. Never probe vendor-specific counters.
    this.admissions.add(admission);
    return admission;
  }

  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const configuredRoute = effectiveModelRouteConfiguration(
      routeConfiguration(this.configuration, request.route),
      request,
    );
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
    const body = assembleResponsesRequest(request, configuredRoute, structuredOutputFormat());
    const admission = request.admission ?? (await this.preflight(request));
    if (
      !admission.allowed ||
      !this.admissions.has(admission) ||
      admission.requestHash !== requestHash(body)
    ) {
      return incompleteResult(
        admission.errorCategory === 'not_configured' ? 'not_configured' : 'configuration_error',
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
    // Single-use admission prevents accidentally replaying a paid request through the adapter.
    this.admissions.delete(admission);
    const client = await this.clientForCurrentRequest();
    if (!client)
      return incompleteResult(
        'not_configured',
        'The Gateway OIDC identity is unavailable. No model call was made.',
        request,
        configuredRoute,
        startedAtMs,
        'not_configured',
        admission,
      );
    try {
      const response = await client.responses.create(body, { maxRetries: 0 });
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
      const run: ModelRun = {
        id: randomUUID(),
        ownerId: request.request.ownerId,
        brainRequestId: request.request.id,
        provider: 'vercel-ai-gateway',
        route: request.route,
        configuredModelId: configuredRoute.model,
        actualModelId: response.model ?? configuredRoute.model,
        reasoningEffort: configuredRoute.reasoningEffort,
        status: 'completed',
        latencyMs: Math.max(0, Date.now() - startedAtMs),
        // This is a provider-reported receipt when one exists. An absent receipt remains null;
        // the canonical Free Tier safety guard then refuses another model call rather than using
        // list pricing, a guessed zero, auto top-up, BYOK, or a fallback model.
        estimatedCostUsd: reportedGatewayCostUsd(response),
        errorCategory: null,
        createdAt: new Date().toISOString(),
        admission,
        ...accounting,
      };
      return { status: 'completed', decision: parsed.data, run };
    } catch (error) {
      const category = vercelGatewayErrorCategory(error);
      return incompleteResult(
        'unavailable',
        category === 'rate_limited'
          ? 'The Vercel AI Gateway Free Tier is rate-limited or its included quota is unavailable. JARVIS did not select a fallback model.'
          : 'The model provider could not complete this request. No state was changed by the provider.',
        request,
        configuredRoute,
        startedAtMs,
        category,
        admission,
      );
    }
  }
}

export { vercelAiGatewayResponsesUrl };
