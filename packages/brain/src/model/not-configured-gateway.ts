import { randomUUID } from 'node:crypto';

import type { ModelGateway, ModelGatewayRequest, ModelGatewayResult } from './gateway.js';

/**
 * Deliberate provider-free default. It is not a fake: it reports that no configured model ran and
 * gives the orchestration layer a safe result with no decision and no proposed actions.
 */
export class NotConfiguredModelGateway implements ModelGateway {
  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    return {
      status: 'not_configured',
      safeError: 'The model provider is not configured for this environment.',
      run: {
        id: randomUUID(),
        ownerId: request.request.ownerId,
        brainRequestId: request.request.id,
        provider: 'not_configured',
        route: request.route,
        configuredModelId: 'not_configured',
        actualModelId: null,
        reasoningEffort: null,
        status: 'not_configured',
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
        reasoningTokens: null,
        cachedInputTokens: null,
        estimatedCostUsd: null,
        errorCategory: 'not_configured',
        createdAt: new Date().toISOString(),
      },
    };
  }
}
