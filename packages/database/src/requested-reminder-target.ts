import { and, eq } from 'drizzle-orm';
import {
  telegramBotCanonicalPayloadSchema,
  whatsappCloudCanonicalPayloadSchema,
} from '@jarvis/contracts';
import type { JarvisDatabase } from './client.js';
import {
  conversations,
  events,
  messages,
  messagingIdentityAliases,
  messagingTransportConnections,
  telegramBotParticipants,
} from './schema/index.js';

type Transaction = Parameters<Parameters<JarvisDatabase['transaction']>[0]>[0];

/** Resolve one current canonical owner Telegram destination, never a model/provider identifier. */
export async function loadRequestedReminderTarget(
  database: JarvisDatabase | Transaction,
  ownerId: string,
  sourceEventId: string,
) {
  const [source] = await database
    .select()
    .from(events)
    .where(and(eq(events.id, sourceEventId), eq(events.ownerId, ownerId)))
    .limit(1);
  if (!source?.sourceEventId) return null;
  const telegram = telegramBotCanonicalPayloadSchema.safeParse(source.payload);
  const whatsapp = whatsappCloudCanonicalPayloadSchema.safeParse(source.payload);
  const authenticatedTelegram =
    source.eventType === 'telegram.bot.message.observed.v1' &&
    source.source === 'telegram' &&
    telegram.success;
  const authenticatedWhatsApp =
    source.eventType === 'whatsapp.cloud.message.observed.v1' &&
    source.source === 'whatsapp' &&
    whatsapp.success &&
    whatsapp.data.ownerVerified &&
    whatsapp.data.messageType === 'text';
  if (!authenticatedTelegram && !authenticatedWhatsApp) return null;
  const providerMessageReference =
    authenticatedTelegram && telegram.success
      ? telegram.data.providerMessageReference
      : whatsapp.success
        ? whatsapp.data.providerMessageReference
        : null;
  if (!providerMessageReference) return null;
  const [inbound] = await database
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.ownerId, ownerId),
        eq(messages.sourceEventId, source.sourceEventId),
        eq(messages.externalMessageId, providerMessageReference),
        eq(messages.direction, 'inbound'),
      ),
    )
    .limit(1);
  if (!inbound) return null;
  const targets = await database
    .select({
      connection: messagingTransportConnections,
      participantReference: messagingIdentityAliases.identityReference,
      targetReference: telegramBotParticipants.conversationReference,
      providerChatId: telegramBotParticipants.providerChatId,
      conversationId: conversations.id,
    })
    .from(messagingIdentityAliases)
    .innerJoin(
      messagingTransportConnections,
      and(
        eq(messagingTransportConnections.id, messagingIdentityAliases.connectionId),
        eq(messagingTransportConnections.ownerId, messagingIdentityAliases.ownerId),
      ),
    )
    .innerJoin(
      telegramBotParticipants,
      and(
        eq(telegramBotParticipants.connectionId, messagingIdentityAliases.connectionId),
        eq(telegramBotParticipants.ownerId, messagingIdentityAliases.ownerId),
        eq(
          telegramBotParticipants.participantReference,
          messagingIdentityAliases.identityReference,
        ),
      ),
    )
    .innerJoin(
      conversations,
      and(
        eq(conversations.ownerId, messagingIdentityAliases.ownerId),
        eq(conversations.channel, 'telegram'),
        eq(conversations.externalConversationId, telegramBotParticipants.conversationReference),
        eq(conversations.state, 'active'),
      ),
    )
    .where(
      and(
        eq(messagingIdentityAliases.ownerId, ownerId),
        eq(messagingIdentityAliases.identityKind, 'telegram_private_participant_v1'),
        eq(messagingIdentityAliases.canonicalContactReference, `canonical-owner:${ownerId}`),
        eq(messagingIdentityAliases.approved, true),
        eq(messagingTransportConnections.transport, 'telegram_bot'),
      ),
    )
    .limit(2)
    .for('share');
  if (targets.length !== 1) return null;
  const target = targets[0]!;
  if (
    authenticatedTelegram &&
    telegram.success &&
    (target.participantReference !== telegram.data.participantReference ||
      target.targetReference !== telegram.data.deliveryTargetReference)
  )
    return null;
  return target;
}
