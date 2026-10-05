import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  whatsappCloudBridgeIngestEventSchema,
  whatsappCloudCanonicalPayloadSchema,
} from '@jarvis/contracts';
import type {
  DurableJob,
  DurableJobInput,
  IncomingEventEnvelope,
  WhatsAppCloudBridgeIngestEvent,
} from '@jarvis/contracts';
import { ingestCanonicalEvent } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';
import { canonicalJobSignal } from '@jarvis/orchestration';
import type { OrchestrationPublisher } from '@jarvis/orchestration';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authenticated(request: FastifyRequest, secret: string): boolean {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;
  return timingSafeEqual(digest(secret), digest(authorization.slice('Bearer '.length).trim()));
}

function opaqueReference(kind: 'conversation' | 'message' | 'participant', value: string): string {
  return `wa-cloud:${kind}:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function messageText(event: WhatsAppCloudBridgeIngestEvent): string | null {
  if (event.content.text !== undefined && event.content.text !== null) {
    return event.content.text;
  }
  const captions = (event.content.media ?? [])
    .flatMap((media) => (media.caption ? [media.caption] : []))
    .join('\n');
  return captions.length > 0 ? captions.slice(0, 10_000) : null;
}

function canonicalEnvelope(
  event: WhatsAppCloudBridgeIngestEvent,
  canonicalOwnerId: string,
): IncomingEventEnvelope {
  const participantReference = event.actor.external_id
    ? opaqueReference('participant', event.actor.external_id)
    : null;
  const payload = whatsappCloudCanonicalPayloadSchema.parse({
    kind: 'whatsapp_cloud_message_observed',
    transport: 'cloud_api',
    conversationType: 'direct',
    category: event.scope.category,
    conversationReference: opaqueReference('conversation', event.source.conversation_id),
    // A provider message ID is the logical-message identity. The bridge event ID is a safe,
    // durable fallback for message types where Cloud API does not provide one.
    providerMessageReference: opaqueReference('message', event.source.message_id ?? event.event_id),
    participantReference,
    // The bridge owns the participant-to-person mapping. JARVIS accepts only a true/false result
    // from that trusted mapping; it never receives a provider identifier, display name, or a
    // bridge-chosen canonical owner.
    ownerVerified:
      participantReference !== null && event.actor.jarvis_person_id === canonicalOwnerId,
    deliveryTargetReference: event.source.bridge_conversation_reference ?? null,
    messageType: event.content.message_type,
    text: messageText(event),
    media: (event.content.media ?? []).map((media) => ({ mimeType: media.mime_type ?? null })),
  });

  return {
    eventType: 'whatsapp.cloud.message.observed.v1',
    source: 'whatsapp',
    sourceEventId: event.event_id,
    idempotencyKey: `whatsapp-cloud-bridge:${event.event_id}`,
    occurredAt: event.occurred_at,
    payload,
    schemaVersion: 1,
    correlationId: event.event_id,
  };
}

export interface WhatsAppCloudIngestRouteDependencies {
  /** A server-only bridge-to-JARVIS credential; absence means the route is not registered. */
  readonly accessToken: string | undefined;
  /** Canonical owner selected by deployment configuration, never by a request body. */
  readonly ownerId: string | undefined;
  /** The bridge instance allowed to submit into this deployment, never an account or phone ID. */
  readonly expectedInstanceId: string | undefined;
  readonly pipeline: EventPipelineDependencies | undefined;
  /** Only opaque job signals leave the canonical database boundary after ingress commits. */
  readonly orchestration: Pick<OrchestrationPublisher, 'scheduleJob'> | undefined;
  /** Lets a duplicate delivery repair a missed opaque signal without making another canonical job. */
  readonly loadCanonicalJobForEvent?: (eventId: string) => Promise<DurableJob | undefined>;
  readonly now?: () => Date;
}

/**
 * Receives the stable, normalized bridge contract after the bridge has verified Meta's signature
 * and stored raw evidence. This endpoint must never accept raw Meta payloads directly.
 */
export function registerWhatsAppCloudIngestRoutes(
  app: FastifyInstance,
  dependencies: WhatsAppCloudIngestRouteDependencies | undefined,
): void {
  if (
    !dependencies?.accessToken ||
    !dependencies.ownerId ||
    !dependencies.expectedInstanceId ||
    !dependencies.pipeline ||
    !dependencies.orchestration
  ) {
    return;
  }

  app.post('/internal/ingest', async (request, reply) => {
    if (!authenticated(request, dependencies.accessToken!)) {
      return reply.header('cache-control', 'no-store').code(401).send({ error: 'unauthorized' });
    }

    const parsed = whatsappCloudBridgeIngestEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .header('cache-control', 'no-store')
        .code(400)
        .send({ error: 'invalid_bridge_event' });
    }
    const bridgeEvent = parsed.data;
    if (
      bridgeEvent.source.transport !== 'cloud_api' ||
      bridgeEvent.source.conversation_type !== 'direct'
    ) {
      return reply
        .header('cache-control', 'no-store')
        .code(400)
        .send({ error: 'unsupported_transport_scope' });
    }
    if (bridgeEvent.scope.owner_jarvis_id !== dependencies.expectedInstanceId) {
      return reply
        .header('cache-control', 'no-store')
        .code(403)
        .send({ error: 'unexpected_bridge_instance' });
    }

    try {
      const envelope = canonicalEnvelope(bridgeEvent, dependencies.ownerId!);
      const ingested = await ingestCanonicalEvent(dependencies.pipeline!, {
        ownerId: dependencies.ownerId!,
        envelope,
        receivedAt: (dependencies.now?.() ?? new Date()).toISOString(),
        correlationId: bridgeEvent.event_id,
      });
      const canonicalJob: DurableJobInput | DurableJob | undefined =
        ingested.job ??
        (ingested.duplicate
          ? await dependencies.loadCanonicalJobForEvent?.(ingested.event.id)
          : undefined);
      if (!canonicalJob) {
        // Returning an error causes the bridge outbox to retry. We never acknowledge an event
        // that committed without a recoverable canonical job signal.
        throw new Error('Canonical WhatsApp ingress has no durable job to signal.');
      }
      await dependencies.orchestration!.scheduleJob(canonicalJobSignal(canonicalJob));
      return reply
        .header('cache-control', 'no-store')
        .code(ingested.duplicate ? 200 : 202)
        .send({ accepted: true, duplicate: ingested.duplicate });
    } catch {
      // Do not expose provider metadata, message text, dependency details, or secrets. The bridge
      // retains the durable event and its own retry/dead-letter state for operator recovery.
      return reply
        .header('cache-control', 'no-store')
        .code(503)
        .send({ error: 'canonical_whatsapp_ingress_unavailable' });
    }
  });
}
