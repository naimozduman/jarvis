import { describe, expect, it, vi } from 'vitest';

import type { ConversationTurnService } from '@jarvis/brain';
import { loadApiEnvironment } from '@jarvis/config';
import type { CanonicalEvent, OutboundDeliveryIntent } from '@jarvis/contracts';
import type {
  CanonicalTransportConnectionPolicyRepository,
  PersistedWhatsAppCloudInboundMessage,
} from '@jarvis/database';
import type { CanonicalDurableDeliveryOutbox } from '@jarvis/orchestration';
import { CanonicalWhatsAppCloudOwnerConversationProcessor } from '@jarvis/orchestration';

const ownerId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const messageId = '00000000-0000-4000-8000-000000000003';
const conversationId = '00000000-0000-4000-8000-000000000004';
const connectionId = '00000000-0000-4000-8000-000000000005';
const responseMessageId = '00000000-0000-4000-8000-000000000006';
const requestId = '00000000-0000-4000-8000-000000000007';
const deliveryId = '00000000-0000-4000-8000-000000000008';
const targetReference = 'wa-cloud:bridge-conversation:00000000-0000-4000-8000-000000000009';

const persisted: PersistedWhatsAppCloudInboundMessage = {
  id: messageId,
  conversationId,
  duplicate: false,
};

function event(ownerVerified = true): CanonicalEvent {
  return {
    id: eventId,
    ownerId,
    eventType: 'whatsapp.cloud.message.observed.v1',
    source: 'whatsapp',
    sourceEventId: eventId,
    idempotencyKey: 'whatsapp-cloud-owner-conversation-test-0001',
    occurredAt: '2026-09-29T18:00:00.000Z',
    receivedAt: '2026-09-29T18:00:01.000Z',
    schemaVersion: 1,
    processingStatus: 'processing',
    correlationId: '00000000-0000-4000-8000-000000000010',
    payload: {
      kind: 'whatsapp_cloud_message_observed',
      transport: 'cloud_api',
      conversationType: 'direct',
      category: 'uncategorized',
      conversationReference: `wa-cloud:conversation:${'a'.repeat(64)}`,
      providerMessageReference: `wa-cloud:message:${'b'.repeat(64)}`,
      participantReference: `wa-cloud:participant:${'c'.repeat(64)}`,
      ownerVerified,
      deliveryTargetReference: targetReference,
      messageType: 'text',
      text: 'What do I have today?',
      media: [],
    },
  };
}

function harness() {
  const brainProcess = vi.fn<ConversationTurnService['process']>(async () => ({
    requestId,
    status: 'completed',
    decisionId: '00000000-0000-4000-8000-000000000011',
    conversationResponse: {
      message: 'Here is your day.',
      nextAction: null,
      tone: 'direct',
    },
    responseMessageId,
    actionIds: [],
    approvalRequested: false,
    safeError: null,
  }));
  const persistAndEnqueue = vi.fn<CanonicalDurableDeliveryOutbox['persistAndEnqueue']>(
    async () => ({
      deliveryId,
      duplicate: false,
    }),
  );
  const loadCanonicalTransportConnectionPolicy = vi.fn<
    CanonicalTransportConnectionPolicyRepository['loadCanonicalTransportConnectionPolicy']
  >(async () => ({ versionVerified: true, outboundEnabled: true, state: 'connected' }));
  const processor = new CanonicalWhatsAppCloudOwnerConversationProcessor({
    environment: loadApiEnvironment({ APP_ENV: 'test' }),
    brain: { process: brainProcess } as unknown as ConversationTurnService,
    deliveryOutbox: { persistAndEnqueue } as CanonicalDurableDeliveryOutbox,
    connectionPolicies: {
      loadCanonicalTransportConnectionPolicy,
    } as CanonicalTransportConnectionPolicyRepository,
    connectionId,
    now: () => new Date('2026-09-29T18:00:03.000Z'),
  });
  return { processor, brainProcess, persistAndEnqueue, loadCanonicalTransportConnectionPolicy };
}

describe('verified official Cloud owner conversations', () => {
  it('uses the normal canonical Brain turn after inbound persistence, then enqueues its persisted reply', async () => {
    const { processor, brainProcess, persistAndEnqueue, loadCanonicalTransportConnectionPolicy } =
      harness();

    const result = await processor.process({ event: event(), message: persisted });

    expect(result).toEqual({
      disposition: 'brain_enqueued_delivery',
      outboundDeliveryId: deliveryId,
    });
    expect(brainProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId,
        conversationId,
        messageId,
        message: 'What do I have today?',
        inboundAlreadyPersisted: true,
        channel: 'whatsapp',
      }),
    );
    expect(persistAndEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId,
        messageId: responseMessageId,
        conversationId,
        connectionId,
        transport: 'whatsapp_cloud',
        targetReference,
        content: 'Here is your day.',
      } satisfies Partial<OutboundDeliveryIntent>),
    );
    expect(loadCanonicalTransportConnectionPolicy).toHaveBeenCalledWith({ ownerId, connectionId });
  });

  it('never authorizes a turn or reply based on a display name or an unlinked participant', async () => {
    const { processor, brainProcess, persistAndEnqueue } = harness();

    const result = await processor.process({ event: event(false), message: persisted });

    expect(result).toEqual({ disposition: 'owner_not_enrolled', outboundDeliveryId: null });
    expect(brainProcess).not.toHaveBeenCalled();
    expect(persistAndEnqueue).not.toHaveBeenCalled();
  });

  it('does not invent a reply when the canonical Brain is explicitly not configured', async () => {
    const { processor, brainProcess, persistAndEnqueue } = harness();
    brainProcess.mockResolvedValueOnce({
      requestId,
      status: 'not_configured',
      decisionId: null,
      conversationResponse: null,
      responseMessageId: null,
      actionIds: [],
      approvalRequested: false,
      safeError: 'The configured model gateway is unavailable.',
    });

    const result = await processor.process({ event: event(), message: persisted });

    expect(result).toEqual({ disposition: 'brain_not_ready', outboundDeliveryId: null });
    expect(persistAndEnqueue).not.toHaveBeenCalled();
  });
});
