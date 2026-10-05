import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import type { DurableJob, DurableJobInput } from '@jarvis/contracts';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';
import {
  createCanonicalEventProcessingJob,
  createCanonicalPolicyEvaluator,
} from '@jarvis/orchestration';
import type { OrchestrationPublisher } from '@jarvis/orchestration';
import { InMemoryEventStore } from '@jarvis/testing';

const ownerId = '00000000-0000-4000-8000-000000000001';
const bridgeToken = 'whatsapp-cloud-ingest-test-token-not-a-deployment-secret';
const now = new Date('2026-09-29T18:00:00.000Z');

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

function bridgeEvent() {
  return {
    schema_version: '1.0',
    event_id: '00000000-0000-4000-8000-000000000101',
    event_type: 'message.observed',
    occurred_at: '2026-09-29T17:59:00.000Z',
    source: {
      provider: 'whatsapp',
      transport: 'cloud_api',
      message_id: 'synthetic-provider-message-reference-private-001',
      conversation_id: 'synthetic-provider-conversation-reference-private-001',
      conversation_type: 'direct',
      raw_record_id: 'synthetic-raw-evidence-reference-private-001',
    },
    actor: {
      external_id: 'synthetic-provider-participant-reference-private-001',
      jarvis_person_id: 'bridge-mapping-not-a-canonical-owner',
      display_name: 'Synthetic display name that must not persist',
    },
    scope: { owner_jarvis_id: 'naim', category: 'uncategorized' },
    content: { message_type: 'text', text: 'Synthetic Cloud API intake message only.' },
    metadata: {
      phone_number_id: 'synthetic-phone-metadata-private-001',
      display_phone_number: '+15555550100',
    },
  };
}

function createHarness() {
  const store = new InMemoryEventStore();
  const scheduleJob = vi.fn<OrchestrationPublisher['scheduleJob']>(async () => undefined);
  const pipeline: EventPipelineDependencies = {
    store,
    handlers: createDeterministicPhaseOneHandlers(),
    policy: createCanonicalPolicyEvaluator(),
    createJob: createCanonicalEventProcessingJob,
  };
  const app = buildApi({
    environment: { APP_ENV: 'test' },
    whatsappCloudIngest: {
      accessToken: bridgeToken,
      ownerId,
      expectedInstanceId: 'naim',
      pipeline,
      orchestration: { scheduleJob },
      async loadCanonicalJobForEvent(eventId) {
        const job = store.jobs.find((candidate) => candidate.payload.eventId === eventId);
        return job ? durable(job) : undefined;
      },
      now: () => now,
    },
  });
  return { app, scheduleJob, store };
}

describe('official WhatsApp Cloud bridge ingress', () => {
  let app: ReturnType<typeof buildApi> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('requires its bridge credential and rejects groups or another bridge instance', async () => {
    const harness = createHarness();
    app = harness.app;
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/internal/ingest',
      payload: bridgeEvent(),
    });
    const group = await app.inject({
      method: 'POST',
      url: '/internal/ingest',
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: {
        ...bridgeEvent(),
        source: { ...bridgeEvent().source, conversation_type: 'group' },
      },
    });
    const wrongInstance = await app.inject({
      method: 'POST',
      url: '/internal/ingest',
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: {
        ...bridgeEvent(),
        scope: { owner_jarvis_id: 'other-bridge', category: 'uncategorized' },
      },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(group.statusCode).toBe(400);
    expect(wrongInstance.statusCode).toBe(403);
    expect(harness.store.events).toHaveLength(0);
    expect(harness.store.jobs).toHaveLength(0);
    expect(harness.scheduleJob).not.toHaveBeenCalled();
  });

  it('persists one privacy-filtered canonical event and repairs its opaque signal on replay', async () => {
    const harness = createHarness();
    app = harness.app;
    const request = () =>
      app!.inject({
        method: 'POST',
        url: '/internal/ingest',
        headers: { authorization: `Bearer ${bridgeToken}` },
        payload: bridgeEvent(),
      });

    const accepted = await request();
    const replay = await request();

    expect(accepted.statusCode).toBe(202);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ accepted: true, duplicate: true });
    expect(harness.store.events).toHaveLength(1);
    expect(harness.store.jobs).toHaveLength(1);
    expect(harness.scheduleJob).toHaveBeenCalledTimes(2);

    const [event] = harness.store.events;
    expect(event).toMatchObject({
      ownerId,
      eventType: 'whatsapp.cloud.message.observed.v1',
      source: 'whatsapp',
      sourceEventId: '00000000-0000-4000-8000-000000000101',
      correlationId: '00000000-0000-4000-8000-000000000101',
      payload: {
        kind: 'whatsapp_cloud_message_observed',
        transport: 'cloud_api',
        conversationType: 'direct',
        ownerVerified: false,
        deliveryTargetReference: null,
        text: 'Synthetic Cloud API intake message only.',
      },
    });
    const persisted = JSON.stringify(event?.payload);
    for (const forbidden of [
      'synthetic-provider-message-reference-private-001',
      'synthetic-provider-conversation-reference-private-001',
      'synthetic-provider-participant-reference-private-001',
      'synthetic-raw-evidence-reference-private-001',
      'Synthetic display name that must not persist',
      'synthetic-phone-metadata-private-001',
      '+15555550100',
      'bridge-mapping-not-a-canonical-owner',
    ]) {
      expect(persisted).not.toContain(forbidden);
    }
  });
});
