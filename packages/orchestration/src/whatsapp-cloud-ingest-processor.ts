import { whatsappCloudCanonicalPayloadSchema } from '@jarvis/contracts';
import type { CanonicalEvent } from '@jarvis/contracts';
import type {
  PersistedWhatsAppCloudInboundMessage,
  WhatsAppCloudIngressRepository,
} from '@jarvis/database';

/**
 * Handles the official Cloud API's already-normalized, privacy-filtered event. It deliberately
 * has no Brain, provider-client, or outbound-delivery dependency: inbound transport recording is
 * always the complete first-side effect. A separate canonical conversation processor may consume
 * the returned persisted identity only after this transaction succeeds.
 */
export class CanonicalWhatsAppCloudIngestProcessor {
  public constructor(private readonly repository: WhatsAppCloudIngressRepository) {}

  public async process(event: CanonicalEvent): Promise<PersistedWhatsAppCloudInboundMessage> {
    if (event.eventType !== 'whatsapp.cloud.message.observed.v1' || event.source !== 'whatsapp') {
      throw new Error('validation: a Cloud ingress processor received the wrong canonical event.');
    }
    if (!event.sourceEventId) {
      throw new Error('validation: a Cloud ingress event requires its bridge event reference.');
    }
    const payload = whatsappCloudCanonicalPayloadSchema.safeParse(event.payload);
    if (!payload.success) {
      throw new Error('validation: the canonical Cloud ingress payload is malformed.');
    }
    return this.repository.persistInboundMessage({
      ownerId: event.ownerId,
      sourceEventId: event.sourceEventId,
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
      receivedAt: event.receivedAt,
      message: payload.data,
    });
  }
}
