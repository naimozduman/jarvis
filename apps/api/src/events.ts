import { randomUUID } from 'node:crypto';

import { incomingEventEnvelopeSchema } from '@jarvis/contracts';
import type { IncomingEventEnvelope } from '@jarvis/contracts';
import { ingestCanonicalEvent } from '@jarvis/domain';
import type { EventPipelineDependencies, IngestEventResult } from '@jarvis/domain';
import { hasRequiredScope } from '@jarvis/security';
import type { AuthenticationBoundary } from '@jarvis/security';

export interface AuthenticatedEventIngressRequest {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

export interface AuthenticatedEventIngressDependencies {
  readonly authentication: AuthenticationBoundary;
  readonly pipeline: EventPipelineDependencies;
  readonly now?: () => Date;
}

/**
 * The ingress owner is derived exclusively from a verified principal. The request contract contains
 * no owner ID, so web/iOS/internal clients and future connector adapters cannot select another
 * owner's durable state through an untrusted body field.
 */
export async function ingestAuthenticatedEvent(
  dependencies: AuthenticatedEventIngressDependencies,
  request: AuthenticatedEventIngressRequest,
): Promise<IngestEventResult> {
  const principal = await dependencies.authentication.authenticate({
    headers: request.headers,
    method: request.method,
    path: request.path,
  });

  if (!hasRequiredScope(principal, 'events:ingest')) {
    throw new Error('The authenticated principal lacks events:ingest scope.');
  }

  const envelope: IncomingEventEnvelope = incomingEventEnvelopeSchema.parse(request.body);
  const now = dependencies.now?.() ?? new Date();

  return ingestCanonicalEvent(dependencies.pipeline, {
    ownerId: principal.ownerId,
    envelope,
    receivedAt: now.toISOString(),
    correlationId: envelope.correlationId ?? randomUUID(),
  });
}
