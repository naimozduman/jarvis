import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { TelegramBotCanonicalPayload } from '@jarvis/contracts';
import type { JarvisDatabase } from './client.js';
import { conversations, messages } from './schema/index.js';

export interface PersistedTelegramBotInboundMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly duplicate: boolean;
}

export interface TelegramBotIngressRepository {
  persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly occurredAt: string;
    readonly receivedAt: string;
    readonly message: TelegramBotCanonicalPayload;
  }): Promise<PersistedTelegramBotInboundMessage>;
}

/** Canonical persistence happens before any enrollment, Brain, or provider delivery operation. */
export class DrizzleTelegramBotIngressRepository implements TelegramBotIngressRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly occurredAt: string;
    readonly receivedAt: string;
    readonly message: TelegramBotCanonicalPayload;
  }): Promise<PersistedTelegramBotInboundMessage> {
    return this.database.transaction(async (transaction) => {
      const [createdConversation] = await transaction
        .insert(conversations)
        .values({
          id: randomUUID(),
          ownerId: input.ownerId,
          channel: 'telegram',
          externalConversationId: input.message.conversationReference,
          state: 'active',
          lastMessageAt: new Date(input.occurredAt),
          metadata: { transport: 'telegram_bot', conversationType: 'direct' },
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
                eq(conversations.channel, 'telegram'),
                eq(conversations.externalConversationId, input.message.conversationReference),
              ),
            )
            .limit(1)
        )[0]?.id;
      if (!conversationId)
        throw new Error('Telegram conversation creation conflicted without a canonical record.');
      const [createdMessage] = await transaction
        .insert(messages)
        .values({
          id: randomUUID(),
          ownerId: input.ownerId,
          conversationId,
          channel: 'telegram',
          direction: 'inbound',
          externalMessageId: input.message.providerMessageReference,
          senderReference: input.message.participantReference,
          contentType: 'text/plain',
          content: input.message.text,
          deliveryState: 'received',
          occurredAt: new Date(input.occurredAt),
          receivedAt: new Date(input.receivedAt),
          correlationId: input.correlationId,
          sourceEventId: input.sourceEventId,
          metadata: {
            transport: 'telegram_bot',
            providerUpdateReference: input.message.providerUpdateReference,
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
                eq(messages.channel, 'telegram'),
                eq(messages.externalMessageId, input.message.providerMessageReference),
              ),
            )
            .limit(1)
        )[0]?.id;
      if (!messageId)
        throw new Error('Telegram message creation conflicted without a canonical record.');
      await transaction
        .update(conversations)
        .set({ lastMessageAt: new Date(input.occurredAt), updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, input.ownerId)));
      return { id: messageId, conversationId, duplicate: !createdMessage };
    });
  }
}
