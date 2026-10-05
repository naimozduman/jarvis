import { z } from 'zod';

const telegramOpaqueReferenceSchema = z.string().regex(/^tg:[a-z-]+:[a-f0-9]{64}$/);

/**
 * Privacy-filtered projection of one authenticated Telegram private text update. Numeric Bot API
 * identifiers are hashed at the HTTP boundary and never reach model context or application logs.
 */
export const telegramBotCanonicalPayloadSchema = z
  .object({
    kind: z.literal('telegram_bot_message_observed'),
    transport: z.literal('telegram_bot'),
    conversationType: z.literal('direct'),
    conversationReference: telegramOpaqueReferenceSchema,
    providerUpdateReference: telegramOpaqueReferenceSchema,
    providerMessageReference: telegramOpaqueReferenceSchema,
    participantReference: telegramOpaqueReferenceSchema,
    deliveryTargetReference: telegramOpaqueReferenceSchema,
    messageType: z.literal('text'),
    text: z.string().trim().min(1).max(8_000),
  })
  .strict();

export type TelegramBotCanonicalPayload = z.infer<typeof telegramBotCanonicalPayloadSchema>;
