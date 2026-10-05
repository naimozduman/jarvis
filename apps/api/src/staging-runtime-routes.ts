import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { ApplicationEnvironment } from '@jarvis/config';
import type {
  DurableJob,
  DurableJobInput,
  ProductionSmokeCaseId,
  SyntheticCasualChatCaseId,
  SyntheticBrainQualityCaseId,
} from '@jarvis/contracts';
import {
  isProductionSmokeCaseId,
  isProductionSmokeRunId,
  isSyntheticCasualChatCaseId,
  isSyntheticBrainQualityCaseId,
  productionSmokeFixtureIds,
} from '@jarvis/contracts';
import type { EventPipelineDependencies } from '@jarvis/domain';
import { OwnerAuthorizationError } from '@jarvis/security';
import {
  fastChatBenchmarkCandidates,
  type FastChatBenchmarkCandidate,
} from './casual-chat-benchmark-profile.js';

import { ingestAuthenticatedEvent } from './events.js';
import {
  createStagingRuntimeAuthentication,
  hasExpectedStagingBearerToken,
  normalizedRequestHeaders,
} from './staging-runtime-auth.js';

interface GenericSyntheticTurn {
  readonly kind: 'generic';
  readonly message: string;
  readonly idempotencyKey: string;
}

interface QualitySyntheticTurn {
  readonly kind: 'quality';
  readonly caseId: SyntheticBrainQualityCaseId;
  readonly idempotencyKey: string;
}

type SyntheticTurn = GenericSyntheticTurn | QualitySyntheticTurn;

interface ProductionSmokeTurn {
  readonly runId: string;
  readonly caseId: ProductionSmokeCaseId;
  readonly idempotencyKey: string;
}

interface CasualChatBenchmarkTurn {
  readonly runId: string;
  readonly caseId: SyntheticCasualChatCaseId;
  readonly reasoning: 'medium' | 'low';
  readonly candidate?: FastChatBenchmarkCandidate;
}

/** Deliberately accepts no owner, arbitrary context, action, tool, provider, or event field. */
function parseSyntheticTurn(value: unknown): SyntheticTurn | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const idempotencyKey =
    typeof record.idempotencyKey === 'string' ? record.idempotencyKey.trim() : '';
  if (idempotencyKey.length < 16 || idempotencyKey.length > 256) {
    return undefined;
  }
  if (
    Object.keys(record).every((key) => key === 'message' || key === 'idempotencyKey') &&
    typeof record.message === 'string'
  ) {
    const message = record.message.trim();
    return message.length > 0 && message.length <= 4_000
      ? { kind: 'generic', message, idempotencyKey }
      : undefined;
  }
  if (
    Object.keys(record).every((key) => key === 'caseId' || key === 'idempotencyKey') &&
    isSyntheticBrainQualityCaseId(record.caseId)
  ) {
    return { kind: 'quality', caseId: record.caseId, idempotencyKey };
  }
  return undefined;
}

/** A fixed case selector and UUID run marker only; no owner, fixture, context, or action enters. */
function parseProductionSmokeTurn(value: unknown): ProductionSmokeTurn | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const idempotencyKey =
    typeof record.idempotencyKey === 'string' ? record.idempotencyKey.trim() : '';
  if (
    !Object.keys(record).every(
      (key) => key === 'runId' || key === 'caseId' || key === 'idempotencyKey',
    ) ||
    !isProductionSmokeRunId(record.runId) ||
    !isProductionSmokeCaseId(record.caseId) ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 256
  ) {
    return undefined;
  }
  return { runId: record.runId, caseId: record.caseId, idempotencyKey };
}

function parseProductionSmokeCleanup(value: unknown): { readonly runId: string } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && isProductionSmokeRunId(record.runId)
    ? { runId: record.runId }
    : undefined;
}

