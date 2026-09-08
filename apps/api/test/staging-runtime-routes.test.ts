import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import { initialJobDispatchGeneration } from '@jarvis/contracts';
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
});
