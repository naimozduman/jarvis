import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { JarvisDatabase } from './client.js';
import { messagingIdentityAliases, telegramBotParticipants } from './schema/index.js';

/** Exact opaque-reference enrollment only. There is no username, display-name, or phone lookup. */
export interface TelegramParticipantEnrollmentRepository {
  isEnrolled(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly participantReference: string;
  }): Promise<boolean>;
  enrollExactParticipant(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly participantReference: string;
    readonly canonicalContactReference: string;
    readonly sourceEventId: string;
  }): Promise<void>;
}

export class DrizzleTelegramParticipantEnrollmentRepository implements TelegramParticipantEnrollmentRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async isEnrolled(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly participantReference: string;
  }): Promise<boolean> {
    const row = await this.database
      .select({ id: messagingIdentityAliases.id })
      .from(messagingIdentityAliases)
      .where(
        and(
          eq(messagingIdentityAliases.ownerId, input.ownerId),
          eq(messagingIdentityAliases.connectionId, input.connectionId),
          eq(messagingIdentityAliases.identityReference, input.participantReference),
          eq(messagingIdentityAliases.identityKind, 'telegram_private_participant_v1'),
          eq(messagingIdentityAliases.approved, true),
        ),
      )
      .limit(1);
    return Boolean(row[0]);
  }

  public async enrollExactParticipant(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly participantReference: string;
    readonly canonicalContactReference: string;
    readonly sourceEventId: string;
  }): Promise<void> {
    await this.database
      .insert(messagingIdentityAliases)
      .values({
        id: randomUUID(),
        ownerId: input.ownerId,
        connectionId: input.connectionId,
        identityReference: input.participantReference,
        canonicalContactReference: input.canonicalContactReference,
        identityKind: 'telegram_private_participant_v1',
        approved: true,
        metadata: {
          enrollment: 'telegram_operator_exact_observed_event',
          sourceEventId: input.sourceEventId,
        },
      })
      .onConflictDoUpdate({
        target: [messagingIdentityAliases.connectionId, messagingIdentityAliases.identityReference],
        set: {
          ownerId: input.ownerId,
          canonicalContactReference: input.canonicalContactReference,
          identityKind: 'telegram_private_participant_v1',
          approved: true,
          metadata: {
            enrollment: 'telegram_operator_exact_observed_event',
            sourceEventId: input.sourceEventId,
          },
          updatedAt: new Date(),
        },
      });
  }
}

/** Adapter-only lookup. Numeric chat ids never leave this repository except into the Bot API client. */
export class DrizzleTelegramBotParticipantRegistry {
  public constructor(private readonly database: JarvisDatabase) {}
  public async recordObserved(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly participantReference: string;
    readonly conversationReference: string;
    readonly providerChatId: string;
    readonly occurredAt: Date;
  }): Promise<void> {
    await this.database
      .insert(telegramBotParticipants)
      .values({
        id: randomUUID(),
        ownerId: input.ownerId,
        connectionId: input.connectionId,
        participantReference: input.participantReference,
        conversationReference: input.conversationReference,
        providerChatId: input.providerChatId,
        lastObservedAt: input.occurredAt,
      })
      .onConflictDoUpdate({
        target: [
          telegramBotParticipants.connectionId,
          telegramBotParticipants.participantReference,
        ],
        set: {
          conversationReference: input.conversationReference,
          providerChatId: input.providerChatId,
          lastObservedAt: input.occurredAt,
          updatedAt: new Date(),
        },
      });
  }
  public async loadProviderChatId(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly conversationReference: string;
  }): Promise<string | undefined> {
    const row = await this.database
      .select({ providerChatId: telegramBotParticipants.providerChatId })
      .from(telegramBotParticipants)
      .where(
        and(
          eq(telegramBotParticipants.ownerId, input.ownerId),
          eq(telegramBotParticipants.connectionId, input.connectionId),
          eq(telegramBotParticipants.conversationReference, input.conversationReference),
        ),
      )
      .limit(1);
    return row[0]?.providerChatId;
  }
}