/** The caller selects only a fixed prompt and a tested reasoning setting; no free text enters. */
function parseCasualChatBenchmarkTurn(value: unknown): CasualChatBenchmarkTurn | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    !Object.keys(record).every(
      (key) => key === 'runId' || key === 'caseId' || key === 'reasoning' || key === 'candidate',
    ) ||
    !isProductionSmokeRunId(record.runId) ||
    !isSyntheticCasualChatCaseId(record.caseId) ||
    (record.reasoning !== 'medium' && record.reasoning !== 'low') ||
    (record.candidate !== undefined &&
      (typeof record.candidate !== 'string' ||
        !Object.hasOwn(fastChatBenchmarkCandidates, record.candidate) ||
        record.reasoning !== 'low'))
  )
    return undefined;
  return {
    runId: record.runId,
    caseId: record.caseId,
    reasoning: record.reasoning,
    ...(record.candidate ? { candidate: record.candidate as FastChatBenchmarkCandidate } : {}),
  };
}

export interface StagingRuntimeRouteDependencies {
  readonly appEnvironment: ApplicationEnvironment;
  readonly ownerId: string | undefined;
  /** Never logged or returned. Its absence means the route is not registered. */
  readonly accessToken: string | undefined;
  readonly pipeline: EventPipelineDependencies;
  /** Fixed server-side quality fixtures only; the request body cannot supply their context. */
  readonly prepareQualityCase?: (input: {
    readonly caseId: SyntheticBrainQualityCaseId;
  }) => Promise<void>;
  /**
   * Dedicated, deterministic synthetic owner and fixture scope for deployed acceptance. These
   * methods never accept caller-provided owner IDs or arbitrary cleanup predicates.
   */
  readonly prepareProductionSmokeCase?: (input: {
    readonly runId: string;
    readonly caseId: ProductionSmokeCaseId;
  }) => Promise<{ readonly ownerId: string }>;
  readonly cleanupProductionSmokeRun?: (input: { readonly runId: string }) => Promise<void>;
  /** One fixed synthetic case per authenticated call; no arbitrary prompt or owner can enter. */
  readonly runCasualChatBenchmark?: (input: CasualChatBenchmarkTurn) => Promise<{
    readonly responseStatus: string;
    readonly responseMessage: string | null;
    readonly strictSchemaSuccess: boolean;
    readonly model: {
      readonly provider: string | null;
      readonly modelId: string | null;
      readonly reasoningEffort: string | null;
      readonly inputTokens: number | null;
      readonly outputTokens: number | null;
      readonly reasoningTokens: number | null;
      readonly exactGatewayCostUsd: number | null;
      readonly modelLatencyMs: number | null;
    };
    readonly brainProcessingLatencyMs: number;
    readonly errorCategory?: string | null;
  }>;
  /** Serverless composition signals this opaque canonical job only after ingress committed. */
  readonly signalCanonicalJob?: (job: DurableJob | DurableJobInput) => Promise<void>;
  /** Allows an idempotent replay to repair a lost coordinator signal without creating a new job. */
  readonly loadCanonicalJobForEvent?: (eventId: string) => Promise<DurableJob | undefined>;
  readonly now?: () => Date;
}

/** Fixed benchmark composition remains independent from generic staging ingress. */
export type CasualChatBenchmarkRouteDependencies = Pick<
  StagingRuntimeRouteDependencies,
  'accessToken' | 'runCasualChatBenchmark' | 'cleanupProductionSmokeRun'
>;

/**
 * A non-public staging probe. It is deliberately absent outside APP_ENV=staging and absent when
 * a trusted operator has not configured both an owner reference and a per-environment secret.
 * It invokes canonical ingress only; a worker later runs the Brain through its normal durable job.
 */
