import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  telegramBotCanonicalPayloadSchema,
  type DurableJob,
  type DurableJobInput,
  type IncomingEventEnvelope,
} from '@jarvis/contracts';
import { ingestCanonicalEvent, type EventPipelineDependencies } from '@jarvis/domain';
import { canonicalJobSignal, type OrchestrationPublisher } from '@jarvis/orchestration';
import { createSafeLogRecord } from '@jarvis/observability';
import type { TelegramBotIngressRepository } from '@jarvis/database';
import { recordTelegramTiming } from './telegram-timing.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
function sameSecret(actual: string | undefined, expected: string): boolean {
  return typeof actual === 'string' && timingSafeEqual(digest(actual), digest(expected));
}
function opaque(
  kind: 'participant' | 'conversation' | 'message' | 'update',
  value: string,
): string {
  return `tg:${kind}:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

/** PostgreSQL error classes are safe operational categories; provider ids and error text are not. */
function participantObservationFailureCategory(error: unknown): string {
  const candidate = error as {
    readonly code?: unknown;
    readonly cause?: { readonly code?: unknown };
  };
  const code =
    typeof candidate?.code === 'string'
      ? candidate.code
      : typeof candidate?.cause?.code === 'string'
        ? candidate.cause.code
        : undefined;
  switch (code) {
    case '42P01':
      return 'participant_observation_schema_missing';
    case '42501':
      return 'participant_observation_permission_denied';
    case '23503':
      return 'participant_observation_referential_integrity';
    default:
      return 'participant_observation_persistence_unavailable';
  }
}
type TelegramTextUpdate = {
  readonly updateId: number;
  readonly messageId: number;
  readonly fromId: number;
  readonly chatId: number;
  readonly date: number;
  readonly text: string;
};
function parsePrivateTextUpdate(body: unknown): TelegramTextUpdate | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const update = body as Record<string, unknown>;
  if (
    !Number.isSafeInteger(update.update_id) ||
    !update.message ||
    typeof update.message !== 'object'
  )
    return undefined;
  const message = update.message as Record<string, unknown>;
  if (
    !Number.isSafeInteger(message.message_id) ||
    !Number.isSafeInteger(message.date) ||
    typeof message.text !== 'string' ||
    !message.from ||
    !message.chat ||
    typeof message.from !== 'object' ||
    typeof message.chat !== 'object'
  )
    return undefined;
  const from = message.from as Record<string, unknown>;
  const chat = message.chat as Record<string, unknown>;
  if (
    !Number.isSafeInteger(from.id) ||
    !Number.isSafeInteger(chat.id) ||
    chat.type !== 'private' ||
    chat.id !== from.id
  )
    return undefined;
  const text = message.text.trim();
  return text.length > 0 && text.length <= 8_000
    ? {
        updateId: update.update_id as number,
        messageId: message.message_id as number,
        fromId: from.id as number,
        chatId: chat.id as number,
        date: message.date as number,
        text,
      }
    : undefined;
}
function envelope(update: TelegramTextUpdate): IncomingEventEnvelope {
  const sourceEventId = deterministicUuid(`telegram:update:${update.updateId}`);
  const payload = telegramBotCanonicalPayloadSchema.parse({
    kind: 'telegram_bot_message_observed',
    transport: 'telegram_bot',
    conversationType: 'direct',
    conversationReference: opaque('conversation', String(update.chatId)),
    providerUpdateReference: opaque('update', String(update.updateId)),
    providerMessageReference: opaque('message', `${update.chatId}:${update.messageId}`),
    participantReference: opaque('participant', String(update.fromId)),
    deliveryTargetReference: opaque('conversation', String(update.chatId)),
    messageType: 'text',
    text: update.text,
  });
  return {
    eventType: 'telegram.bot.message.observed.v1',
    source: 'telegram',
    sourceEventId,
    idempotencyKey: `telegram:update:${createHash('sha256').update(String(update.updateId)).digest('hex')}`,
    occurredAt: new Date(update.date * 1_000).toISOString(),
    payload,
    schemaVersion: 1,
    correlationId: sourceEventId,
  };
}

export interface TelegramBotRouteDependencies {
  readonly webhookSecret: string | undefined;
  readonly ownerId: string | undefined;
  readonly pipeline: EventPipelineDependencies | undefined;
  readonly orchestration: Pick<OrchestrationPublisher, 'scheduleJob'> | undefined;
  /**
   * An enrolled owner turn is not permitted until both explicit Telegram gates are enabled.
   * Before then, retain an authenticated direct observation for exact operator enrollment but
   * deliberately do not wake orchestration or create a path to Brain processing.
   */
  readonly ownerDirectMessagingEnabled?: boolean;
  /** The SAME canonical inbound repository used by the worker, moved before first typing. */
  readonly inbound?: TelegramBotIngressRepository;
  readonly isEnrolledOwner?: (participantReference: string) => Promise<boolean>;
  /** Already authenticated, persisted, deduplicated and exactly enrolled at this boundary. */
  readonly launchTyping?: (input: {
    readonly providerChatId: string;
    readonly sourceEventId: string;
    readonly eventId: string;
  }) => void;
  /** Adapter-only recipient mapping; numeric Bot API ids do not enter canonical model contracts. */
  readonly recordObservedParticipant?: (input: {
    readonly participantReference: string;
    readonly conversationReference: string;
    readonly providerChatId: string;
    readonly occurredAt: Date;
  }) => Promise<void>;
  readonly loadCanonicalJobForEvent?: (eventId: string) => Promise<DurableJob | undefined>;
  readonly now?: () => Date;
}

/** The only public Bot API route. It accepts a configured secret-token then emits opaque canonical events. */
export function registerTelegramBotRoutes(
  app: FastifyInstance,
  deps: TelegramBotRouteDependencies | undefined,
): void {
  if (!deps?.webhookSecret || !deps.ownerId || !deps.pipeline || !deps.orchestration) return;
  app.post('/webhooks/telegram', async (request: FastifyRequest, reply) => {
    const secret = request.headers['x-telegram-bot-api-secret-token'];
    const actual = Array.isArray(secret) ? undefined : secret;
    if (!sameSecret(actual, deps.webhookSecret!)) {
      console.info(
        JSON.stringify(
          createSafeLogRecord('telegram.webhook.rejected', {
            category: 'webhook_authentication_failed',
          }),
        ),
      );
      return reply.header('cache-control', 'no-store').code(401).send({ error: 'unauthorized' });
    }
    console.info(
      JSON.stringify(createSafeLogRecord('telegram.webhook.progress', { stage: 'authenticated' })),
    );
    recordTelegramTiming('authentication_complete');
    const update = parsePrivateTextUpdate(request.body);
    // Telegram expects a quick 2xx acknowledgement. Unsupported updates are deliberately not sent
    // into owner conversation processing and contain no logged body/identity/text.
    if (!update) {
      console.info(
        JSON.stringify(
          createSafeLogRecord('telegram.webhook.rejected', { category: 'unsupported_update' }),
        ),
      );
      return reply
        .header('cache-control', 'no-store')
        .code(200)
        .send({ accepted: false, category: 'unsupported_update' });
    }
    console.info(
      JSON.stringify(
        createSafeLogRecord('telegram.webhook.progress', { stage: 'validated_private_text' }),
      ),
    );
    const canonical = envelope(update);
    const payload = telegramBotCanonicalPayloadSchema.parse(canonical.payload);
    try {
      await deps.recordObservedParticipant?.({
        participantReference: payload.participantReference,
        conversationReference: payload.conversationReference,
        providerChatId: String(update.chatId),
        occurredAt: new Date(update.date * 1_000),
      });
    } catch (error) {
      console.info(
        JSON.stringify(
          createSafeLogRecord('telegram.webhook.rejected', {
            category: participantObservationFailureCategory(error),
          }),
        ),
      );
      return reply
        .header('cache-control', 'no-store')
        .code(503)
        .send({ error: 'canonical_telegram_ingress_unavailable' });
    }
    console.info(
      JSON.stringify(
        createSafeLogRecord('telegram.webhook.progress', { stage: 'participant_observed' }),
      ),
    );
    try {
      const correlationId =
        canonical.correlationId ?? deterministicUuid(`telegram:correlation:${update.updateId}`);
      const ingested = await ingestCanonicalEvent(deps.pipeline!, {
        ownerId: deps.ownerId!,
        envelope: canonical,
        receivedAt: (deps.now?.() ?? new Date()).toISOString(),
        correlationId,
      });
      // The atomic event/job receipt is the existing provider-update idempotency ledger.
      // Only its inserting invocation may claim message idempotency and first typing. A replay
      // still recovers a missed orchestration signal, but cannot repeat the initial UX operation.
      if (!ingested.duplicate && deps.inbound) {
        const message = await deps.inbound.persistInboundMessage({
          ownerId: ingested.event.ownerId,
          sourceEventId: ingested.event.sourceEventId!,
          correlationId: ingested.event.correlationId,
          occurredAt: ingested.event.occurredAt,
          receivedAt: ingested.event.receivedAt,
          message: payload,
        });
        recordTelegramTiming('inbound_persistence_complete', {
          sourceEventId: ingested.event.sourceEventId!,
          eventId: ingested.event.id,
          duplicate: message.duplicate,
        });
        if (!message.duplicate && deps.ownerDirectMessagingEnabled && deps.isEnrolledOwner) {
          const enrolled = await deps.isEnrolledOwner(payload.participantReference);
          recordTelegramTiming('owner_resolution_complete', {
            sourceEventId: ingested.event.sourceEventId!,
            eventId: ingested.event.id,
            enrolled,
          });
          if (enrolled) {
            try {
              deps.launchTyping?.({
                providerChatId: String(update.chatId),
                sourceEventId: ingested.event.sourceEventId!,
                eventId: ingested.event.id,
              });
            } catch {
              // UX initialization is never an ingress/Brain failure.
            }
          }
        }
      }
      const job: DurableJobInput | DurableJob | undefined =
        ingested.job ??
        (ingested.duplicate ? await deps.loadCanonicalJobForEvent?.(ingested.event.id) : undefined);
      if (!job) throw new Error('Canonical Telegram ingress has no durable job signal.');
      if (!deps.ownerDirectMessagingEnabled) {
        console.info(
          JSON.stringify(
            createSafeLogRecord('telegram.webhook.progress', {
              stage: 'canonical_event_retained_without_owner_dispatch',
            }),
          ),
        );
        return reply
          .header('cache-control', 'no-store')
          .code(ingested.duplicate ? 200 : 202)
          .send({ accepted: true, duplicate: ingested.duplicate, ownerEligible: false });
      }
      await deps.orchestration!.scheduleJob(canonicalJobSignal(job));
      recordTelegramTiming('canonical_event_queued', {
        sourceEventId: ingested.event.sourceEventId!,
        eventId: ingested.event.id,
        duplicate: ingested.duplicate,
      });
      console.info(
        JSON.stringify(
          createSafeLogRecord('telegram.webhook.progress', { stage: 'orchestration_scheduled' }),
        ),
      );
      return reply
        .header('cache-control', 'no-store')
        .code(ingested.duplicate ? 200 : 202)
        .send({ accepted: true, duplicate: ingested.duplicate });
    } catch {
      console.info(
        JSON.stringify(
          createSafeLogRecord('telegram.webhook.rejected', {
            category: 'canonical_event_or_signal_unavailable',
          }),
        ),
      );
      return reply.header('cache-control', 'no-store').code(503).send({
        error: 'canonical_telegram_ingress_unavailable',
      });
    }
  });
}
