import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type {
  CanonicalJobExecutionResult,
  StatelessCanonicalJobExecutor,
} from '@jarvis/orchestration';

const triggerTypes = new Set([
  'canonical_job',
  'retry',
  'reminder',
  'follow_up',
  'transport_delivery',
]);

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authenticated(request: FastifyRequest, secret: string): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return false;
  }
  return timingSafeEqual(digest(secret), digest(header.slice('Bearer '.length).trim()));
}

function body(
  value: unknown,
):
  | { readonly correlationId: string; readonly triggerType: string; readonly generation: number }
  | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => key !== 'correlationId' && key !== 'triggerType' && key !== 'generation',
    ) ||
    typeof record.correlationId !== 'string' ||
    record.correlationId.length === 0 ||
    record.correlationId.length > 128 ||
    typeof record.triggerType !== 'string' ||
    !triggerTypes.has(record.triggerType) ||
    typeof record.generation !== 'number' ||
    !Number.isInteger(record.generation) ||
    record.generation < 1
  ) {
    return undefined;
  }
  return {
    correlationId: record.correlationId,
    triggerType: record.triggerType,
    generation: record.generation,
  };
}

export interface OrchestrationRouteDependencies {
  /** Absent means the route is not exposed at all. Never log or return this secret. */
  readonly callbackSecret: string | undefined;
  readonly executor: StatelessCanonicalJobExecutor | undefined;
}

function responseFor(result: CanonicalJobExecutionResult): {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
} {
  if (result.disposition === 'retry_allowed') {
    return { status: 202, body: { disposition: result.disposition, retryAt: result.retryAt } };
  }
  return { status: 200, body: { disposition: result.disposition } };
}

/**
 * Convex may wake this endpoint, but it cannot choose an owner, payload, action, or provider.
 * The handler accepts an opaque job ID in the path and rehydrates/leases all canonical state from
 * Neon through `StatelessCanonicalJobExecutor`.
 */
export function registerOrchestrationRoutes(
  app: FastifyInstance,
  dependencies: OrchestrationRouteDependencies | undefined,
): void {
  const callbackSecret = dependencies?.callbackSecret;
  const executor = dependencies?.executor;
  if (!callbackSecret || !executor) {
    return;
  }
  app.post('/internal/orchestration/jobs/:jobId/run', async (request, reply) => {
    if (!authenticated(request, callbackSecret)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const jobId = (request.params as { readonly jobId?: unknown }).jobId;
    const parsed = body(request.body);
    if (
      typeof jobId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId) ||
      !parsed
    ) {
      return reply.code(400).send({ error: 'invalid_orchestration_request' });
    }
    try {
      const result = await executor.run({
        jobId,
        correlationId: parsed.correlationId,
      });
      const response = responseFor(result);
      return reply.header('cache-control', 'no-store').code(response.status).send(response.body);
    } catch {
      // Only a structured retry disposition may cause another Convex schedule. A raw provider or
      // database exception never crosses this trust boundary.
      return reply.code(503).send({ disposition: 'retry_not_allowed' });
    }
  });
}