export function registerStagingRuntimeRoutes(
  app: FastifyInstance,
  dependencies: StagingRuntimeRouteDependencies | undefined,
): void {
  if (
    !dependencies ||
    dependencies.appEnvironment !== 'staging' ||
    !dependencies.ownerId ||
    !dependencies.accessToken
  ) {
    return;
  }

  const authentication = createStagingRuntimeAuthentication({
    ownerId: dependencies.ownerId,
    accessToken: dependencies.accessToken,
  });
  app.post('/internal/staging/synthetic-turn', async (request, reply) => {
    const body = parseSyntheticTurn(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'invalid_synthetic_turn' });
    }
    if (body.kind === 'quality' && !dependencies.prepareQualityCase) {
      // Keep the fixed quality suite absent from generic/local staging composition. It must never
      // persist an event that a non-quality worker could later misinterpret.
      return reply.code(404).send({ error: 'staging_quality_unavailable' });
    }

    try {
      const now = dependencies.now?.() ?? new Date();
      const result = await ingestAuthenticatedEvent(
        {
          authentication,
          pipeline: dependencies.pipeline,
          ...(dependencies.now ? { now: dependencies.now } : {}),
        },
        {
          headers: normalizedRequestHeaders(request.headers),
          method: request.method,
          path: '/internal/staging/synthetic-turn',
          body: {
            eventType: 'internal.conversation.received.v1',
            source: 'internal',
            sourceEventId:
              body.kind === 'quality'
                ? `staging-luna-quality:${body.caseId}:${body.idempotencyKey}`
                : `staging-runtime:${body.idempotencyKey}`,
            idempotencyKey:
              body.kind === 'quality'
                ? `staging-luna-quality:${body.caseId}:${body.idempotencyKey}`
                : body.idempotencyKey,
            occurredAt: now.toISOString(),
            schemaVersion: 1,
            payload:
              body.kind === 'quality'
                ? { kind: 'synthetic_brain_quality_case', caseId: body.caseId }
                : { kind: 'synthetic_conversation_turn', message: body.message },
            correlationId: randomUUID(),
          },
        },
      );
      if (body.kind === 'quality') {
        // This happens after trusted ingress authentication and before the opaque job wake-up, so
        // no worker can see a quality event before its fixed canonical fixtures exist.
        await dependencies.prepareQualityCase!({ caseId: body.caseId });
      }
      if (dependencies.signalCanonicalJob) {
        const job = result.job ?? (await dependencies.loadCanonicalJobForEvent?.(result.event.id));
        if (!job) {
          // A committed event without its canonical job is an integrity failure. Do not return a
          // false accepted response or invent an in-memory fallback.
          throw new Error('Canonical event ingress has no durable job to signal.');
        }
        await dependencies.signalCanonicalJob(job);
      }
      return reply.code(result.duplicate ? 200 : 202).send({
        accepted: true,
        duplicate: result.duplicate,
        eventId: result.event.id,
      });
    } catch (error) {
      if (error instanceof OwnerAuthorizationError) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      // Canonical parsing, queue, and database failures are intentionally opaque to the caller.
      return reply.code(503).send({ error: 'staging_ingress_unavailable' });
    }
  });

  app.post('/internal/staging/production-smoke', async (request, reply) => {
    const body = parseProductionSmokeTurn(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'invalid_production_smoke_turn' });
    }
    if (!dependencies.prepareProductionSmokeCase) {
      return reply.code(404).send({ error: 'production_smoke_unavailable' });
    }
    const fixtureIds = productionSmokeFixtureIds(body.runId);
    try {
      // Authenticate before creating the fixture owner or mutating any canonical state.
      if (!hasExpectedStagingBearerToken(request.headers.authorization, dependencies.accessToken!)) {
        throw new OwnerAuthorizationError('The staging runtime route requires trusted access.');
      }
      // Fixture creation occurs before canonical ingress because events carry a foreign key to
      // their owner. The only possible owner is derived from the UUID run marker above.
      const prepared = await dependencies.prepareProductionSmokeCase({
        runId: body.runId,
        caseId: body.caseId,
      });
      if (prepared.ownerId !== fixtureIds.owner) {
        throw new Error('Production-smoke fixture preparation returned an unsafe owner scope.');
      }
      const authentication = createStagingRuntimeAuthentication({
        ownerId: fixtureIds.owner,
        accessToken: dependencies.accessToken!,
      });
      const now = dependencies.now?.() ?? new Date();
      const eventKey = `production-smoke:${body.runId}:${body.caseId}:${body.idempotencyKey}`;
      const result = await ingestAuthenticatedEvent(
        {
          authentication,
          pipeline: dependencies.pipeline,
          ...(dependencies.now ? { now: dependencies.now } : {}),
        },
        {
          headers: normalizedRequestHeaders(request.headers),
          method: request.method,
          path: '/internal/staging/production-smoke',
          body: {
            eventType: 'internal.conversation.received.v1',
            source: 'internal',
            sourceEventId: eventKey,
            idempotencyKey: eventKey,
            occurredAt: now.toISOString(),
            schemaVersion: 1,
            payload: {
              kind: 'production_smoke_case',
              runId: body.runId,
              caseId: body.caseId,
            },
            correlationId: randomUUID(),
          },
        },
      );
      if (dependencies.signalCanonicalJob) {
        const job = result.job ?? (await dependencies.loadCanonicalJobForEvent?.(result.event.id));
        if (!job) {
          throw new Error('Canonical production-smoke ingress has no durable job to signal.');
        }
        await dependencies.signalCanonicalJob(job);
      }
      return reply.code(result.duplicate ? 200 : 202).send({
        accepted: true,
        duplicate: result.duplicate,
        eventId: result.event.id,
      });
    } catch (error) {
      if (error instanceof OwnerAuthorizationError) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      return reply.code(503).send({ error: 'production_smoke_unavailable' });
    }
  });

  app.post('/internal/staging/production-smoke/cleanup', async (request, reply) => {
    const body = parseProductionSmokeCleanup(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'invalid_production_smoke_cleanup' });
    }
    if (!dependencies.cleanupProductionSmokeRun) {
      return reply.code(404).send({ error: 'production_smoke_unavailable' });
    }
    try {
      // This is the same trusted staging credential check used by canonical ingress. The target
      // remains the exact synthetic owner derived by the repository, never a request parameter.
      if (!hasExpectedStagingBearerToken(request.headers.authorization, dependencies.accessToken!)) {
        throw new OwnerAuthorizationError('The staging runtime route requires trusted access.');
      }
      await dependencies.cleanupProductionSmokeRun({ runId: body.runId });
      return reply.code(200).send({ cleaned: true });
    } catch (error) {
      if (error instanceof OwnerAuthorizationError) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      return reply.code(503).send({ error: 'production_smoke_cleanup_unavailable' });
    }
  });
}

