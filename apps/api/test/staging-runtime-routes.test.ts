import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import { initialJobDispatchGeneration, productionSmokeFixtureIds } from '@jarvis/contracts';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import { evaluatePolicy } from '@jarvis/security';
import { InMemoryEventStore } from '@jarvis/testing';

const ownerId = '00000000-0000-4000-8000-000000000001';
const stagingToken = 'staging-runtime-test-token-not-a-deployment-secret';

describe('staging synthetic runtime route', () => {
  let app: ReturnType<typeof buildApi> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('requires trusted staging access and only creates one canonical event on replay', async () => {
    const store = new InMemoryEventStore();
    app = buildApi({
      environment: {
        APP_ENV: 'staging',
        DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      },
      stagingRuntime: {
        appEnvironment: 'staging',
        ownerId,
        accessToken: stagingToken,
        pipeline: {
          store,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: {
            evaluate(action) {
              return evaluatePolicy(action, { ownerAuthorized: true });
            },
          },
          createJob(event) {
            return {
              id: randomUUID(),
              ownerId: event.ownerId,
              jobType: 'jarvis.event.process',
              payload: { eventId: event.id, ownerId: event.ownerId },
              priority: 0,
              scheduledFor: event.receivedAt,
              availableAfter: event.receivedAt,
              executionDeadline: null,
              dispatchGeneration: initialJobDispatchGeneration,
              maximumAttempts: 5,
              correlationId: event.correlationId,
              sourceEventId: event.id,
              idempotencyKey: `event-process:${event.id}`,
            };
          },
        },
        now: () => new Date('2026-08-30T12:00:00.000Z'),
      },
    });

    const body = {
      message: 'Synthetic staging request only.',
      idempotencyKey: 'staging-route-replay-key-0001',
    };
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/internal/staging/synthetic-turn',
      payload: body,
    });
    const accepted = await app.inject({
      method: 'POST',
      url: '/internal/staging/synthetic-turn',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: body,
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/internal/staging/synthetic-turn',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: body,
    });
    const bodyOwnerInjection = await app.inject({
      method: 'POST',
      url: '/internal/staging/synthetic-turn',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: { ...body, ownerId: '00000000-0000-4000-8000-000000000099' },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(202);
    expect(replay.statusCode).toBe(200);
    expect(JSON.parse(replay.payload)).toMatchObject({ accepted: true, duplicate: true });
    expect(bodyOwnerInjection.statusCode).toBe(400);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      ownerId,
      eventType: 'internal.conversation.received.v1',
      source: 'internal',
    });
    expect(store.jobs).toHaveLength(1);
  });

  it('admits only a fixed casual-chat selector and exposes no arbitrary owner/chat input', async () => {
    const runCasualChatBenchmark = vi.fn(async () => ({
      responseStatus: 'completed',
      responseMessage: 'Synthetic response.',
      strictSchemaSuccess: true,
      model: {
        provider: 'vercel-ai-gateway',
        modelId: 'openai/gpt-6-luna',
        reasoningEffort: 'low',
        inputTokens: 1,
        outputTokens: 1,
        reasoningTokens: 0,
        exactGatewayCostUsd: 0.000001,
        modelLatencyMs: 1,
      },
      brainProcessingLatencyMs: 2,
    }));
    app = buildApi({
      environment: { APP_ENV: 'staging', DATABASE_URL: 'postgresql://staging.invalid/jarvis' },
      casualChatBenchmark: { accessToken: stagingToken, runCasualChatBenchmark },
    });
    const body = {
      runId: '30303030-3030-4030-8030-303030303030',
      caseId: 'greeting',
      reasoning: 'low',
    };
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/internal/benchmark/casual-chat',
      payload: body,
    });
    const accepted = await app.inject({
      method: 'POST',
      url: '/internal/benchmark/casual-chat',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: body,
    });
    const injected = await app.inject({
      method: 'POST',
      url: '/internal/benchmark/casual-chat',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: { ...body, message: 'untrusted' },
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(200);
    expect(injected.statusCode).toBe(400);
    expect(runCasualChatBenchmark).toHaveBeenCalledExactlyOnceWith(body);
  });

  it('cleans only a caller-selected exact synthetic run through the protected lifecycle', async () => {
    const cleanupProductionSmokeRun = vi.fn(async () => undefined);
    app = buildApi({
      environment: { APP_ENV: 'staging', DATABASE_URL: 'postgresql://staging.invalid/jarvis' },
      casualChatBenchmark: {
        accessToken: stagingToken,
        runCasualChatBenchmark: async () => {
          throw new Error('not used');
        },
        cleanupProductionSmokeRun,
      },
    });
    const runId = '30303030-3030-4030-8030-303030303030';
    const rejected = await app.inject({
      method: 'POST',
      url: '/internal/benchmark/casual-chat/cleanup',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: { runId, ownerId },
    });
    const accepted = await app.inject({
      method: 'POST',
      url: '/internal/benchmark/casual-chat/cleanup',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: { runId },
    });
    expect(rejected.statusCode).toBe(400);
    expect(accepted.statusCode).toBe(200);
    expect(cleanupProductionSmokeRun).toHaveBeenCalledExactlyOnceWith({ runId });
  });

  it('keeps the committed canonical job recoverable when opaque publication fails', async () => {
    const store = new InMemoryEventStore();
    const signalCanonicalJob = vi
      .fn(async () => undefined)
      .mockRejectedValueOnce(new Error('opaque coordinator unavailable'));
    app = buildApi({
      environment: {
        APP_ENV: 'staging',
        DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      },
      stagingRuntime: {
        appEnvironment: 'staging',
        ownerId,
        accessToken: stagingToken,
        pipeline: {
          store,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: {
            evaluate(action) {
              return evaluatePolicy(action, { ownerAuthorized: true });
            },
          },
          createJob(event) {
            return {
              id: randomUUID(),
              ownerId: event.ownerId,
              jobType: 'jarvis.event.process',
              payload: { eventId: event.id, ownerId: event.ownerId },
              priority: 0,
              scheduledFor: event.receivedAt,
              availableAfter: event.receivedAt,
              executionDeadline: null,
              dispatchGeneration: initialJobDispatchGeneration,
              maximumAttempts: 5,
              correlationId: event.correlationId,
              sourceEventId: event.id,
              idempotencyKey: `event-process:${event.id}`,
            };
          },
        },
        signalCanonicalJob,
        async loadCanonicalJobForEvent() {
          const [canonical] = store.jobs;
          if (!canonical) return undefined;
          return {
            ...canonical,
            status: 'queued',
            attemptCount: 0,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastErrorCategory: null,
            lastErrorSummary: null,
            createdAt: '2026-08-30T12:00:00.000Z',
            updatedAt: '2026-08-30T12:00:00.000Z',
            completedAt: null,
          };
        },
        now: () => new Date('2026-08-30T12:00:00.000Z'),
      },
    });

    const request = () =>
      app!.inject({
        method: 'POST',
        url: '/internal/staging/synthetic-turn',
        headers: { authorization: `Bearer ${stagingToken}` },
        payload: {
          message: 'Recover the same canonical job after a publication outage.',
          idempotencyKey: 'staging-route-handoff-recovery-0001',
        },
      });

    const first = await request();
    const replay = await request();

    expect(first.statusCode).toBe(503);
    expect(replay.statusCode).toBe(200);
    expect(store.events).toHaveLength(1);
    expect(store.jobs).toHaveLength(1);
    expect(signalCanonicalJob).toHaveBeenCalledTimes(2);
    expect(signalCanonicalJob.mock.calls[1]?.[0]).toMatchObject({
      id: store.jobs[0]?.id,
      dispatchGeneration: initialJobDispatchGeneration,
    });
  });

  it('accepts only a fixed quality-case selector and prepares its server-side fixture after ingress', async () => {
    const store = new InMemoryEventStore();
    const prepareQualityCase = vi.fn(async () => undefined);
    app = buildApi({
      environment: {
        APP_ENV: 'staging',
        DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      },
      stagingRuntime: {
        appEnvironment: 'staging',
        ownerId,
        accessToken: stagingToken,
        pipeline: {
          store,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: {
            evaluate(action) {
              return evaluatePolicy(action, { ownerAuthorized: true });
            },
          },
          createJob(event) {
            return {
              id: randomUUID(),
              ownerId: event.ownerId,
              jobType: 'jarvis.event.process',
              payload: { eventId: event.id, ownerId: event.ownerId },
              priority: 0,
              scheduledFor: event.receivedAt,
              availableAfter: event.receivedAt,
              executionDeadline: null,
              dispatchGeneration: initialJobDispatchGeneration,
              maximumAttempts: 5,
              correlationId: event.correlationId,
              sourceEventId: event.id,
              idempotencyKey: `event-process:${event.id}`,
            };
          },
        },
        prepareQualityCase,
      },
    });

    const accepted = await app.inject({
      method: 'POST',
      url: '/internal/staging/synthetic-turn',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: {
        caseId: 'reminder_request',
        idempotencyKey: 'staging-quality-reminder-case-0001',
      },
    });
    const arbitraryContext = await app.inject({
      method: 'POST',
      url: '/internal/staging/synthetic-turn',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: {
        caseId: 'reminder_request',
        idempotencyKey: 'staging-quality-reminder-case-0002',
        context: 'ignored-attempted-injection',
      },
    });

    expect(accepted.statusCode).toBe(202);
    expect(arbitraryContext.statusCode).toBe(400);
    expect(prepareQualityCase).toHaveBeenCalledExactlyOnceWith({ caseId: 'reminder_request' });
    expect(store.events).toHaveLength(1);
    expect(store.events[0]?.payload).toEqual({
      kind: 'synthetic_brain_quality_case',
      caseId: 'reminder_request',
    });
  });

  it('uses an exact UUID-derived synthetic owner and never lets one smoke run clean another', async () => {
    const store = new InMemoryEventStore();
    const firstRun = '10101010-1010-4010-8010-101010101010';
    const otherRun = '20202020-2020-4020-8020-202020202020';
    const prepareProductionSmokeCase = vi.fn(async ({ runId }: { readonly runId: string }) => ({
      ownerId: productionSmokeFixtureIds(runId).owner,
    }));
    const cleanupProductionSmokeRun = vi.fn(async () => undefined);
    app = buildApi({
      environment: {
        APP_ENV: 'staging',
        DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      },
      stagingRuntime: {
        appEnvironment: 'staging',
        ownerId,
        accessToken: stagingToken,
        pipeline: {
          store,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
          createJob(event) {
            return {
              id: randomUUID(),
              ownerId: event.ownerId,
              jobType: 'jarvis.event.process',
              payload: { eventId: event.id, ownerId: event.ownerId },
              priority: 0,
              scheduledFor: event.receivedAt,
              availableAfter: event.receivedAt,
              executionDeadline: null,
              dispatchGeneration: initialJobDispatchGeneration,
              maximumAttempts: 5,
              correlationId: event.correlationId,
              sourceEventId: event.id,
              idempotencyKey: `event-process:${event.id}`,
            };
          },
        },
        prepareProductionSmokeCase,
        cleanupProductionSmokeRun,
      },
    });

    const headers = { authorization: `Bearer ${stagingToken}` };
    for (const rejectedHeaders of [{}, { authorization: 'Bearer wrong-staging-token' }]) {
      const rejected = await app.inject({
        method: 'POST',
        url: '/internal/staging/production-smoke',
        headers: rejectedHeaders,
        payload: {
          runId: firstRun,
          caseId: 'case3_plan_application',
          idempotencyKey: 'production-smoke-unauthorized-10101010',
        },
      });
      expect(rejected.statusCode).toBe(401);
      expect(prepareProductionSmokeCase).not.toHaveBeenCalled();
      expect(store.events).toHaveLength(0);
      expect(store.jobs).toHaveLength(0);
    }
    const start = await app.inject({
      method: 'POST',
      url: '/internal/staging/production-smoke',
      headers,
      payload: {
        runId: firstRun,
        caseId: 'case3_plan_application',
        idempotencyKey: 'production-smoke-case3-run-10101010',
      },
    });
    const injectedOwner = await app.inject({
      method: 'POST',
      url: '/internal/staging/production-smoke',
      headers,
      payload: {
        runId: firstRun,
        caseId: 'case3_plan_application',
        idempotencyKey: 'production-smoke-case3-run-10101011',
        ownerId,
      },
    });
    const cleanup = await app.inject({
      method: 'POST',
      url: '/internal/staging/production-smoke/cleanup',
      headers,
      payload: { runId: firstRun },
    });

    expect(start.statusCode).toBe(202);
    expect(injectedOwner.statusCode).toBe(400);
    expect(store.events[0]?.ownerId).toBe(productionSmokeFixtureIds(firstRun).owner);
    expect(store.events[0]?.ownerId).not.toBe(ownerId);
    expect(prepareProductionSmokeCase).toHaveBeenCalledExactlyOnceWith({
      runId: firstRun,
      caseId: 'case3_plan_application',
    });
    expect(cleanup.statusCode).toBe(200);
    expect(cleanupProductionSmokeRun).toHaveBeenCalledExactlyOnceWith({ runId: firstRun });
    expect(cleanupProductionSmokeRun).not.toHaveBeenCalledWith({ runId: otherRun });
  });
});
