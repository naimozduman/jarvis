import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { messagingSendResultSchema } from '@jarvis/contracts';
import type { MessagingSendResult } from '@jarvis/contracts';
import type {
  LocalBridgeLeaseOutcome,
  LocalBridgeResultOutcome,
  WhatsAppCloudBridgeDeliveryRepository,
} from '@jarvis/database';
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
  return typeof value === 'string' && /^[a-z][a-z0-9._:-]{7,159}$/i.test(value) ? value : undefined;
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

export interface WhatsAppCloudBridgeRouteDependencies {
  /** The route is absent unless the direct-owner surface is explicitly composed. */
  readonly accessToken: string | undefined;
  readonly ownerId: string | undefined;
  readonly connectionId: string | undefined;
  readonly bridgeId: string | undefined;
  readonly deliveries: WhatsAppCloudBridgeDeliveryRepository | undefined;
  readonly orchestration: Pick<OrchestrationPublisher, 'scheduleTransportSignal'> | undefined;
  readonly now?: () => Date;
}

/**
 * The dedicated official Cloud bridge may retrieve a persisted reply only by presenting a
 * short-lived canonical lease. This is not a public user API, and no signal carries the text or
 * a Meta identifier. The result records Graph acceptance as `sent`; delivery/read are separate
 * provider evidence and must never be inferred here.
 */
export function registerWhatsAppCloudBridgeRoutes(
  app: FastifyInstance,
  dependencies: WhatsAppCloudBridgeRouteDependencies | undefined,
): void {
  if (
    !dependencies?.accessToken ||
    !dependencies.ownerId ||
    !dependencies.connectionId ||
    !dependencies.bridgeId ||
    !dependencies.deliveries ||
    !dependencies.orchestration
  ) {
    return;
  }
  const now = () => dependencies.now?.() ?? new Date();
  const unauthorized = (request: FastifyRequest) =>
    !authenticated(request, dependencies.accessToken!);
  const wrongBridge = (candidate: string) => candidate !== dependencies.bridgeId;

  app.post(
    '/internal/whatsapp-cloud-bridge/deliveries/:deliveryId/lease',
    async (request, reply) => {
      if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
      const id = deliveryId((request.params as { readonly deliveryId?: unknown }).deliveryId);
      const body = leaseRequest(request.body);
      if (!id || !body) return reply.code(400).send({ error: 'invalid_bridge_request' });
      if (wrongBridge(body.bridgeId)) return reply.code(403).send({ error: 'forbidden_bridge' });
      try {
        const outcome =
          await dependencies.deliveries!.acquireOutboundDeliveryLeaseForWhatsAppCloudBridge({
            ownerId: dependencies.ownerId!,
            deliveryId: id,
            bridgeId: body.bridgeId,
            now: now(),
          });
        return reply.header('cache-control', 'no-store').code(200).send(safeLeaseResponse(outcome));
      } catch {
        return reply.code(503).send({ error: 'canonical_delivery_unavailable' });
      }
    },
  );

  app.post(
    '/internal/whatsapp-cloud-bridge/deliveries/:deliveryId/result',
    async (request, reply) => {
      if (unauthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
      const id = deliveryId((request.params as { readonly deliveryId?: unknown }).deliveryId);
      const body = resultRequest(request.body);
      if (!id || !body) return reply.code(400).send({ error: 'invalid_bridge_request' });
      if (wrongBridge(body.bridgeId)) return reply.code(403).send({ error: 'forbidden_bridge' });
      try {
        const outcome = await dependencies.deliveries!.recordWhatsAppCloudBridgeDeliveryResult({
          ownerId: dependencies.ownerId!,
          deliveryId: id,
          bridgeId: body.bridgeId,
          leaseToken: body.leaseToken,
          result: body.result,
          now: now(),
        });
        if (outcome.disposition === 'retry_scheduled') {
          // The signal contains only the opaque delivery ID. A replay remains safe because the
          // canonical delivery row owns the next attempt and its current lease.
          await dependencies.orchestration!.scheduleTransportSignal({
            deliveryId: id,
            scheduledAt: outcome.retryAt,
          });
        }
        return reply
          .header('cache-control', 'no-store')
          .code(200)
          .send(safeResultResponse(outcome));
      } catch {
        return reply.code(503).send({ error: 'canonical_delivery_unavailable' });
      }
    },
  );
}
