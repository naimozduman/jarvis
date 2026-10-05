import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import type { OutboundDeliveryIntent } from '@jarvis/contracts';
import type { WhatsAppCloudBridgeDeliveryRepository } from '@jarvis/database';
import type { OrchestrationPublisher } from '@jarvis/orchestration';

const ownerId = '00000000-0000-4000-8000-000000000001';
const connectionId = '00000000-0000-4000-8000-000000000002';
const deliveryId = '00000000-0000-4000-8000-000000000003';
const messageId = '00000000-0000-4000-8000-000000000004';
const conversationId = '00000000-0000-4000-8000-000000000005';
const correlationId = '00000000-0000-4000-8000-000000000006';
const leaseToken = '00000000-0000-4000-8000-000000000007';
const bridgeToken = 'official-cloud-bridge-test-token-not-a-deployment-secret';
const bridgeId = 'jarvis-cloud-bridge';
const now = new Date('2026-09-29T12:00:00.000Z');

const intent: OutboundDeliveryIntent = {
  id: deliveryId,
  ownerId,
  messageId,
  conversationId,
  connectionId,
  transport: 'whatsapp_cloud',
  targetReference: 'wa-cloud:bridge-conversation:00000000-0000-4000-8000-000000000008',
  operationKey: 'cloud-bridge-route-delivery-0001',
  contentType: 'text',
  content: 'A persisted canonical JARVIS reply.',
  mediaObjectReference: null,
  sourceEventId: null,
  brainRequestId: null,
  reminderId: null,
  critical: false,
  correlationId,
  causationId: null,
  createdAt: now.toISOString(),
};

function bridgeApp(input: {
  readonly deliveries?: Partial<WhatsAppCloudBridgeDeliveryRepository>;
  readonly scheduleTransportSignal?: (input: {
    readonly deliveryId: string;
    readonly scheduledAt: string;
  }) => Promise<void>;
}) {
  const acquire = vi.fn<
    WhatsAppCloudBridgeDeliveryRepository['acquireOutboundDeliveryLeaseForWhatsAppCloudBridge']
  >(async () => ({
    status: 'ready',
    intent,
    leaseToken,
    leaseExpiresAt: '2026-09-29T12:02:00.000Z',
  }));
  const result = vi.fn<
    WhatsAppCloudBridgeDeliveryRepository['recordWhatsAppCloudBridgeDeliveryResult']
  >(async () => ({ disposition: 'completed' }));
  const recover = vi.fn<
    WhatsAppCloudBridgeDeliveryRepository['recoverExpiredWhatsAppCloudBridgeLease']
  >(async () => false);
  const deliveries: WhatsAppCloudBridgeDeliveryRepository = {
    acquireOutboundDeliveryLeaseForWhatsAppCloudBridge:
      input.deliveries?.acquireOutboundDeliveryLeaseForWhatsAppCloudBridge ?? acquire,
    recordWhatsAppCloudBridgeDeliveryResult:
      input.deliveries?.recordWhatsAppCloudBridgeDeliveryResult ?? result,
    recoverExpiredWhatsAppCloudBridgeLease:
      input.deliveries?.recoverExpiredWhatsAppCloudBridgeLease ?? recover,
  };
  const scheduleTransportSignal = vi.fn<OrchestrationPublisher['scheduleTransportSignal']>(
    input.scheduleTransportSignal ?? (async () => undefined),
  );
  const app = buildApi({
    environment: { APP_ENV: 'test' },
    whatsappCloudBridge: {
      accessToken: bridgeToken,
      ownerId,
      connectionId,
      bridgeId,
      deliveries,
      orchestration: { scheduleTransportSignal },
      now: () => now,
    },
  });
  return { app, acquire, result, scheduleTransportSignal };
}

describe('authenticated official Cloud bridge delivery boundary', () => {
  let app: ReturnType<typeof buildApi> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('requires its credential and configured bridge identity before releasing a persisted reply', async () => {
    const harness = bridgeApp({});
    app = harness.app;
    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/internal/whatsapp-cloud-bridge/deliveries/${deliveryId}/lease`,
      payload: { bridgeId },
    });
    const wrongBridge = await app.inject({
      method: 'POST',
      url: `/internal/whatsapp-cloud-bridge/deliveries/${deliveryId}/lease`,
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: { bridgeId: 'another-cloud-bridge' },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(wrongBridge.statusCode).toBe(403);
    expect(harness.acquire).not.toHaveBeenCalled();
  });

  it('releases text only after an authenticated official-Cloud lease', async () => {
    const harness = bridgeApp({});
    app = harness.app;
    const response = await app.inject({
      method: 'POST',
      url: `/internal/whatsapp-cloud-bridge/deliveries/${deliveryId}/lease`,
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: { bridgeId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      leaseToken,
      intent: { transport: 'whatsapp_cloud', content: intent.content },
    });
    expect(harness.acquire).toHaveBeenCalledWith({ ownerId, deliveryId, bridgeId, now });
  });

  it('repairs a retry signal after the bridge reports a known retryable failure', async () => {
    const retryAt = '2026-09-29T12:00:05.000Z';
    const result = vi.fn<
      WhatsAppCloudBridgeDeliveryRepository['recordWhatsAppCloudBridgeDeliveryResult']
    >(async () => ({ disposition: 'retry_scheduled', retryAt }));
    const harness = bridgeApp({
      deliveries: { recordWhatsAppCloudBridgeDeliveryResult: result },
    });
    app = harness.app;
    const response = await app.inject({
      method: 'POST',
      url: `/internal/whatsapp-cloud-bridge/deliveries/${deliveryId}/result`,
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: {
        bridgeId,
        leaseToken,
        result: {
          disposition: 'retryable_failure',
          providerMessageReference: null,
          acceptedAt: null,
          errorCategory: 'cloud_api_temporarily_unavailable',
          requiresReconciliation: false,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ disposition: 'retry_scheduled', retryAt });
    expect(harness.scheduleTransportSignal).toHaveBeenCalledWith({
      deliveryId,
      scheduledAt: retryAt,
    });
  });
});
