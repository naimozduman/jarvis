import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import type { OutboundDeliveryIntent } from '@jarvis/contracts';
import type { LocalBridgeDeliveryRepository } from '@jarvis/database';
import type { EventPipelineDependencies } from '@jarvis/domain';
import type { OrchestrationPublisher } from '@jarvis/orchestration';

const ownerId = '00000000-0000-4000-8000-000000000001';
const connectionId = '00000000-0000-4000-8000-000000000002';
const deliveryId = '00000000-0000-4000-8000-000000000003';
const messageId = '00000000-0000-4000-8000-000000000004';
const conversationId = '00000000-0000-4000-8000-000000000005';
const correlationId = '00000000-0000-4000-8000-000000000006';
const leaseToken = '00000000-0000-4000-8000-000000000007';
const bridgeToken = 'local-bridge-api-test-token-that-is-not-a-deployment-secret';
const bridgeId = 'jarvis-test-bridge';
const now = new Date('2026-08-31T12:00:00.000Z');

const intent: OutboundDeliveryIntent = {
  id: deliveryId,
  ownerId,
  messageId,
  conversationId,
  connectionId,
  transport: 'evolution_whatsapp',
  targetReference: `evo:owner-target:${'a'.repeat(64)}`,
  operationKey: 'local-bridge-route-delivery-0001',
  contentType: 'text',
  content: 'Private delivery text loaded only from canonical Neon.',
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
  readonly deliveries?: Partial<LocalBridgeDeliveryRepository>;
  readonly scheduleTransportSignal?: (input: {
    readonly deliveryId: string;
    readonly scheduledAt: string;
  }) => Promise<void>;
}) {
  const acquire = vi.fn<
    LocalBridgeDeliveryRepository['acquireOutboundDeliveryLeaseForLocalBridge']
  >(async () => ({
    status: 'ready',
    intent,
    leaseToken,
    leaseExpiresAt: '2026-08-31T12:02:00.000Z',
  }));
  const result = vi.fn<LocalBridgeDeliveryRepository['recordLocalBridgeDeliveryResult']>(
    async () => ({
      disposition: 'completed',
    }),
  );
  const recover = vi.fn<LocalBridgeDeliveryRepository['recoverExpiredLocalBridgeLease']>(
    async () => false,
  );
  const deliveries: LocalBridgeDeliveryRepository = {
    acquireOutboundDeliveryLeaseForLocalBridge:
      input.deliveries?.acquireOutboundDeliveryLeaseForLocalBridge ?? acquire,
    recordLocalBridgeDeliveryResult: input.deliveries?.recordLocalBridgeDeliveryResult ?? result,
    recoverExpiredLocalBridgeLease: input.deliveries?.recoverExpiredLocalBridgeLease ?? recover,
  };
  const acknowledgeTransportSignal = vi.fn<OrchestrationPublisher['acknowledgeTransportSignal']>(
    async () => undefined,
  );
  const scheduleJob = vi.fn<OrchestrationPublisher['scheduleJob']>(async () => undefined);
  const scheduleTransportSignal = vi.fn<OrchestrationPublisher['scheduleTransportSignal']>(
    input.scheduleTransportSignal ?? (async () => undefined),
  );
  const orchestration: Pick<
    OrchestrationPublisher,
    'acknowledgeTransportSignal' | 'scheduleJob' | 'scheduleTransportSignal'
  > = { acknowledgeTransportSignal, scheduleJob, scheduleTransportSignal };
  const recordConnectionState = vi.fn(async () => undefined);
  const app = buildApi({
    environment: { APP_ENV: 'test' },
    localBridge: {
      accessToken: bridgeToken,
      ownerId,
      connectionId,
      deliveries,
      connections: { recordConnectionState },
      pipeline: {} as EventPipelineDependencies,
      orchestration,
      now: () => now,
    },
  });
  return {
    app,
    acquire,
    result,
    acknowledgeTransportSignal,
    scheduleTransportSignal,
    recordConnectionState,
  };
}

describe('authenticated local WhatsApp bridge API boundary', () => {
  let app: ReturnType<typeof buildApi> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('requires the bridge credential before returning a canonical delivery payload', async () => {
    const harness = bridgeApp({});
    app = harness.app;
    const response = await app.inject({
      method: 'POST',
      url: `/internal/local-bridge/deliveries/${deliveryId}/lease`,
      payload: { bridgeId },
    });

    expect(response.statusCode).toBe(401);
    expect(harness.acquire).not.toHaveBeenCalled();
  });

  it('loads private content only after an authenticated canonical lease and never puts it in an orchestration signal', async () => {
    const harness = bridgeApp({});
    app = harness.app;
    const response = await app.inject({
      method: 'POST',
      url: `/internal/local-bridge/deliveries/${deliveryId}/lease`,
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: { bridgeId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      leaseToken,
      intent: { id: deliveryId, content: intent.content },
    });
    expect(harness.acquire).toHaveBeenCalledWith({ ownerId, deliveryId, bridgeId, now });
    expect(harness.scheduleTransportSignal).not.toHaveBeenCalled();
  });

  it('makes a retryable result callback idempotently repair an opaque Convex retry signal', async () => {
    const retryAt = '2026-08-31T12:00:05.000Z';
    const result = vi.fn<LocalBridgeDeliveryRepository['recordLocalBridgeDeliveryResult']>(
      async () => ({
        disposition: 'retry_scheduled',
        retryAt,
      }),
    );
    const harness = bridgeApp({ deliveries: { recordLocalBridgeDeliveryResult: result } });
    app = harness.app;
    const request = () =>
      app!.inject({
        method: 'POST',
        url: `/internal/local-bridge/deliveries/${deliveryId}/result`,
        headers: { authorization: `Bearer ${bridgeToken}` },
        payload: {
          bridgeId,
          leaseToken,
          result: {
            disposition: 'retryable_failure',
            providerMessageReference: null,
            acceptedAt: null,
            errorCategory: 'evolution_temporarily_unavailable',
            requiresReconciliation: false,
          },
        },
      });

    const first = await request();
    const replay = await request();

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ disposition: 'retry_scheduled', retryAt });
    expect(replay.statusCode).toBe(200);
    expect(harness.scheduleTransportSignal).toHaveBeenCalledTimes(2);
    expect(harness.scheduleTransportSignal).toHaveBeenCalledWith({
      deliveryId,
      scheduledAt: retryAt,
    });
  });

  it('returns a safe unavailable response when canonical Neon cannot acquire a lease', async () => {
    const acquire = vi.fn<
      LocalBridgeDeliveryRepository['acquireOutboundDeliveryLeaseForLocalBridge']
    >(async () => {
      throw new Error('database connection failure');
    });
    const harness = bridgeApp({
      deliveries: { acquireOutboundDeliveryLeaseForLocalBridge: acquire },
    });
    app = harness.app;
    const response = await app.inject({
      method: 'POST',
      url: `/internal/local-bridge/deliveries/${deliveryId}/lease`,
      headers: { authorization: `Bearer ${bridgeToken}` },
      payload: { bridgeId },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'canonical_delivery_unavailable' });
    expect(response.payload).not.toContain(intent.content!);
  });
});
