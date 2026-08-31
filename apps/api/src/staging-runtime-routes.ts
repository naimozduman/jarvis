import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { ApplicationEnvironment } from '@jarvis/config';
import type { DurableJob, DurableJobInput } from '@jarvis/contracts';
import type { EventPipelineDependencies } from '@jarvis/domain';
import type { AuthenticationBoundary } from '@jarvis/security';
import { OwnerAuthorizationError } from '@jarvis/security';

import { ingestAuthenticatedEvent } from './events.js';

interface SyntheticTurn {
  readonly message: string;
  readonly idempotencyKey: string;
}

/** Deliberately accepts no owner, action, tool, provider, or arbitrary event field. */
function parseSyntheticTurn(value: unknown): SyntheticTurn | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'message' && key !== 'idempotencyKey')) {
    return undefined;
  }
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  const idempotencyKey =
    typeof record.idempotencyKey === 'string' ? record.idempotencyKey.trim() : '';
  if (
    message.length === 0 ||
    message.length > 4_000 ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 256
  ) {
    return undefined;
  }
  return { message, idempotencyKey };
}

export interface StagingRuntimeRouteDependencies {
  readonly appEnvironment: ApplicationEnvironment;
  readonly ownerId: string | undefined;
  /** Never logged or returned. Its absence means the route is not registered. */
  readonly accessToken: string | undefined;
  readonly pipeline: EventPipelineDependencies;
  /** Serverless composition signals this opaque canonical job only after ingress committed. */
  readonly signalCanonicalJob?: (job: DurableJob | DurableJobInput) => Promise<void>;
  /** Allows an idempotent replay to repair a lost coordinator signal without creating a new job. */
  readonly loadCanonicalJobForEvent?: (eventId: string) => Promise<DurableJob | undefined>;
  readonly now?: () => Date;
}

function secretDigest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function hasExpectedBearerToken(value: string | undefined, expected: string): boolean {
  if (!value?.startsWith('Bearer ')) {
    return false;
  }
  const candidate = secretDigest(value.slice('Bearer '.length).trim());
  const known = secretDigest(expected);
  return timingSafeEqual(known, candidate);
}

function requestHeaders(
  headers: FastifyRequest['headers'],
): Readonly<Record<string, string | undefined>> {
  const normalized: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name] = typeof value === 'string' ? value : undefined;
  }
  return normalized;
}

function stagingAuthentication(input: {
  readonly ownerId: string;
  readonly accessToken: string;
}): AuthenticationBoundary {
  return {
    async authenticate(context) {
      if (!hasExpectedBearerToken(context.headers.authorization, input.accessToken)) {
        throw new OwnerAuthorizationError('The staging runtime route requires trusted access.');
      }
      return {
        ownerId: input.ownerId,
        // This narrow machine credential acts as its own trusted principal; it does not create a
        // public user/session path and can only ingest the synthetic event below.
        subjectId: input.ownerId,
        authMethod: 'trusted_client',
        scopes: ['events:ingest'],
      };
    },
  };
}

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

  const authentication = stagingAuthentication({
    ownerId: dependencies.ownerId,
    accessToken: dependencies.accessToken,
  });
  app.post('/internal/staging/synthetic-turn', async (request, reply) => {
    const body = parseSyntheticTurn(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'invalid_synthetic_turn' });
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
          headers: requestHeaders(request.headers),
          method: request.method,
          path: '/internal/staging/synthetic-turn',
          body: {
            eventType: 'internal.conversation.received.v1',
            source: 'internal',
            sourceEventId: `staging-runtime:${body.idempotencyKey}`,
            idempotencyKey: body.idempotencyKey,
            occurredAt: now.toISOString(),
            schemaVersion: 1,
            payload: {
              kind: 'synthetic_conversation_turn',
              message: body.message,
            },
            correlationId: randomUUID(),
          },
        },
      );
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
}
