import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { WhatsAppCloudCanonicalPayload } from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import { conversations, messages } from './schema/index.js';

export interface PersistedWhatsAppCloudInboundMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly duplicate: boolean;
}

export interface WhatsAppCloudIngressRepository {
  persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly occurredAt: string;
    readonly receivedAt: string;
    readonly message: WhatsAppCloudCanonicalPayload;
  }): Promise<PersistedWhatsAppCloudInboundMessage>;
}

function contentType(messageType: string): string {
  return messageType === 'text'
    ? 'text/plain'
    : `application/x-jarvis-whatsapp-cloud-${messageType}`;
}

/**
 * Stores only the privacy-filtered Cloud API projection created by the API ingress route. Raw
 * Meta identifiers and raw webhook evidence remain in the dedicated WhatsApp bridge database.
 */
export class DrizzleWhatsAppCloudIngressRepository implements WhatsAppCloudIngressRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly occurredAt: string;
    readonly receivedAt: string;
    readonly message: WhatsAppCloudCanonicalPayload;
  }): Promise<PersistedWhatsAppCloudInboundMessage> {
    return this.database.transaction(async (transaction) => {
      const [createdConversation] = await transaction
        .insert(conversations)
        .values({
          id: randomUUID(),
          ownerId: input.ownerId,
          channel: 'whatsapp',
          externalConversationId: input.message.conversationReference,
          state: 'active',
          lastMessageAt: new Date(input.occurredAt),
          metadata: {
            transport: input.message.transport,
            conversationType: input.message.conversationType,
            category: input.message.category,
          },
        })
        .onConflictDoNothing()
        .returning({ id: conversations.id });
      const conversationId =
        createdConversation?.id ??
        (
          await transaction
            .select({ id: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.ownerId, input.ownerId),
                eq(conversations.channel, 'whatsapp'),
                eq(conversations.externalConversationId, input.message.conversationReference),
              ),
            )
            .limit(1)
        )[0]?.id;
      if (!conversationId) {
        throw new Error('Cloud conversation creation conflicted without a canonical record.');
      }

      const [createdMessage] = await transaction
        .insert(messages)
        .values({
          id: randomUUID(),
          ownerId: input.ownerId,
          conversationId,
          channel: 'whatsapp',
          direction: 'inbound',
          externalMessageId: input.message.providerMessageReference,
          senderReference: input.message.participantReference,
          contentType: contentType(input.message.messageType),
          content: input.message.text,
          deliveryState: 'received',
          occurredAt: new Date(input.occurredAt),
          receivedAt: new Date(input.receivedAt),
          correlationId: input.correlationId,
          sourceEventId: input.sourceEventId,
          metadata: {
            transport: input.message.transport,
            category: input.message.category,
            messageType: input.message.messageType,
            media: input.message.media,
          },
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });
      const messageId =
        createdMessage?.id ??
        (
          await transaction
            .select({ id: messages.id })
            .from(messages)
            .where(
              and(
                eq(messages.ownerId, input.ownerId),
                eq(messages.channel, 'whatsapp'),
                eq(messages.externalMessageId, input.message.providerMessageReference),
              ),
            )
            .limit(1)
        )[0]?.id;
      if (!messageId) {
        throw new Error('Cloud message creation conflicted without a canonical record.');
      }

      // A retry or a historical message may arrive after a newer one. The existing schema does
      // not yet encode a monotonic update operator, so retain the source timestamp as evidence and
      // keep this convenience field best-effort rather than using it as canonical ordering.
      await transaction
        .update(conversations)
        .set({ lastMessageAt: new Date(input.occurredAt), updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, input.ownerId)));

      return { id: messageId, conversationId, duplicate: !createdMessage };
    });
  }
}
