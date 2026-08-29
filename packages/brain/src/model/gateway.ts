import type { BrainContext, BrainRequest, ModelRoute, ModelRun } from '@jarvis/contracts';

export interface ModelGatewayRequest {
  readonly request: BrainRequest;
  readonly context: BrainContext;
  readonly route: ModelRoute;
  readonly instructions: string;
  /** A purpose-built JSON document, never a database dump or provider conversation reference. */
  readonly input: string;
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
  decide(request: ModelGatewayRequest): Promise<ModelGatewayResult>;
}
