import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import type { DurableJob, DurableJobInput } from '@jarvis/contracts';
import {
  createDeterministicPhaseOneHandlers,
  type EventPipelineDependencies,
} from '@jarvis/domain';
import {
  canonicalJobSignal,
  createCanonicalEventProcessingJob,
  createCanonicalPolicyEvaluator,
  type OrchestrationPublisher,
} from '@jarvis/orchestration';
import { InMemoryEventStore } from '@jarvis/testing';

const ownerId = '00000000-0000-4000-8000-000000000001';
const secret = 'telegram-test-webhook-secret-0123456789';
const now = new Date('2026-09-30T12:00:00.000Z');
function update(overrides: Record<string, unknown> = {}) {
  return {
    update_id: 8101,
    message: {
      message_id: 91,
      date: 1_790_780_400,
      from: { id: 77 },
      chat: { id: 77, type: 'private' },
      text: 'Hey Jarvis',
    },
    ...overrides,
  };
}
function durable(job: DurableJobInput): DurableJob {
  return {
    ...job,
    status: 'queued',
    attemptCount: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCategory: null,
    lastErrorSummary: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
  };
}
function harness(
  options: {
    enrolled?: boolean;
    typingFailure?: boolean;
    pendingTyping?: boolean;
    persistenceFailure?: boolean;
  } = {},
) {
  const store = new InMemoryEventStore();
  const scheduleJob = vi.fn<OrchestrationPublisher['scheduleJob']>(async () => undefined);
  const pipeline: EventPipelineDependencies = {
    store,
    handlers: createDeterministicPhaseOneHandlers(),
    policy: createCanonicalPolicyEvaluator(),
    createJob: createCanonicalEventProcessingJob,
  };
  const recordObservedParticipant = vi.fn(async () => undefined);
  const order: string[] = [];
  const seenMessages = new Set<string>();
  const persistInboundMessage = vi.fn(
    async (input: { message: { providerMessageReference: string } }) => {
      order.push('persisted');
      if (options.persistenceFailure) throw new Error('unavailable');
      const duplicate = seenMessages.has(input.message.providerMessageReference);
      seenMessages.add(input.message.providerMessageReference);
      return { id: 'canonical-message', conversationId: 'canonical-conversation', duplicate };
    },
  );
  const isEnrolledOwner = vi.fn(async () => {
    order.push('enrolled');
    return options.enrolled ?? true;
  });
  const typing = vi.fn(() => {
    order.push('typing');
    if (options.typingFailure) throw new Error('typing unavailable');
    if (options.pendingTyping) return new Promise<void>(() => undefined);
    return Promise.resolve();
  });
  scheduleJob.mockImplementation(async () => {
    order.push('queued');
  });
  const app = buildApi({
    environment: { APP_ENV: 'test' },
    telegramBot: {
      webhookSecret: secret,
      ownerId,
      pipeline,
      orchestration: { scheduleJob },
      ownerDirectMessagingEnabled: true,
      recordObservedParticipant,
      inbound: { persistInboundMessage },
      isEnrolledOwner,
      launchTyping: () => {
        void typing().catch(() => undefined);
      },
      loadCanonicalJobForEvent: async (eventId) => {
        const job = store.jobs.find((candidate) => candidate.payload.eventId === eventId);
        return job ? durable(job) : undefined;
      },
      now: () => now,
    },
  });
  return {
    app,
    store,
    scheduleJob,
    recordObservedParticipant,
    order,
    typing,
    persistInboundMessage,
    isEnrolledOwner,
  };
}
describe('official Telegram Bot API webhook boundary', () => {
  let app: ReturnType<typeof buildApi> | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  it('requires the exact secret before canonical processing', async () => {
    const h = harness();
    app = h.app;
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      payload: update(),
    });
    expect(response.statusCode).toBe(401);
    expect(h.store.events).toHaveLength(0);
    expect(h.typing).not.toHaveBeenCalled();
  });
  it('normalizes one private text update and deduplicates update_id without retaining numeric identities', async () => {
    const h = harness();
    app = h.app;
    const send = () =>
      app!.inject({
        method: 'POST',
        url: '/webhooks/telegram',
        headers: { 'x-telegram-bot-api-secret-token': secret },
        payload: update(),
      });
    expect((await send()).statusCode).toBe(202);
    expect((await send()).statusCode).toBe(200);
    expect(h.store.events).toHaveLength(1);
    expect(h.scheduleJob).toHaveBeenCalledTimes(2);
    expect(h.recordObservedParticipant).toHaveBeenCalledTimes(2);
    expect(h.typing).toHaveBeenCalledOnce();
    const event = h.store.events[0]!;
    expect(event).toMatchObject({
      eventType: 'telegram.bot.message.observed.v1',
      source: 'telegram',
      payload: { transport: 'telegram_bot', conversationType: 'direct', text: 'Hey Jarvis' },
    });
    const persisted = JSON.stringify(event);
    expect(persisted).not.toContain('"77"');
    expect(persisted).not.toContain('"91"');
  });
  it('launches typing after committed inbound evidence and exact enrollment, before queue signalling, without waiting for Bot API', async () => {
    const h = harness({ pendingTyping: true });
    app = h.app;
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': secret },
      payload: update(),
    });
    expect(response.statusCode).toBe(202);
    expect(h.order).toEqual(['persisted', 'enrolled', 'typing', 'queued']);
    expect(h.store.events).toHaveLength(1);
    expect(h.store.jobs).toHaveLength(1);
  });
  it('never types for an unenrolled participant', async () => {
    const h = harness({ enrolled: false });
    app = h.app;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/webhooks/telegram',
          headers: { 'x-telegram-bot-api-secret-token': secret },
          payload: update(),
        })
      ).statusCode,
    ).toBe(202);
    expect(h.typing).not.toHaveBeenCalled();
    expect(h.persistInboundMessage).toHaveBeenCalledOnce();
  });
  it('suppresses typing for the same message repeated under a different update id', async () => {
    const h = harness();
    app = h.app;
    for (const update_id of [8101, 8102])
      await app.inject({
        method: 'POST',
        url: '/webhooks/telegram',
        headers: { 'x-telegram-bot-api-secret-token': secret },
        payload: update({ update_id }),
      });
    expect(h.typing).toHaveBeenCalledOnce();
  });
  it('a typing launch failure does not fail canonical queue signalling', async () => {
    const h = harness({ typingFailure: true });
    app = h.app;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/webhooks/telegram',
          headers: { 'x-telegram-bot-api-secret-token': secret },
          payload: update(),
        })
      ).statusCode,
    ).toBe(202);
    expect(h.scheduleJob).toHaveBeenCalledOnce();
  });
  it('never launches typing before inbound persistence succeeds', async () => {
    const h = harness({ persistenceFailure: true });
    app = h.app;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/webhooks/telegram',
          headers: { 'x-telegram-bot-api-secret-token': secret },
          payload: update(),
        })
      ).statusCode,
    ).toBe(503);
    expect(h.typing).not.toHaveBeenCalled();
    expect(h.isEnrolledOwner).not.toHaveBeenCalled();
  });
  it('retains an authenticated observed participant before enrollment without dispatching Brain work', async () => {
    const h = harness();
    app = h.app;
    await app.close();
    app = buildApi({
      environment: { APP_ENV: 'test' },
      telegramBot: {
        webhookSecret: secret,
        ownerId,
        pipeline: {
          store: h.store,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: createCanonicalPolicyEvaluator(),
          createJob: createCanonicalEventProcessingJob,
        },
        orchestration: { scheduleJob: h.scheduleJob },
        ownerDirectMessagingEnabled: false,
        recordObservedParticipant: h.recordObservedParticipant,
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': secret },
      payload: update(),
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ accepted: true, ownerEligible: false });
    expect(h.store.events).toHaveLength(1);
    expect(h.recordObservedParticipant).toHaveBeenCalledOnce();
    expect(h.scheduleJob).not.toHaveBeenCalled();
  });
  it('reports a safe participant-store category without retaining a database error', async () => {
    const h = harness();
    app = h.app;
    await app.close();
    app = buildApi({
      environment: { APP_ENV: 'test' },
      telegramBot: {
        webhookSecret: secret,
        ownerId,
        pipeline: {
          store: h.store,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: createCanonicalPolicyEvaluator(),
          createJob: createCanonicalEventProcessingJob,
        },
        orchestration: { scheduleJob: h.scheduleJob },
        recordObservedParticipant: async () => {
          const error = Object.assign(new Error('hidden database detail'), { code: '42501' });
          throw error;
        },
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': secret },
      payload: update(),
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'canonical_telegram_ingress_unavailable' });
    expect(h.store.events).toHaveLength(0);
  });
  it('safely rejects group, mismatched private chat, callback, and non-text updates before an owner turn', async () => {
    const h = harness();
    app = h.app;
    const header = { 'x-telegram-bot-api-secret-token': secret };
    for (const payload of [
      update({ message: { ...(update().message as object), chat: { id: -100, type: 'group' } } }),
      update({ message: { ...(update().message as object), chat: { id: 88, type: 'private' } } }),
      { update_id: 8102, callback_query: {} },
      update({
        message: {
          message_id: 92,
          date: 1_790_780_400,
          from: { id: 77 },
          chat: { id: 77, type: 'private' },
        },
      }),
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/telegram',
        headers: header,
        payload,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ accepted: false });
    }
    expect(h.store.events).toHaveLength(0);
  });
});
