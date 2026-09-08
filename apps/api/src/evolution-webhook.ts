import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { NormalizedTransportEvent } from '@jarvis/contracts';
import { ingestCanonicalEvent } from '@jarvis/domain';
import type { EventPipelineDependencies, IngestEventResult } from '@jarvis/domain';
import type {
  EvolutionMessageMapper,
  EvolutionWebhookParser,
  EvolutionWebhookVerifier,
} from '@jarvis/integrations-evolution';

export interface RejectedEvolutionTransportEvent {
  readonly ownerId: string;
  readonly eventType: string;
  readonly reason: string;
  readonly instanceReference: string;
  readonly providerEventReference: string | null;
  readonly senderReference: string | null;
  readonly receivedAt: string;
}

export interface EvolutionTransportRejectionRecorder {
  record(input: RejectedEvolutionTransportEvent): Promise<void>;
}

export interface EvolutionWebhookIngressDependencies {
  readonly enabled: boolean;
  /** Canonical owner identity from trusted server configuration, never an Evolution field. */
  readonly ownerId: string;
  readonly expectedInstanceName: string;
  readonly pipeline: EventPipelineDependencies;
  readonly verifier: EvolutionWebhookVerifier;
  readonly parser: EvolutionWebhookParser;
  readonly mapper: EvolutionMessageMapper;
  /** Required whenever the route is enabled: policy-rejected traffic is an auditable event. */
  readonly rejectionRecorder: EvolutionTransportRejectionRecorder;
  readonly now?: () => Date;
  readonly bodyLimitBytes?: number;
}

export interface EvolutionWebhookAcknowledgement {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly disposition: 'queued' | 'duplicate' | 'rejected' | 'not_configured';
}

function canonicalEventType(event: NormalizedTransportEvent): string {
  switch (event.kind) {
    case 'message.received':
      return 'whatsapp.message.received.v1';
    case 'message.edited':
      return 'whatsapp.message.edited.v1';
    case 'message.deleted':
      return 'whatsapp.message.deleted.v1';
    case 'delivery.updated':
      return 'whatsapp.message.status.updated.v1';
    case 'connection.updated':
      return 'whatsapp.connection.state.changed.v1';
  }
}

function isJsonContentType(value: string | undefined): boolean {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

async function ingestNormalizedEvolutionEvent(
  dependencies: EvolutionWebhookIngressDependencies,
  event: NormalizedTransportEvent,
): Promise<IngestEventResult> {
  const now = dependencies.now?.() ?? new Date();
  return ingestCanonicalEvent(dependencies.pipeline, {
    ownerId: dependencies.ownerId,
    envelope: {
      eventType: canonicalEventType(event),
      source: 'whatsapp',
      sourceEventId: event.providerEventReference,
      idempotencyKey: event.idempotencyKey,
      occurredAt: event.occurredAt,
      schemaVersion: event.schemaVersion,
      payload: event,
    },
    receivedAt: now.toISOString(),
    correlationId: randomUUID(),
  });
}

/**
 * Registers the sole provider callback route. Its whole successful request path is verify → parse
 * → normalize → durable canonical ingress → acknowledgement. It deliberately contains no model,
 * conversation, action execution, media download, outbound call, or raw-payload logging path.
 */
export function registerEvolutionWebhookRoute(
  app: FastifyInstance,
  dependencies: EvolutionWebhookIngressDependencies | undefined,
): void {
  app.post(
    '/webhooks/evolution',
    { bodyLimit: dependencies?.bodyLimitBytes ?? 65_536 },
    async (request, reply): Promise<EvolutionWebhookAcknowledgement> => {
      if (!dependencies?.enabled) {
        return reply.code(503).send({
          accepted: false,
          duplicate: false,
          disposition: 'not_configured',
        });
      }
      // Preserve the owner-only boundary if an untyped runtime composition bypassed the required
      // TypeScript dependency. Without this sink, rejected traffic could become unaudited.
      if (!dependencies.rejectionRecorder) {
        return reply.code(503).send({
          accepted: false,
          duplicate: false,
          disposition: 'not_configured',
        });
      }
      if (!isJsonContentType(request.headers['content-type'])) {
        return reply.code(415).send({
          accepted: false,
          duplicate: false,
          disposition: 'rejected',
        });
      }
      const verification = dependencies.verifier.verify(request.headers.authorization);
      if (!verification.verified) {
        return reply.code(401).send({
          accepted: false,
          duplicate: false,
          disposition: 'rejected',
        });
      }

      let parsed: ReturnType<EvolutionWebhookParser['parse']>;
      try {
        parsed = dependencies.parser.parse(request.body);
      } catch {
        return reply.code(400).send({
          accepted: false,
          duplicate: false,
          disposition: 'rejected',
        });
      }
      if (parsed.instanceName !== dependencies.expectedInstanceName) {
        return reply.code(403).send({
          accepted: false,
          duplicate: false,
          disposition: 'rejected',
        });
      }

      const mapped = dependencies.mapper.map(parsed);
      // Use an explicit literal comparison so every TypeScript compiler used by the
      // local and serverless build paths discriminates the rejection union correctly.
      if (mapped.accepted === false) {
        await dependencies.rejectionRecorder.record({
          ownerId: dependencies.ownerId,
          eventType: parsed.event,
          reason: mapped.reason,
          instanceReference: mapped.instanceReference,
          providerEventReference: mapped.providerEventReference,
          senderReference: mapped.senderReference ?? null,
          receivedAt: (dependencies.now?.() ?? new Date()).toISOString(),
        });
        // A rejected transport event is deliberate policy, not a webhook-delivery failure worth
        // forcing Evolution to retry. No Brain, commitment, memory, or action is created.
        return reply.code(202).send({
          accepted: false,
          duplicate: false,
          disposition: 'rejected',
        });
      }

      const ingested = await ingestNormalizedEvolutionEvent(dependencies, mapped.event);
      return reply.code(ingested.duplicate ? 200 : 202).send({
        accepted: true,
        duplicate: ingested.duplicate,
        disposition: ingested.duplicate ? 'duplicate' : 'queued',
      });
    },
  );
}