/** A bounded synthetic measurement route. It is absent unless explicitly composed with a secret. */
export function registerCasualChatBenchmarkRoute(
  app: FastifyInstance,
  dependencies: CasualChatBenchmarkRouteDependencies | undefined,
): void {
  const accessToken = dependencies?.accessToken;
  const runCasualChatBenchmark = dependencies?.runCasualChatBenchmark;
  const cleanupProductionSmokeRun = dependencies?.cleanupProductionSmokeRun;
  if (!accessToken || !runCasualChatBenchmark) return;
  app.post('/internal/benchmark/casual-chat', async (request, reply) => {
    const body = parseCasualChatBenchmarkTurn(request.body);
    if (!body) return reply.code(400).send({ error: 'invalid_casual_chat_benchmark_turn' });
    try {
      if (!hasExpectedStagingBearerToken(request.headers.authorization, accessToken)) {
        throw new OwnerAuthorizationError('The staging runtime route requires trusted access.');
      }
      // The implementation has no delivery adapter and no action authority beyond the existing
      // synthetic-quality policy. It is a bounded Gateway measurement probe only.
      return reply.code(200).send(await runCasualChatBenchmark(body));
    } catch (error) {
      if (error instanceof OwnerAuthorizationError)
        return reply.code(401).send({ error: 'unauthorized' });
      return reply.code(503).send({ error: 'casual_chat_benchmark_unavailable' });
    }
  });
  app.post('/internal/benchmark/casual-chat/cleanup', async (request, reply) => {
    const body = parseProductionSmokeCleanup(request.body);
    if (!body) return reply.code(400).send({ error: 'invalid_casual_chat_benchmark_cleanup' });
    if (!cleanupProductionSmokeRun) {
      return reply.code(404).send({ error: 'casual_chat_benchmark_cleanup_unavailable' });
    }
    try {
      if (!hasExpectedStagingBearerToken(request.headers.authorization, accessToken)) {
        throw new OwnerAuthorizationError('The benchmark cleanup requires trusted access.');
      }
      await cleanupProductionSmokeRun({ runId: body.runId });
      return reply.code(200).send({ cleaned: true });
    } catch (error) {
      if (error instanceof OwnerAuthorizationError)
        return reply.code(401).send({ error: 'unauthorized' });
      return reply.code(503).send({ error: 'casual_chat_benchmark_cleanup_unavailable' });
    }
  });
}
