import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { telegramBotCanonicalPayloadSchema } from '@jarvis/contracts';
import type {
  DrizzleCanonicalEventRepository,
  TelegramParticipantEnrollmentRepository,
} from '@jarvis/database';
import type { TelegramBotClient } from './telegram-bot-client.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
function authorized(request: FastifyRequest, token: string): boolean {
  const value = request.headers.authorization;
  return Boolean(
    value?.startsWith('Bearer ') && timingSafeEqual(digest(value.slice(7).trim()), digest(token)),
  );
}
function webhookPublicMetadata(url: string): { readonly host: string; readonly path: string } {
  const parsed = new URL(url);
  return { host: parsed.host, path: parsed.pathname };
}
export interface TelegramBotOperatorRouteDependencies {
  readonly operatorToken: string | undefined;
  readonly ownerId: string | undefined;
  readonly webhookUrl: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly client: TelegramBotClient | undefined;
  readonly events: DrizzleCanonicalEventRepository | undefined;
  readonly enrollment: TelegramParticipantEnrollmentRepository | undefined;
  readonly connectionId: string | undefined;
  /** One-way runtime DB login marker for repairing narrowly scoped table grants; never a role name. */
  readonly databaseRoleFingerprint?: () => Promise<string | undefined>;
}

/** Narrow operator-only boundary: registration, status, and exact-observed participant enrollment. */
export function registerTelegramBotOperatorRoutes(
  app: FastifyInstance,
  deps: TelegramBotOperatorRouteDependencies | undefined,
): void {
  if (
    !deps?.operatorToken ||
    !deps.ownerId ||
    !deps.webhookUrl ||
    !deps.webhookSecret ||
    !deps.client ||
    !deps.events ||
    !deps.enrollment ||
    !deps.connectionId
  )
    return;
  const requireOperator = (request: FastifyRequest): boolean =>
    authorized(request, deps.operatorToken!);
  app.post('/internal/telegram/operator/webhook/register', async (request, reply) => {
    if (!requireOperator(request)) return reply.code(401).send({ error: 'unauthorized' });
    const configured = await deps.client!.setWebhook({
      url: deps.webhookUrl!,
      secretToken: deps.webhookSecret!,
    });
    if (!configured)
      return reply
        .code(503)
        .send({ configured: false, category: 'telegram_webhook_registration_failed' });
    return reply.code(200).send({ configured: true, ...webhookPublicMetadata(deps.webhookUrl!) });
  });
  app.get('/internal/telegram/operator/webhook/status', async (request, reply) => {
    if (!requireOperator(request)) return reply.code(401).send({ error: 'unauthorized' });
    const status = await deps.client!.webhookInfo();
    const databaseRoleFingerprint = await deps.databaseRoleFingerprint?.().catch(() => undefined);
    return reply.code(200).send({
      ...status,
      ...webhookPublicMetadata(deps.webhookUrl!),
      ...(databaseRoleFingerprint ? { databaseRoleFingerprint } : {}),
    });
  });
  app.post('/internal/telegram/operator/enroll', async (request, reply) => {
    if (!requireOperator(request)) return reply.code(401).send({ error: 'unauthorized' });
    const body = request.body as { sourceEventId?: unknown } | undefined;
    if (!body || typeof body.sourceEventId !== 'string')
      return reply.code(400).send({ error: 'invalid_enrollment_request' });
    const event = await deps.events!.load({ ownerId: deps.ownerId!, eventId: body.sourceEventId });
    if (!event || event.eventType !== 'telegram.bot.message.observed.v1')
      return reply.code(404).send({ error: 'observed_private_participant_not_found' });
    const payload = telegramBotCanonicalPayloadSchema.safeParse(event.payload);
    if (
      !payload.success ||
      payload.data.conversationReference !== payload.data.deliveryTargetReference
    )
      return reply.code(400).send({ error: 'invalid_observed_private_participant' });
    await deps.enrollment!.enrollExactParticipant({
      ownerId: deps.ownerId!,
      connectionId: deps.connectionId!,
      participantReference: payload.data.participantReference,
      canonicalContactReference: `canonical-owner:${deps.ownerId}`,
      sourceEventId: event.id,
    });
    return reply.code(200).send({ enrolled: true, sourceEventId: event.id });
  });
}
