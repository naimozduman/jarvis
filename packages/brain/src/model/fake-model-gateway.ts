import { randomUUID } from 'node:crypto';

import type { ModelGateway, ModelGatewayRequest, ModelGatewayResult } from './gateway.js';

export type FakeModelFixture =
  | { readonly kind: 'decision'; readonly decision: unknown; readonly modelId?: string }
  | {
      readonly kind: 'failure';
      readonly status: Exclude<ModelGatewayResult['status'], 'completed'>;
      readonly safeError: string;
    };

/** Deterministic test gateway. A test must deliberately enqueue each result; it never improvises. */
export class FakeModelGateway implements ModelGateway {
  private readonly fixtures: FakeModelFixture[];
  public readonly requests: ModelGatewayRequest[] = [];

  public constructor(fixtures: readonly FakeModelFixture[] = []) {
    this.fixtures = [...fixtures];
  }

  public enqueue(fixture: FakeModelFixture): void {
    this.fixtures.push(fixture);
  }

  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    this.requests.push(request);
    const fixture = this.fixtures.shift();
    const createdAt = new Date().toISOString();

    if (!fixture) {
      return {
        status: 'configuration_error',
        safeError: 'The deterministic fake model has no fixture for this request.',
        run: {
          id: randomUUID(),
          ownerId: request.request.ownerId,
          brainRequestId: request.request.id,
          route: request.route,
          configuredModelId: 'fake-model',
          actualModelId: 'fake-model',
          reasoningEffort: null,
          status: 'configuration_error',
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cachedInputTokens: 0,
          estimatedCostUsd: 0,
          errorCategory: 'missing_fixture',
          createdAt,
        },
      };
    }

    if (fixture.kind === 'failure') {
      return {
        status: fixture.status,
        safeError: fixture.safeError,
        run: {
          id: randomUUID(),
          ownerId: request.request.ownerId,
          brainRequestId: request.request.id,
          route: request.route,
          configuredModelId: 'fake-model',
          actualModelId: 'fake-model',
          reasoningEffort: null,
          status: fixture.status,
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cachedInputTokens: 0,
          estimatedCostUsd: 0,
          errorCategory: fixture.status,
          createdAt,
        },
      };
    }

    return {
      status: 'completed',
      decision: fixture.decision,
      run: {
        id: randomUUID(),
        ownerId: request.request.ownerId,
        brainRequestId: request.request.id,
        route: request.route,
        configuredModelId: 'fake-model',
        actualModelId: fixture.modelId ?? 'fake-model',
        reasoningEffort: null,
        status: 'completed',
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        estimatedCostUsd: 0,
        errorCategory: null,
        createdAt,
      },
    };
  }
}
