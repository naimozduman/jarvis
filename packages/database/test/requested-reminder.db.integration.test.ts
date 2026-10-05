import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ContextAssembler,
  ConversationTurnService,
  FakeModelGateway,
  PromptAssembler,
} from '@jarvis/brain';
import {
  createDatabaseRuntime,
  DrizzleBrainRepository,
  DrizzleTransactionalEventStore,
  CanonicalOnlyDurableJobTransport,
  DrizzleDurableDeliveryOutbox,
  DrizzleRequestedReminderFireRepository,
  DrizzleDurableJobLifecycleProjection,
  DrizzleTransportStateRepository,
  owners,
  events,
  conversations,
  messages,
  messagingTransportConnections,
  messagingIdentityAliases,
  reminders,
  jobs,
  outboundMessageDeliveries,
  reminderAttempts,
  telegramBotParticipants,
  quietModePeriods,
  auditEvents,
} from '@jarvis/database';
import { StatelessCanonicalJobExecutor } from '@jarvis/orchestration';
import { evaluatePolicy } from '@jarvis/security';
import { TelegramBotClient } from '../../../apps/api/src/telegram-bot-client.js';
import { TelegramBotDeliveryExecutor } from '../../../apps/api/src/telegram-bot-delivery.js';

const urlA = process.env.JARVIS_TEST_DATABASE_URL;
const urlB = process.env.JARVIS_TEST_DATABASE_SECONDARY_URL;
function checkUrls() {
  if (!urlA || !urlB) throw new Error('Two disposable local PostgreSQL login roles are required.');
  const a = new URL(urlA),
    b = new URL(urlB);
  if (
    !['localhost', '127.0.0.1', '::1', 'postgres'].includes(a.hostname) ||
    a.hostname !== b.hostname ||
    a.port !== b.port ||
    a.pathname !== b.pathname ||
    !a.pathname.toLowerCase().includes('test') ||
    !a.username ||
    !b.username ||
    a.username === b.username
  )
    throw new Error('Two distinct roles must use the exact same disposable local test database.');
}

