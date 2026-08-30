import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { buildApi } from '@jarvis/api';
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
});
