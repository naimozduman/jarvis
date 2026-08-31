import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  incomingEventEnvelopeSchema,
  messagingConnectionStateSchema,
  messagingSendResultSchema,
} from '@jarvis/contracts';
import type {
  IncomingEventEnvelope,
  MessagingConnectionState,
  MessagingSendResult,
} from '@jarvis/contracts';
import type {
  LocalBridgeDeliveryRepository,
  LocalBridgeLeaseOutcome,
  LocalBridgeResultOutcome,
} from '@jarvis/database';
import { ingestCanonicalEvent } from '@jarvis/domain';
import type { DurableJob, DurableJobInput } from '@jarvis/contracts';
import type { EventPipelineDependencies } from '@jarvis/domain';
import type { OrchestrationPublisher } from '@jarvis/orchestration';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authenticated(request: FastifyRequest, secret: string): boolean {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;
  return timingSafeEqual(digest(secret), digest(authorization.slice('Bearer '.length).trim()));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function bridgeId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{8,160}$/.test(value) ? value : undefined;
}

function deliveryId(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function leaseRequest(value: unknown): { readonly bridgeId: string } | undefined {
  const parsed = record(value);
  if (!parsed || Object.keys(parsed).some((key) => key !== 'bridgeId')) return undefined;
  const id = bridgeId(parsed.bridgeId);
  return id ? { bridgeId: id } : undefined;
}

function resultRequest(
  value: unknown,
):
  | { readonly bridgeId: string; readonly leaseToken: string; readonly result: MessagingSendResult }
  | undefined {
  const parsed = record(value);
  if (
    !parsed ||
    Object.keys(parsed).some(
      (key) => key !== 'bridgeId' && key !== 'leaseToken' && key !== 'result',
    )
  ) {
    return undefined;
  }
  const id = bridgeId(parsed.bridgeId);
  const leaseToken =
    typeof parsed.leaseToken === 'string' && /^[0-9a-f-]{36}$/i.test(parsed.leaseToken)
      ? parsed.leaseToken
      : undefined;
  const result = messagingSendResultSchema.safeParse(parsed.result);
  return id && leaseToken && result.success
    ? { bridgeId: id, leaseToken, result: result.data }
    : undefined;
}

function heartbeatRequest(value: unknown):
  | {
      readonly bridgeId: string;
      readonly state: MessagingConnectionState;
      readonly safeErrorCategory: string | null;
    }
  | undefined {
  const parsed = record(value);
  if (
    !parsed ||
    Object.keys(parsed).some(
      (key) => key !== 'bridgeId' && key !== 'state' && key !== 'safeErrorCategory',
    )
  ) {
    return undefined;
  }
  const id = bridgeId(parsed.bridgeId);
  const state = messagingConnectionStateSchema.safeParse(parsed.state);
  const safeErrorCategory =
    parsed.safeErrorCategory === null
      ? null
      : typeof parsed.safeErrorCategory === 'string' &&
          /^[a-z0-9._:-]{1,80}$/i.test(parsed.safeErrorCategory)
        ? parsed.safeErrorCategory
        : undefined;
  return id && state.success && safeErrorCategory !== undefined
    ? { bridgeId: id, state: state.data, safeErrorCategory }
    : undefined;
}

function localIngress(value: unknown): IncomingEventEnvelope | undefined {
  const parsed = incomingEventEnvelopeSchema.safeParse(value);
  return parsed.success && parsed.data.source === 'whatsapp' ? parsed.data : undefined;
}

function safeLeaseResponse(outcome: LocalBridgeLeaseOutcome): Readonly<Record<string, unknown>> {
  if (outcome.status !== 'ready') return { status: outcome.status };
  return {
    status: 'ready',
    leaseToken: outcome.leaseToken,
    leaseExpiresAt: outcome.leaseExpiresAt,
    intent: outcome.intent,
  };
}

function safeResultResponse(outcome: LocalBridgeResultOutcome): Readonly<Record<string, unknown>> {
  return outcome.disposition === 'retry_scheduled'
    ? { disposition: outcome.disposition, retryAt: outcome.retryAt }
    : { disposition: outcome.disposition };
}

export interface LocalBridgeConnectionRepository {
  recordConnectionState(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly state: MessagingConnectionState;
    readonly occurredAt: string;
    readonly correlationId: string;
    readonly sourceEventId: string | null;
    readonly safeErrorCategory: string | null;
  }): Promise<void>;
}

export interface LocalBridgeRouteDependencies {
  /** The bridge route is absent unless all trusted scope and command dependencies are composed. */
  readonly accessToken: string | undefined;
  readonly ownerId: string | undefined;
  readonly connectionId: string | undefined;
  readonly deliveries: LocalBridgeDeliveryRepository | undefined;
  readonly connections: LocalBridgeConnectionRepository | undefined;
  readonly pipeline: EventPipelineDependencies | undefined;
  readonly orchestration:
    | Pick<
        OrchestrationPublisher,
        'acknowledgeTransportSignal' | 'scheduleJob' | 'scheduleTransportSignal'
      >
    | undefined;
  readonly loadCanonicalJobForEvent?: (eventId: string) => Promise<DurableJob | undefined>;
  readonly now?: () => Date;
}

/**
 * The trusted cloud/local boundary. Convex never reaches these routes and never receives their
 * payloads: it only wakes the bridge with opaque delivery IDs. Private text is loaded here from
 * canonical Neon after a short lease has been acquired for the authenticated local process.
 */