async function fixture() {
  checkUrls();
  const a = createDatabaseRuntime({ connectionString: urlA!, maxConnections: 3 });
  const b = createDatabaseRuntime({ connectionString: urlB!, maxConnections: 2 });
  const [identityA, identityB] = await Promise.all([
    a.pool.query('select current_database() as db, session_user as role'),
    b.pool.query('select current_database() as db, session_user as role'),
  ]);
  expect(identityA.rows[0].db).toBe(identityB.rows[0].db);
  expect(identityA.rows[0].role).not.toBe(identityB.rows[0].role);
  const roleB = identityB.rows[0].role as string;
  if (!/^[a-z_][a-z0-9_$]{0,62}$/iu.test(roleB)) throw new Error('Test role name is invalid.');
  // Test-only grants are explicit and limited to this two-role integration's tables.
  await a.pool.query(
    `GRANT SELECT, INSERT, UPDATE ON jarvis.reminders, jarvis.reminder_attempts, jarvis.reminder_triggers, jarvis.messages, jarvis.outbound_message_deliveries, jarvis.jobs, jarvis.audit_events TO "${roleB}"`,
  );
  await a.pool.query(
    `GRANT SELECT ON jarvis.events, jarvis.proposed_actions, jarvis.telegram_bot_participants, jarvis.conversations, jarvis.quiet_mode_periods TO "${roleB}"`,
  );
  await a.pool.query(
    `GRANT SELECT, UPDATE ON jarvis.messaging_transport_connections, jarvis.messaging_identity_aliases TO "${roleB}"`,
  );
  await a.pool.query(
    `GRANT UPDATE ON jarvis.telegram_bot_participants, jarvis.conversations TO "${roleB}"`,
  );
  await a.pool.query(`GRANT INSERT ON jarvis.quiet_mode_periods TO "${roleB}"`);
  const ownerId = randomUUID(),
    eventId = randomUUID(),
    sourceEventId = randomUUID(),
    conversationId = randomUUID(),
    connectionId = randomUUID(),
    correlationId = randomUUID();
  const requestedAt = new Date(Date.now() - 120_000).toISOString();
  const ref = (kind: string) => `tg:${kind}:${'a'.repeat(64)}`;
  const payload = {
    kind: 'telegram_bot_message_observed',
    transport: 'telegram_bot',
    conversationType: 'direct',
    conversationReference: ref('conversation'),
    providerUpdateReference: ref('update'),
    providerMessageReference: ref('message'),
    participantReference: ref('participant'),
    deliveryTargetReference: ref('conversation'),
    messageType: 'text',
    text: 'Text me in 2 minutes and remind me to take a shower',
  };
  await a.db.insert(owners).values({
    id: ownerId,
    emailNormalized: `${ownerId}@synthetic.invalid`,
    displayName: 'Synthetic reminder owner',
    timezone: 'America/Chicago',
  });
  await a.db.insert(events).values({
    id: eventId,
    ownerId,
    eventType: 'telegram.bot.message.observed.v1',
    source: 'telegram',
    sourceEventId,
    idempotencyKey: `synthetic:${eventId}`,
    occurredAt: new Date(requestedAt),
    receivedAt: new Date(),
    payload,
    payloadHash: 'synthetic',
    schemaVersion: 1,
    correlationId,
  });
  await a.db.insert(conversations).values({
    id: conversationId,
    ownerId,
    channel: 'telegram',
    externalConversationId: payload.conversationReference,
  });
  const messageId = randomUUID();
  await a.db.insert(messages).values({
    id: messageId,
    ownerId,
    conversationId,
    channel: 'telegram',
    direction: 'inbound',
    externalMessageId: payload.providerMessageReference,
    content: payload.text,
    occurredAt: new Date(requestedAt),
    receivedAt: new Date(),
    correlationId,
    sourceEventId,
  });
  await a.db.insert(messagingTransportConnections).values({
    id: connectionId,
    ownerId,
    transport: 'telegram_bot',
    instanceReference: 'synthetic-bot',
    outboundEnabled: true,
    versionVerified: true,
    state: 'connected',
  });
  await a.db.insert(messagingIdentityAliases).values({
    ownerId,
    connectionId,
    identityReference: payload.participantReference,
    canonicalContactReference: `canonical-owner:${ownerId}`,
    identityKind: 'telegram_private_participant_v1',
    approved: true,
  });
  await a.db.insert(telegramBotParticipants).values({
    id: randomUUID(),
    ownerId,
    connectionId,
    participantReference: payload.participantReference,
    conversationReference: payload.conversationReference,
    providerChatId: '123456',
    lastObservedAt: new Date(),
  });
  const model = new FakeModelGateway([
    {
      kind: 'decision',
      decision: {
        decisionType: 'propose_action',
        conversationResponse: { message: 'Scheduled it!', nextAction: null, tone: 'neutral' },
        reasoningSummary: {
          decisionSummary: 'Explicit synthetic reminder request',
          importantEvidenceIds: [],
          materialTradeoffs: [],
          confidenceBasisPoints: 9000,
          missingInformation: [],
        },
        evidence: [],
        clarification: null,
        proposedActions: [],
        memoryCandidates: [],
        planProposal: null,
        reminderProposal: {
          commitmentId: null,
          title: 'Non-authoritative title',
          timeExpression: 'in 999 minutes',
          rationale: 'Owner request',
        },
        interventionProposal: null,
      },
    },
  ]);
  const transport = new CanonicalOnlyDurableJobTransport();
  const repository = new DrizzleBrainRepository(a.db);
  const service = new ConversationTurnService({
    repository,
    gateway: model,
    contextAssembler: new ContextAssembler({
      maxContextRecords: 32,
      maxRecentMessages: 12,
      maxApproxPromptTokens: 6000,
    }),
    promptAssembler: new PromptAssembler(),
    actionPipeline: {
      store: new DrizzleTransactionalEventStore(a.db, transport),
      policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
    },
    deepEscalationEnabled: false,
    maxRecentMessages: 12,
  });
  const input = {
    ownerId,
    conversationId,
    message: payload.text,
    timestamp: requestedAt,
    idempotencyKey: `synthetic-reminder:${eventId}`,
    correlationId,
    causationId: null,
    sourceEventId: eventId,
    messageId,
    inboundAlreadyPersisted: true,
    channel: 'telegram' as const,
    channelMetadata: { transport: 'telegram_bot', conversationType: 'direct', ownerVerified: true },
    currentState: {
      contextRecords: [],
      hardOverrideIds: [],
      availableData: [],
      existingPlanBlocks: [],
      availableDayPlanIds: [],
      hasConflict: false,
      highConsequence: false,
      remainingDeepCalls: 0,
      maximumModelCalls: 1,
    },
  };
  const response = await service.process(input);
  expect(response.status).toBe('completed');
  expect(response.conversationResponse?.message).toBe('Reminder set.');
  const [reminder] = await a.db.select().from(reminders).where(eq(reminders.ownerId, ownerId));
  expect(reminder!.title).toBe('take a shower');
  const job = await new DrizzleDurableJobLifecycleProjection(a.db).load({
    jobId: reminder!.jobId!,
  });
  expect(job!.jobType).toBe('jarvis.reminder.fire');
  expect(job!.availableAfter).toBe(
    new Date(new Date(requestedAt).getTime() + 120_000).toISOString(),
  );
  const fireA = new DrizzleRequestedReminderFireRepository(
    a.db,
    new DrizzleDurableDeliveryOutbox(a.db, transport),
    connectionId,
    true,
  );
  const fireB = new DrizzleRequestedReminderFireRepository(
    b.db,
    new DrizzleDurableDeliveryOutbox(b.db, transport),
    connectionId,
    true,
  );
  return {
    a,
    b,
    ownerId,
    connectionId,
    eventId,
    reminder: reminder!,
    job: job!,
    fireA,
    fireB,
    service,
    input,
    model,
    async close() {
      await a.close();
      await b.close();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function preparedFixture(deliveryEnabled = true) {
  const f = await fixture();
  const lifecycle = new DrizzleDurableJobLifecycleProjection(f.a.db);
  let deliveryId: string | null = null;
  const fireExecutor = new StatelessCanonicalJobExecutor({
    lifecycle,
    workerId: 'synthetic-fire',
    handler: {
      execute: async (job) => {
        deliveryId = (await f.fireA.prepare(job)).deliveryId;
      },
    },
  });
  expect(
    await fireExecutor.run({
      jobId: f.job.id,
      correlationId: f.job.correlationId,
      generation: f.job.dispatchGeneration,
    }),
  ).toEqual({ disposition: 'completed' });
  if (!deliveryId) throw new Error('Expected prepared delivery.');
  const client = new TelegramBotClient('synthetic-token');
  const repository = new DrizzleTransportStateRepository(f.a.db);
  const sender = new TelegramBotDeliveryExecutor({
    ownerId: f.ownerId,
    connectionId: f.connectionId,
    deliveryEnabled,
    repository,
    client,
  });
  const executor = new StatelessCanonicalJobExecutor({
    lifecycle,
    workerId: 'synthetic-telegram',
    handler: { execute: (job) => sender.execute(job) },
  });
  const signal = { jobId: deliveryId, correlationId: f.job.correlationId, generation: 1 };
  return {
    ...f,
    lifecycle,
    client,
    repository,
    sender,
    executor,
    signal,
    async delivery() {
      const [row] = await f.a.db
        .select()
        .from(outboundMessageDeliveries)
        .where(eq(outboundMessageDeliveries.id, signal.jobId));
      return row!;
    },
    async lease() {
      const lease = await lifecycle.recordLease({
        jobId: signal.jobId,
        expectedGeneration: 1,
        workerId: 'synthetic-telegram',
        leaseDurationMilliseconds: 30_000,
      });
      if (lease.disposition !== 'claimed') throw new Error('Expected sender lease.');
      return lease.job;
    },
  };
}

describe('requested reminder final-send revalidation and provider failures', () => {
  const changes = [
    {
      name: 'owner enrollment revoked',
      category: 'telegram_final_owner_enrollment_revoked',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(messagingIdentityAliases)
          .set({ approved: false })
          .where(eq(messagingIdentityAliases.ownerId, f.ownerId));
      },
    },
    {
      name: 'quiet mode enabled',
      category: 'telegram_final_quiet_mode',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db.insert(quietModePeriods).values({
          ownerId: f.ownerId,
          startsAt: new Date(Date.now() - 1000),
          endsAt: new Date(Date.now() + 60_000),
          source: 'synthetic_test',
          correlationId: f.job.correlationId,
        });
      },
    },
    {
      name: 'reminder cancelled',
      category: 'telegram_final_reminder_inactive',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(reminders)
          .set({ state: 'cancelled', cancelledAt: new Date() })
          .where(eq(reminders.id, f.reminder.id));
      },
    },
    {
      name: 'fire generation superseded',
      category: 'telegram_final_reminder_superseded',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(jobs)
          .set({ dispatchGeneration: 2, status: 'queued' })
          .where(eq(jobs.id, f.job.id));
      },
    },
    {
      name: 'reminder job replaced',
      category: 'telegram_final_reminder_superseded',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(reminders)
          .set({ jobId: randomUUID() })
          .where(eq(reminders.id, f.reminder.id));
      },
    },
    {
      name: 'delivery permission revoked',
      category: 'telegram_final_delivery_disabled',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(messagingTransportConnections)
          .set({ outboundEnabled: false })
          .where(eq(messagingTransportConnections.id, f.connectionId));
      },
    },
    {
      name: 'connection disconnected',
      category: 'telegram_final_transport_unavailable',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(messagingTransportConnections)
          .set({ state: 'disconnected' })
          .where(eq(messagingTransportConnections.id, f.connectionId));
      },
    },
    {
      name: 'owner conversation changed',
      category: 'telegram_final_owner_enrollment_revoked',
      change: async (f: Awaited<ReturnType<typeof preparedFixture>>) => {
        await f.b.db
          .update(conversations)
          .set({ state: 'closed' })
          .where(eq(conversations.ownerId, f.ownerId));
      },
    },
  ];
  test.skipIf(!urlA).each(changes)(
    'blocks $name committed after preparation',
    async ({ change, category }) => {
      const f = await preparedFixture();
      try {
        const job = await f.lease();
        const send = vi.spyOn(f.client, 'sendText');
        await change(f);
        await f.sender.execute(job);
        expect(send).not.toHaveBeenCalled();
        const delivery = await f.delivery();
        expect(delivery).toMatchObject({
          state: 'failed_terminal',
          lastErrorCategory: category,
          acceptedAt: null,
          deliveredAt: null,
          readAt: null,
          leaseToken: null,
        });
        const [reminder] = await f.a.db
          .select()
          .from(reminders)
          .where(eq(reminders.id, f.reminder.id));
        expect(reminder!.completedAt).toBeNull();
        expect(reminder!.metadata.fireDeliveryId).toBe(delivery.id);
        const audit = await f.a.db
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.ownerId, f.ownerId),
              eq(auditEvents.action, 'transport.telegram.final_send_blocked'),
            ),
          );
        expect(audit).toHaveLength(1);
        expect(audit[0]!.metadata.reasonCategory).toBe(category);
        expect(f.model.requests).toHaveLength(1);
      } finally {
        await f.close();
      }
    },
    30_000,
  );

  test.skipIf(!urlA).each(['generation', 'execution_lease', 'delivery_lease'])(
    'fences a stale %s immediately before dispatch',
    async (kind) => {
      const f = await preparedFixture();
      try {
        const job = await f.lease();
        const send = vi.spyOn(f.client, 'sendText');
        if (kind !== 'delivery_lease') {
          await f.b.db
            .update(jobs)
            .set(
              kind === 'generation'
                ? { dispatchGeneration: 2 }
                : { leaseExpiresAt: new Date(Date.now() - 1000) },
            )
            .where(eq(jobs.id, job.id));
          await f.sender.execute(job);
        } else {
          const lease = await f.repository.acquireOutboundDeliveryLeaseForTelegramBot({
            ownerId: f.ownerId,
            deliveryId: job.id,
            bridgeId: 'telegram-bot-runtime',
          });
          if (lease.status !== 'ready') throw new Error('Expected delivery lease.');
          await f.b.db
            .update(outboundMessageDeliveries)
            .set({ leaseExpiresAt: new Date(Date.now() - 1000) })
            .where(eq(outboundMessageDeliveries.id, job.id));
          expect(
            await f.repository.revalidateTelegramFinalSend({
              ownerId: f.ownerId,
              connectionId: f.connectionId,
              deliveryId: job.id,
              bridgeId: 'telegram-bot-runtime',
              leaseToken: lease.leaseToken,
              job,
              deliveryEnabled: true,
              intent: lease.intent,
            }),
          ).toMatchObject({
            disposition: 'blocked',
            reasonCategory: 'telegram_final_delivery_lease_stale',
          });
        }
        expect(send).not.toHaveBeenCalled();
        expect(await f.delivery()).toMatchObject({
          state: 'failed_terminal',
          acceptedAt: null,
          deliveredAt: null,
          readAt: null,
        });
      } finally {
        await f.close();
      }
    },
    30_000,
  );

  test.skipIf(!urlA)(
    'transport disabled after preparation persists a non-success without a provider call',
    async () => {
      const f = await preparedFixture(false);
      try {
        const send = vi.spyOn(f.client, 'sendText');
        expect(await f.executor.run(f.signal)).toEqual({ disposition: 'completed' });
        expect(send).not.toHaveBeenCalled();
        expect(await f.delivery()).toMatchObject({
          state: 'failed_terminal',
          lastErrorCategory: 'telegram_final_transport_disabled',
          acceptedAt: null,
        });
      } finally {
        await f.close();
      }
    },
    30_000,
  );

  test.skipIf(!urlA)(
    'duplicate concurrent and replayed sender executions send once and preserve the reminder',
    async () => {
      const f = await preparedFixture();
      try {
        const send = vi.spyOn(f.client, 'sendText').mockResolvedValue({
          disposition: 'accepted',
          providerMessageReference: `tg:message:${'c'.repeat(64)}`,
          acceptedAt: new Date().toISOString(),
          errorCategory: null,
          requiresReconciliation: false,
        });
        const results = await Promise.all([f.executor.run(f.signal), f.executor.run(f.signal)]);
        expect(results).toContainEqual({ disposition: 'completed' });
        expect(await f.executor.run(f.signal)).toEqual({ disposition: 'already_completed' });
        expect(send).toHaveBeenCalledTimes(1);
        expect(await f.delivery()).toMatchObject({
          state: 'sent',
          attemptCount: 1,
          deliveredAt: null,
          readAt: null,
        });
        const [reminder] = await f.a.db
          .select()
          .from(reminders)
          .where(eq(reminders.id, f.reminder.id));
        expect(reminder).toMatchObject({ state: 'active', completedAt: null });
        expect(f.model.requests).toHaveLength(1);
      } finally {
        await f.close();
      }
    },
    30_000,
  );

  test.skipIf(!urlA)(
    'the final dispatch capability cannot be consumed twice under the same lease',
    async () => {
      const f = await preparedFixture();
      try {
        const job = await f.lease();
        const lease = await f.repository.acquireOutboundDeliveryLeaseForTelegramBot({
          ownerId: f.ownerId,
          deliveryId: job.id,
          bridgeId: 'telegram-bot-runtime',
        });
        if (lease.status !== 'ready') throw new Error('Expected delivery lease.');
        const input = {
          ownerId: f.ownerId,
          connectionId: f.connectionId,
          deliveryId: job.id,
          bridgeId: 'telegram-bot-runtime',
          leaseToken: lease.leaseToken,
          job,
          deliveryEnabled: true,
          intent: lease.intent,
        };
        expect(await f.repository.revalidateTelegramFinalSend(input)).toMatchObject({
          disposition: 'ready',
        });
        expect(await f.repository.revalidateTelegramFinalSend(input)).toEqual({
          disposition: 'already_handled',
        });
        await f.b.db
          .update(outboundMessageDeliveries)
          .set({
            leaseExpiresAt: new Date(Date.now() - 1000),
            expiresAt: new Date(Date.now() - 1000),
          })
          .where(eq(outboundMessageDeliveries.id, job.id));
        expect(
          await f.repository.acquireOutboundDeliveryLeaseForTelegramBot({
            ownerId: f.ownerId,
            deliveryId: job.id,
            bridgeId: 'telegram-bot-runtime',
          }),
        ).not.toMatchObject({ status: 'ready' });
        expect(await f.delivery()).toMatchObject({
          state: 'failed_retryable',
          requiresReconciliation: true,
          acceptedAt: null,
        });
      } finally {
        await f.close();
      }
    },
    30_000,
  );

  test.skipIf(!urlA).each([503, 429])(
    'explicit Telegram %s rejection retries the same operation no earlier than the committed floor',
    async (code) => {
      const f = await preparedFixture();
      try {
        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce({
            json: async () => ({
              ok: false,
              error_code: code,
              parameters: { retry_after: code === 429 ? 45 : 0 },
            }),
          })
          .mockResolvedValue({ json: async () => ({ ok: true, result: { message_id: 7 } }) });
        vi.stubGlobal('fetch', fetchMock);
        const result = await f.executor.run(f.signal);
        const failed = await f.delivery();
        expect(result).toMatchObject({ disposition: 'retry_allowed' });
        if (result.disposition !== 'retry_allowed') throw new Error('Expected bounded retry.');
        expect(result.retryAt).toBeGreaterThanOrEqual(failed.availableAfter.getTime());
        expect(failed).toMatchObject({
          state: 'failed_retryable',
          requiresReconciliation: false,
          attemptCount: 1,
          acceptedAt: null,
        });
        expect(failed.availableAfter.getTime() - failed.failedAt!.getTime()).toBeGreaterThanOrEqual(
          code === 429 ? 45_000 : 5_000,
        );
        expect(await f.executor.run(f.signal)).toEqual({ disposition: 'stale' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // Controlled clock advancement in the disposable database; no real sleep/provider traffic.
        await f.b.db
          .update(jobs)
          .set({ availableAfter: new Date(Date.now() - 1000) })
          .where(eq(jobs.id, f.signal.jobId));
        await f.b.db
          .update(outboundMessageDeliveries)
          .set({ availableAfter: new Date(Date.now() - 1000) })
          .where(eq(outboundMessageDeliveries.id, f.signal.jobId));
        expect(await f.executor.run(f.signal)).toEqual({ disposition: 'completed' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(await f.delivery()).toMatchObject({
          id: failed.id,
          messageId: failed.messageId,
          operationKey: failed.operationKey,
          state: 'sent',
          attemptCount: 2,
          deliveredAt: null,
          readAt: null,
        });
        expect((await f.lifecycle.load({ jobId: f.signal.jobId }))!.dispatchGeneration).toBe(1);
        expect(f.model.requests).toHaveLength(1);
      } finally {
        await f.close();
      }
    },
    30_000,
  );

  test.skipIf(!urlA).each(['timeout', 'malformed_success', 'terminal', 'wait_beyond_expiry'])(
    'persists %s honestly and never replays an unsafe send',
    async (kind) => {
      const f = await preparedFixture();
      try {
        const fetchMock =
          kind === 'timeout'
            ? vi.fn().mockRejectedValue(new Error('timeout'))
            : vi.fn().mockResolvedValue({
                json: async () =>
                  kind === 'malformed_success'
                    ? { ok: true }
                    : {
                        ok: false,
                        error_code: kind === 'terminal' ? 403 : 429,
                        parameters: { retry_after: 10000 },
                      },
              });
        vi.stubGlobal('fetch', fetchMock);
        expect(await f.executor.run(f.signal)).toEqual({ disposition: 'completed' });
        const unknown = ['timeout', 'malformed_success'].includes(kind);
        expect(await f.delivery()).toMatchObject({
          state: unknown ? 'failed_retryable' : 'failed_terminal',
          requiresReconciliation: unknown,
          acceptedAt: null,
          deliveredAt: null,
          readAt: null,
          lastErrorCategory: unknown
            ? 'telegram_bot_outcome_unknown'
            : kind === 'terminal'
              ? 'telegram_bot_http_403'
              : 'delivery_expired',
        });
        await f.b.db
          .update(outboundMessageDeliveries)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(outboundMessageDeliveries.id, f.signal.jobId));
        expect(await f.executor.run(f.signal)).toEqual({ disposition: 'already_completed' });
        const canonical = await f.lifecycle.load({ jobId: f.signal.jobId });
        await f.sender.execute(canonical!);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect((await f.delivery()).requiresReconciliation).toBe(unknown);
        const [reminder] = await f.a.db
          .select()
          .from(reminders)
          .where(eq(reminders.id, f.reminder.id));
        expect(reminder!.completedAt).toBeNull();
      } finally {
        await f.close();
      }
    },
    30_000,
  );
});

describe('requested reminder disposable two-role vertical slice', () => {
  test.skipIf(!urlA)(
    'obsolete reminders expire and quiet mode suppresses without sending',
    async () => {
      const f = await fixture();
      try {
        expect(
          await f.fireA.prepare(f.job, new Date(new Date(f.job.scheduledFor).getTime() + 900_001)),
        ).toMatchObject({ status: 'expired', deliveryId: null });
        expect(
          await f.a.db
            .select()
            .from(outboundMessageDeliveries)
            .where(eq(outboundMessageDeliveries.ownerId, f.ownerId)),
        ).toHaveLength(0);
      } finally {
        await f.close();
      }
      const quiet = await fixture();
      try {
        await quiet.a.db.insert(quietModePeriods).values({
          ownerId: quiet.ownerId,
          startsAt: new Date(Date.now() - 10_000),
          endsAt: new Date(Date.now() + 60_000),
          source: 'synthetic_test',
          correlationId: quiet.job.correlationId,
        });
        expect(await quiet.fireB.prepare(quiet.job)).toMatchObject({
          status: 'delivery_policy_blocked',
          deliveryId: null,
        });
      } finally {
        await quiet.close();
      }
    },
    30_000,
  );
  test.skipIf(!urlA)(
    'canonical action executes, due-time concurrency queues once, Telegram acceptance persists and replay does no work',
    async () => {
      const f = await fixture();
      try {
        expect(await f.fireA.queuedJobsForEvent(f.ownerId, f.eventId)).toEqual([f.job.id]);
        const results = await Promise.all([f.fireA.prepare(f.job), f.fireB.prepare(f.job)]);
        expect(results.map((r) => r.status).sort()).toEqual(['duplicate', 'queued']);
        expect(results[0]!.deliveryId).toBe(results[1]!.deliveryId);
        const outbox = await f.a.db
          .select()
          .from(outboundMessageDeliveries)
          .where(eq(outboundMessageDeliveries.ownerId, f.ownerId));
        expect(outbox).toHaveLength(1);
        expect(
          await f.a.db
            .select()
            .from(reminderAttempts)
            .where(eq(reminderAttempts.ownerId, f.ownerId)),
        ).toHaveLength(1);
        const client = new TelegramBotClient('synthetic-token');
        const send = vi.spyOn(client, 'sendText').mockResolvedValue({
          disposition: 'accepted',
          providerMessageReference: `tg:message:${'b'.repeat(64)}`,
          acceptedAt: new Date().toISOString(),
          errorCategory: null,
          requiresReconciliation: false,
        });
        const delivery = new TelegramBotDeliveryExecutor({
          ownerId: f.ownerId,
          connectionId: f.connectionId,
          repository: new DrizzleTransportStateRepository(f.a.db),
          deliveryEnabled: true,
          client,
        });
        const lifecycle = new DrizzleDurableJobLifecycleProjection(f.a.db);
        const fireLease = await lifecycle.recordLease({
          jobId: f.job.id,
          expectedGeneration: f.job.dispatchGeneration,
          workerId: 'synthetic-fire',
          leaseDurationMilliseconds: 30_000,
        });
        expect(fireLease.disposition).toBe('claimed');
        if (fireLease.disposition !== 'claimed') throw new Error('Expected fire lease.');
        await lifecycle.recordCompletion({
          jobId: f.job.id,
          expectedGeneration: f.job.dispatchGeneration,
          workerId: 'synthetic-fire',
          attemptNumber: fireLease.attemptNumber,
        });
        const executor = new StatelessCanonicalJobExecutor({
          lifecycle,
          workerId: 'synthetic-telegram',
          handler: { execute: (job) => delivery.execute(job) },
        });
        const signal = { jobId: outbox[0]!.id, correlationId: f.job.correlationId, generation: 1 };
        expect(await executor.run(signal)).toEqual({ disposition: 'completed' });
        expect(await executor.run(signal)).toEqual({ disposition: 'already_completed' });
        expect(send).toHaveBeenCalledTimes(1);
        const [sent] = await f.a.db
          .select()
          .from(outboundMessageDeliveries)
          .where(eq(outboundMessageDeliveries.id, outbox[0]!.id));
        expect(sent).toMatchObject({
          state: 'sent',
          attemptCount: 1,
          deliveredAt: null,
          readAt: null,
        });
        expect(sent!.acceptedAt).not.toBeNull();
        expect((await f.service.process(f.input)).status).toBe('duplicate');
        expect(f.model.requests).toHaveLength(1);
        expect((await f.fireA.prepare(f.job)).status).toBe('duplicate');
        const counts = await f.a.db.execute(
          sql`select (select count(*) from jarvis.reminders where owner_id=${f.ownerId}::uuid) as reminders, (select count(*) from jarvis.proposed_actions where owner_id=${f.ownerId}::uuid) as actions, (select count(*) from jarvis.action_executions where owner_id=${f.ownerId}::uuid) as executions, (select count(*) from jarvis.jobs where owner_id=${f.ownerId}::uuid) as jobs`,
        );
        expect(counts.rows[0]).toMatchObject({
          reminders: '1',
          actions: '1',
          executions: '1',
          jobs: '2',
        });
      } finally {
        await f.close();
      }
    },
    30_000,
  );
  test.skipIf(!urlA)(
    'not due, stale time and foreign bindings cannot fire',
    async () => {
      const f = await fixture();
      try {
        await expect(
          f.fireA.prepare(f.job, new Date(new Date(f.job.scheduledFor).getTime() - 1)),
        ).rejects.toThrow('not due');
        await f.a.db
          .update(reminders)
          .set({
            nextEligibleDeliveryAt: new Date(new Date(f.job.scheduledFor).getTime() - 10_000),
          })
          .where(eq(reminders.id, f.reminder.id));
        await expect(f.fireB.prepare(f.job)).rejects.toThrow('due time changed');
        await expect(
          f.fireA.prepare({
            ...f.job,
            payload: { ...f.job.payload, sourceActionId: randomUUID() },
          }),
        ).rejects.toThrow('binding');
        expect(
          await f.a.db
            .select()
            .from(outboundMessageDeliveries)
            .where(eq(outboundMessageDeliveries.ownerId, f.ownerId)),
        ).toHaveLength(0);
      } finally {
        await f.close();
      }
    },
    30_000,
  );
  test.skipIf(!urlA)(
    'revoked enrollment and kill switch suppress requested delivery without completing a commitment',
    async () => {
      const f = await fixture();
      try {
        await f.a.db
          .update(messagingIdentityAliases)
          .set({ approved: false })
          .where(eq(messagingIdentityAliases.ownerId, f.ownerId));
        await f.a.db
          .update(messagingTransportConnections)
          .set({ outboundEnabled: false })
          .where(eq(messagingTransportConnections.id, f.connectionId));
        expect(await f.fireA.prepare(f.job)).toMatchObject({
          deliveryId: null,
          status: 'delivery_policy_blocked',
        });
        expect(await f.fireB.prepare(f.job)).toMatchObject({
          deliveryId: null,
          status: 'inactive',
        });
        expect(
          await f.a.db
            .select()
            .from(outboundMessageDeliveries)
            .where(eq(outboundMessageDeliveries.ownerId, f.ownerId)),
        ).toHaveLength(0);
        const [reminder] = await f.a.db
          .select()
          .from(reminders)
          .where(eq(reminders.id, f.reminder.id));
        expect(reminder!.state).toBe('active');
        expect(reminder!.completedAt).toBeNull();
      } finally {
        await f.close();
      }
    },
    30_000,
  );
  test.skipIf(!urlA)(
    'failed outbox transaction rolls back fire state and retry produces one delivery',
    async () => {
      const f = await fixture();
      try {
        const failing = new DrizzleRequestedReminderFireRepository(
          f.a.db,
          new DrizzleDurableDeliveryOutbox(f.a.db, {
            enqueue: async () => {
              throw new Error('synthetic enqueue failure');
            },
          }),
          f.connectionId,
          true,
        );
        await expect(failing.prepare(f.job)).rejects.toThrow('synthetic enqueue failure');
        expect(
          await f.a.db
            .select()
            .from(messages)
            .where(and(eq(messages.ownerId, f.ownerId), eq(messages.direction, 'outbound'))),
        ).toHaveLength(1); // Scheduled acknowledgement only.
        expect(
          await f.a.db
            .select()
            .from(reminderAttempts)
            .where(eq(reminderAttempts.ownerId, f.ownerId)),
        ).toHaveLength(0);
        expect((await f.fireA.prepare(f.job)).status).toBe('queued');
        expect((await f.fireB.prepare(f.job)).status).toBe('duplicate');
      } finally {
        await f.close();
      }
    },
    30_000,
  );
});
