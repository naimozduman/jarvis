import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ingestAuthenticatedEvent } from '@jarvis/api';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import { evaluatePolicy } from '@jarvis/security';
import type { AuthenticationBoundary } from '@jarvis/security';
import { InMemoryEventStore } from '@jarvis/testing';

const ownerId = '00000000-0000-4000-8000-000000000001';

const authentication: AuthenticationBoundary = {
  async authenticate() {
    return {
      ownerId,
      subjectId: '00000000-0000-4000-8000-000000000002',
      authMethod: 'test',
      scopes: ['events:ingest'],
    };
  },
};

describe('authenticated event ingress', () => {
  it('derives the owner from the verified principal and rejects a body-selected owner', async () => {
    const store = new InMemoryEventStore();
    const dependencies = {
      authentication,
      pipeline: {
        store,
        handlers: createDeterministicPhaseOneHandlers(),
        policy: {
          evaluate(action: Parameters<typeof evaluatePolicy>[0]) {
            return evaluatePolicy(action, { ownerAuthorized: true });
          },
        },
        createJob(event: {
          readonly id: string;
          readonly ownerId: string;
          readonly receivedAt: string;
          readonly correlationId: string;
        }) {
          return {
            id: randomUUID(),
            ownerId: event.ownerId,
            jobType: 'jarvis.event.process',
            payload: { eventId: event.id },
            priority: 0,
            scheduledFor: event.receivedAt,
            availableAfter: event.receivedAt,
            maximumAttempts: 5,
            correlationId: event.correlationId,
            sourceEventId: event.id,
            idempotencyKey: `job:${event.id}`,
          };
        },
      },
      now: () => new Date('2026-08-28T12:00:01.000Z'),
    };

    const accepted = await ingestAuthenticatedEvent(dependencies, {
      headers: {},
      method: 'POST',
      path: '/internal/events',
      body: {
        eventType: 'internal.commitment.create.v1',
        source: 'internal',
        idempotencyKey: 'event:1234567890abcdef',
        occurredAt: '2026-08-28T12:00:00.000Z',
        schemaVersion: 1,
        payload: {
          commitmentId: '00000000-0000-4000-8000-000000000101',
          title: 'Finish the schema',
        },
      },
    });

    expect(accepted.event.ownerId).toBe(ownerId);
    await expect(
      ingestAuthenticatedEvent(dependencies, {
        headers: {},
        method: 'POST',
        path: '/internal/events',
        body: {
          eventType: 'internal.commitment.create.v1',
          source: 'internal',
          idempotencyKey: 'event:abcdef1234567890',
          occurredAt: '2026-08-28T12:00:00.000Z',
          schemaVersion: 1,
          ownerId: '00000000-0000-4000-8000-000000000099',
          payload: {},
        },
      }),
    ).rejects.toBeDefined();
  });
});
