import { describe, expect, it, vi } from 'vitest';

import type { ConversationTurnService } from '@jarvis/brain';
import { loadApiEnvironment } from '@jarvis/config';
import type { CanonicalEvent, DurableJob } from '@jarvis/contracts';
import type {
  DrizzleCanonicalEventRepository,
  DrizzleRuntimeConversationRepository,
  WhatsAppCloudIngressRepository,
} from '@jarvis/database';
import type { EventPipelineDependencies } from '@jarvis/domain';
import {
  CanonicalEventJobHandler,
  CanonicalWhatsAppCloudIngestProcessor,
} from '@jarvis/orchestration';

const ownerId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const correlationId = '00000000-0000-4000-8000-000000000003';

function event(): CanonicalEvent {
  return {
    id: eventId,
    ownerId,
    eventType: 'whatsapp.cloud.message.observed.v1',
    source: 'whatsapp',
    sourceEventId: correlationId,
    idempotencyKey: 'whatsapp-cloud-bridge:00000000-0000-4000-8000-000000000003',
    occurredAt: '2026-09-29T18:00:00.000Z',
    receivedAt: '2026-09-29T18:00:01.000Z',
    schemaVersion: 1,
    processingStatus: 'queued',
    correlationId,
    payload: {
      kind: 'whatsapp_cloud_message_observed',
      transport: 'cloud_api',
      conversationType: 'direct',
      category: 'uncategorized',
      conversationReference: `wa-cloud:conversation:${'a'.repeat(64)}`,
      providerMessageReference: `wa-cloud:message:${'b'.repeat(64)}`,
      participantReference: `wa-cloud:participant:${'c'.repeat(64)}`,
      ownerVerified: false,
      deliveryTargetReference: null,
      messageType: 'text',
      text: 'Synthetic only.',
      media: [],
    },
  };
}

function job(): DurableJob {
  return {
    id: '00000000-0000-4000-8000-000000000004',
    ownerId,
    jobType: 'jarvis.event.process',
    payload: { eventId, ownerId },
    status: 'leased',
    priority: 0,
    scheduledFor: '2026-09-29T18:00:01.000Z',
    availableAfter: '2026-09-29T18:00:01.000Z',
    executionDeadline: null,
    dispatchGeneration: 1,
    attemptCount: 1,
    maximumAttempts: 5,
    leaseOwner: 'test',
    leaseExpiresAt: '2026-09-29T18:01:01.000Z',
    lastErrorCategory: null,
    lastErrorSummary: null,
    createdAt: '2026-09-29T18:00:01.000Z',
    updatedAt: '2026-09-29T18:00:01.000Z',
    completedAt: null,
    correlationId,
    idempotencyKey: 'whatsapp-cloud-processor-test-0001',
  };
}

function outboundCloudJob(): DurableJob {
  return {
    ...job(),
    id: '00000000-0000-4000-8000-000000000009',
    jobType: 'jarvis.transport.outbound.send',
    payload: { transport: 'whatsapp_cloud' },
    idempotencyKey: 'whatsapp-cloud-outbound-signal-test-0001',
  };
}

describe('official WhatsApp Cloud canonical processor', () => {
  it('persists only the route-filtered message projection', async () => {
    const persistInboundMessage = vi.fn<WhatsAppCloudIngressRepository['persistInboundMessage']>(
      async () => ({
        id: '00000000-0000-4000-8000-000000000005',
        conversationId: '00000000-0000-4000-8000-000000000006',
        duplicate: false,
      }),
    );
    const processor = new CanonicalWhatsAppCloudIngestProcessor({ persistInboundMessage });

    await processor.process(event());

    expect(persistInboundMessage).toHaveBeenCalledWith({
      ownerId,
      sourceEventId: correlationId,
      correlationId,
      occurredAt: '2026-09-29T18:00:00.000Z',
      receivedAt: '2026-09-29T18:00:01.000Z',
      message: event().payload,
    });
  });

  it('runs Cloud events through the dedicated recorder, never the legacy transport processor', async () => {
    const source = event();
    const load = vi.fn(async () => source);
    const markProcessing = vi.fn(async () => undefined);
    const markProcessed = vi.fn(async () => undefined);
    const legacyTransportProcess = vi.fn(async () => ({ outboundDeliveryId: null }));
    const cloudProcess = vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000005',
      conversationId: '00000000-0000-4000-8000-000000000006',
      duplicate: false,
    }));
    const handler = new CanonicalEventJobHandler({
      environment: loadApiEnvironment({ APP_ENV: 'test' }),
      pipeline: {} as EventPipelineDependencies,
      events: {
        load,
        markProcessing,
        markProcessed,
        markIgnored: vi.fn(async () => undefined),
        markFailed: vi.fn(async () => undefined),
      } as unknown as DrizzleCanonicalEventRepository,
      conversations: {} as DrizzleRuntimeConversationRepository,
      brain: {} as ConversationTurnService,
      whatsappCloudIngestProcessor: {
        process: cloudProcess,
      } as unknown as CanonicalWhatsAppCloudIngestProcessor,
      transportProcessor: {
        process: legacyTransportProcess,
      },
    });

    await handler.execute(job());

    expect(cloudProcess).toHaveBeenCalledWith(source);
    expect(legacyTransportProcess).not.toHaveBeenCalled();
    expect(markProcessing).toHaveBeenCalledOnce();
    expect(markProcessed).toHaveBeenCalledOnce();
  });

  it('signals the official Cloud bridge directly with an opaque delivery ID, not through a local bridge signal', async () => {
    const publishTransportSignal = vi.fn(async () => undefined);
    const publishWhatsAppCloudBridgeSignal = vi.fn(async () => undefined);
    const handler = new CanonicalEventJobHandler({
      environment: loadApiEnvironment({ APP_ENV: 'test' }),
      pipeline: {} as EventPipelineDependencies,
      events: {} as DrizzleCanonicalEventRepository,
      conversations: {} as DrizzleRuntimeConversationRepository,
      brain: {} as ConversationTurnService,
      publishTransportSignal,
      publishWhatsAppCloudBridgeSignal,
    });

    await handler.execute(outboundCloudJob());

    expect(publishWhatsAppCloudBridgeSignal).toHaveBeenCalledWith({
      deliveryId: '00000000-0000-4000-8000-000000000009',
      createdAt: expect.any(String),
    });
    expect(publishTransportSignal).not.toHaveBeenCalled();
  });
});
