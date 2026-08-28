import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { incomingEventEnvelopeSchema } from '@jarvis/contracts';
import type { CanonicalEvent, ProposedAction } from '@jarvis/contracts';
import {
  createDeterministicPhaseOneHandlers,
  ingestCanonicalEvent,
  processCanonicalEvent,
} from '@jarvis/domain';
import type { DeterministicEventHandler, EventPipelineDependencies } from '@jarvis/domain';
import { evaluatePolicy } from '@jarvis/security';
import { InMemoryEventStore } from '@jarvis/testing';

const ownerId = '00000000-0000-4000-8000-000000000001';
const correlationId = '00000000-0000-4000-8000-000000000002';

function createDependencies(store: InMemoryEventStore): EventPipelineDependencies {
  return {
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
        payload: { eventId: event.id },
        priority: 10,
        scheduledFor: event.receivedAt,
        availableAfter: event.receivedAt,
        maximumAttempts: 5,
        correlationId: event.correlationId,
        sourceEventId: event.id,
        idempotencyKey: `job:${event.id}`,
      };
    },
  };
}

describe('canonical deterministic event pipeline', () => {
  it('persists, queues, handles, policies, and audits a duplicate delivery exactly once', async () => {
    const store = new InMemoryEventStore();
    const dependencies = createDependencies(store);
    const envelope = incomingEventEnvelopeSchema.parse({
      eventType: 'internal.commitment.create.v1',
      source: 'internal',
      idempotencyKey: 'event:1234567890abcdef',
      occurredAt: '2026-08-28T12:00:00.000Z',
      schemaVersion: 1,
      payload: {
        commitmentId: '00000000-0000-4000-8000-000000000101',
        title: 'Finish the schema',
      },
    });

    const first = await ingestCanonicalEvent(dependencies, {
      ownerId,
      envelope,
      receivedAt: '2026-08-28T12:00:01.000Z',
      correlationId,
    });
    const second = await ingestCanonicalEvent(dependencies, {
      ownerId,
      envelope,
      receivedAt: '2026-08-28T12:00:02.000Z',
      correlationId,
    });
    const processed = await processCanonicalEvent(dependencies, first.event);

    expect(first).toMatchObject({ duplicate: false, jobQueued: true });
    expect(second).toMatchObject({
      duplicate: true,
      jobQueued: false,
      event: { id: first.event.id },
    });
    expect(processed).toMatchObject({ processed: true, approvalRequested: false });
    expect(store.events).toHaveLength(1);
    expect(store.jobs).toHaveLength(1);
    expect(store.actions).toHaveLength(1);
    expect(store.policyEvaluations).toHaveLength(1);
    expect(store.executedActions).toHaveLength(1);
    expect(store.approvalRequests).toHaveLength(0);
    expect(store.auditEvents).toHaveLength(8);
    expect(store.actions[0]).toMatchObject({ state: 'executed' });
    expect(store.events[0]).toMatchObject({ processingStatus: 'processed' });
  });

  it('records a high-impact proposal for approval without executing it', async () => {
    const store = new InMemoryEventStore();
    const event: CanonicalEvent = {
      id: '00000000-0000-4000-8000-000000000011',
      ownerId,
      eventType: 'internal.high-impact.test.v1',
      source: 'internal',
      idempotencyKey: 'event:abcdef1234567890',
      occurredAt: '2026-08-28T12:00:00.000Z',
      receivedAt: '2026-08-28T12:00:01.000Z',
      payload: {},
      schemaVersion: 1,
      processingStatus: 'queued',
      correlationId,
    };
    const action: ProposedAction = {
      id: '00000000-0000-4000-8000-000000000012',
      ownerId,
      actionType: 'external.message.send',
      payload: { destinationReference: 'future-channel' },
      riskClass: 'HIGH_IMPACT',
      idempotencyKey: 'action:abcdef1234567890',
      correlationId,
      state: 'proposed',
      expiresAt: null,
    };
    const handler: DeterministicEventHandler = {
      eventType: event.eventType,
      async handle() {
        return { action, audit: [] };
      },
    };
    const dependencies: Pick<EventPipelineDependencies, 'store' | 'handlers' | 'policy'> = {
      store,
      handlers: new Map([[handler.eventType, handler]]),
      policy: {
        evaluate(proposedAction) {
          return evaluatePolicy(proposedAction, { ownerAuthorized: true });
        },
      },
    };

    store.seedEvent(event);
    const result = await processCanonicalEvent(dependencies, event);

    expect(result).toMatchObject({ processed: true, approvalRequested: true });
    expect(store.approvalRequests).toHaveLength(1);
    expect(store.executedActions).toHaveLength(0);
  });
});
