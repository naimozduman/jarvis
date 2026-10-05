import type {
  BrainContext,
  BrainRequest,
  ModelRequestAdmission,
  ModelRoute,
  ModelRun,
} from '@jarvis/contracts';
import type { OpenAiModelRouteConfiguration } from '@jarvis/config';

export interface ModelGatewayRequest {
  readonly request: BrainRequest;
  readonly context: BrainContext;
  readonly route: ModelRoute;
  /** Trusted deterministic routing only; never parsed from model output or transport payload. */
  readonly reasoningEffortOverride?: 'low';
  readonly instructions: string;
  /** A purpose-built JSON document, never a database dump or provider conversation reference. */
  readonly input: string;
  readonly admission?: ModelRequestAdmission;
}

export function effectiveModelRouteConfiguration(
  configured: OpenAiModelRouteConfiguration,
  request: ModelGatewayRequest,
): OpenAiModelRouteConfiguration {
  return request.route === 'standard' &&
    ['openai/gpt-6-luna', 'gpt-6-luna'].includes(configured.model) &&
    configured.reasoningEffort === 'medium' &&
    request.reasoningEffortOverride === 'low'
    ? { ...configured, reasoningEffort: 'low' }
    : configured;
}

export interface ModelGatewayCompletedResult {
  readonly status: 'completed';
  /** The untrusted, in-memory parsed result; ConversationTurnService validates it with Zod. */
  readonly decision: unknown;
  readonly run: ModelRun;
}

export interface ModelGatewayFailedResult {
  readonly status:
    | 'not_configured'
    | 'unavailable'
    | 'configuration_error'
    | 'incomplete_output'
    | 'filtered'
    | 'refused'
    | 'invalid_model_output';
  readonly safeError: string;
  readonly run: ModelRun;
}

export type ModelGatewayResult = ModelGatewayCompletedResult | ModelGatewayFailedResult;

/** Provider-neutral boundary; implementations cannot reach repositories, policy, or executors. */
export interface ModelGateway {
  preflight?(
    request: ModelGatewayRequest,
    limits: { readonly dynamicContextBudgetTokens: number },
  ): Promise<ModelRequestAdmission>;
  decide(request: ModelGatewayRequest): Promise<ModelGatewayResult>;
}