export function registerLocalBridgeRoutes(
  app: FastifyInstance,
  dependencies: LocalBridgeRouteDependencies | undefined,
): void {
  if (
    !dependencies?.accessToken ||
    !dependencies.ownerId ||
    !dependencies.connectionId ||
    !dependencies.deliveries ||
    !dependencies.connections ||
    !dependencies.pipeline ||
    !dependencies.orchestration
  ) {
    return;
  }
  const now = () => dependencies.now?.() ?? new Date();
  const unauthorized = (request: FastifyRequest) =>
    !authenticated(request, dependencies.accessToken!);

  app.post('/internal/local-bridge/deliveries/:deliveryId/lease', async (request, reply) => {
    if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
    const id = deliveryId((request.params as { readonly deliveryId?: unknown }).deliveryId);
    const body = leaseRequest(request.body);
    if (!id || !body) return reply.code(400).send({ error: 'invalid_bridge_request' });
    try {
      const outcome = await dependencies.deliveries!.acquireOutboundDeliveryLeaseForLocalBridge({
        ownerId: dependencies.ownerId!,
        deliveryId: id,
        bridgeId: body.bridgeId,
        now: now(),
      });
      return reply.header('cache-control', 'no-store').code(200).send(safeLeaseResponse(outcome));
    } catch {
      return reply.code(503).send({ error: 'canonical_delivery_unavailable' });
    }
  });

  app.post('/internal/local-bridge/deliveries/:deliveryId/result', async (request, reply) => {
    if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
    const id = deliveryId((request.params as { readonly deliveryId?: unknown }).deliveryId);
    const body = resultRequest(request.body);
    if (!id || !body) return reply.code(400).send({ error: 'invalid_bridge_request' });
    try {
      const outcome = await dependencies.deliveries!.recordLocalBridgeDeliveryResult({
        ownerId: dependencies.ownerId!,
        deliveryId: id,
        bridgeId: body.bridgeId,
        leaseToken: body.leaseToken,
        result: body.result,
        now: now(),
      });
      if (outcome.disposition === 'retry_scheduled') {
        // If Convex is temporarily unavailable, respond 503 without acknowledging the old signal.
        // A repeated callback is idempotent and will repair the opaque retry signal later.
        await dependencies.orchestration!.scheduleTransportSignal({
          deliveryId: id,
          scheduledAt: outcome.retryAt,
        });
      }
      return reply.header('cache-control', 'no-store').code(200).send(safeResultResponse(outcome));
    } catch {
      return reply.code(503).send({ error: 'canonical_delivery_unavailable' });
    }
  });

  app.post('/internal/local-bridge/signals/:deliveryId/:sequence/ack', async (request, reply) => {
    if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
    const params = request.params as { readonly deliveryId?: unknown; readonly sequence?: unknown };
    const id = deliveryId(params.deliveryId);
    const sequence = typeof params.sequence === 'string' ? Number(params.sequence) : Number.NaN;
    if (!id || !Number.isInteger(sequence) || sequence < 1) {
      return reply.code(400).send({ error: 'invalid_bridge_request' });
    }
    try {
      await dependencies.orchestration!.acknowledgeTransportSignal({
        deliveryId: id,
        sequence,
        acknowledgedAt: now().toISOString(),
      });
      return reply.header('cache-control', 'no-store').code(200).send({ acknowledged: true });
    } catch {
      return reply.code(503).send({ error: 'orchestration_unavailable' });
    }
  });

  app.post('/internal/local-bridge/heartbeat', async (request, reply) => {
    if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
    const body = heartbeatRequest(request.body);
    if (!body) return reply.code(400).send({ error: 'invalid_bridge_request' });
    try {
      await dependencies.connections!.recordConnectionState({
        ownerId: dependencies.ownerId!,
        connectionId: dependencies.connectionId!,
        state: body.state,
        occurredAt: now().toISOString(),
        correlationId: randomUUID(),
        sourceEventId: null,
        safeErrorCategory: body.safeErrorCategory,
      });
      return reply.header('cache-control', 'no-store').code(200).send({ acknowledged: true });
    } catch {
      return reply.code(503).send({ error: 'canonical_transport_unavailable' });
    }
  });

  app.post('/internal/local-bridge/events', async (request, reply) => {
    if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
    const envelope = localIngress(request.body);
    if (!envelope) return reply.code(400).send({ error: 'invalid_transport_event' });
    try {
      const ingested = await ingestCanonicalEvent(dependencies.pipeline!, {
        ownerId: dependencies.ownerId!,
        envelope,
        receivedAt: now().toISOString(),
        correlationId: envelope.correlationId ?? randomUUID(),
      });
      const canonicalJob: DurableJobInput | DurableJob | undefined =
        ingested.job ??
        (ingested.duplicate
          ? await dependencies.loadCanonicalJobForEvent?.(ingested.event.id)
          : undefined);
      if (canonicalJob) {
        await dependencies.orchestration!.scheduleJob({
          jobId: canonicalJob.id,
          correlationId: canonicalJob.correlationId,
          triggerType: 'canonical_job',
          scheduledAt: canonicalJob.availableAfter,
          generation: 1,
          maximumDispatchAttempts: canonicalJob.maximumAttempts,
        });
      }
      return reply
        .header('cache-control', 'no-store')
        .code(ingested.duplicate ? 200 : 202)
        .send({ accepted: true, duplicate: ingested.duplicate });
    } catch {
      return reply.code(503).send({ error: 'canonical_ingress_unavailable' });
    }
  });
}
