import { describe, expect, it } from 'vitest';

import type {
  MessagingConnectionState,
  MessagingSendResult,
  OutboundDeliveryIntent,
} from '@jarvis/contracts';
import {
  LocalWhatsAppBridge,
  type BridgeApiPort,
  type LocalEvolutionPort,
  type OpaqueTransportSignal,
  type ReactiveTransportSignalSource,
} from '../src/index.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const connectionId = '00000000-0000-4000-8000-000000000002';
const deliveryId = '00000000-0000-4000-8000-000000000003';
const messageId = '00000000-0000-4000-8000-000000000004';
const conversationId = '00000000-0000-4000-8000-000000000005';
const correlationId = '00000000-0000-4000-8000-000000000006';
const leaseToken = '00000000-0000-4000-8000-000000000007';

const signal: OpaqueTransportSignal = {
  deliveryId,
  sequence: 1,
  createdAt: Date.parse('2026-08-31T12:00:00.000Z'),
  state: 'pending',
};

const intent: OutboundDeliveryIntent = {
  id: deliveryId,
  ownerId,
  messageId,
  conversationId,
  connectionId,
  transport: 'evolution_whatsapp',
  targetReference: `evo:owner-target:${'a'.repeat(64)}`,
  operationKey: 'local-bridge-runtime-delivery-0001',
  contentType: 'text',
  content: 'Canonical Neon delivery content.',
  mediaObjectReference: null,
  sourceEventId: null,
  brainRequestId: null,
  reminderId: null,
  critical: false,
  correlationId,
  causationId: null,
  createdAt: '2026-08-31T12:00:00.000Z',
};

const accepted: MessagingSendResult = {
  disposition: 'accepted',
  providerMessageReference: 'evo:message:provider-test-0001',
  acceptedAt: '2026-08-31T12:00:01.000Z',
  errorCategory: null,
  requiresReconciliation: false,
};

class FakeSignals implements ReactiveTransportSignalSource {
  private handler: ((signals: readonly OpaqueTransportSignal[]) => Promise<void>) | undefined;

  public async subscribe(
    handler: (signals: readonly OpaqueTransportSignal[]) => Promise<void>,
  ): Promise<() => Promise<void>> {
    this.handler = handler;
    return async () => {
      this.handler = undefined;
    };
  }

  public async emit(signals: readonly OpaqueTransportSignal[]): Promise<void> {
    if (!this.handler) throw new Error('bridge subscription has not started');
    await this.handler(signals);
  }
}

class FakeEvolution implements LocalEvolutionPort {
  public state: 'connected' | 'disconnected' | 'degraded' | 'unconfigured' = 'connected';
  public sent: OutboundDeliveryIntent[] = [];
  public result: MessagingSendResult = accepted;
  public throws = false;

  public async getConnectionState(): Promise<
    'connected' | 'disconnected' | 'degraded' | 'unconfigured'
  > {
    return this.state;
  }

  public async send(value: OutboundDeliveryIntent): Promise<MessagingSendResult> {
    this.sent.push(value);
    if (this.throws) throw new Error('Evolution transport not reachable');
    return this.result;
  }
}

class FakeApi implements BridgeApiPort {
  public delivery:
    | {
        readonly status: 'ready';
        readonly intent: OutboundDeliveryIntent;
        readonly leaseToken: string;
        readonly leaseExpiresAt: string;
      }
    | { readonly status: 'expired' | 'already_handled' | 'unavailable' } = {
    status: 'ready',
    intent,
    leaseToken,
    leaseExpiresAt: '2026-08-31T12:02:00.000Z',
  };
  public result: {
    readonly disposition: 'completed' | 'terminal' | 'retry_scheduled' | 'reconciliation_required';
  } = {
    disposition: 'completed',
  };
  public fetches: Array<{ readonly deliveryId: string; readonly bridgeId: string }> = [];
  public reports: Array<{
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly leaseToken: string;
    readonly result: MessagingSendResult;
  }> = [];
  public acknowledgements: Array<{ readonly deliveryId: string; readonly sequence: number }> = [];
  public heartbeats: Array<{
    readonly bridgeId: string;
    readonly state: MessagingConnectionState;
    readonly safeErrorCategory: string | null;
  }> = [];

  public async forwardInbound(): Promise<void> {
    return undefined;
  }

  public async fetchPendingDelivery(input: {
    readonly deliveryId: string;
    readonly bridgeId: string;
  }): Promise<
    | {
        readonly status: 'ready';
        readonly intent: OutboundDeliveryIntent;
        readonly leaseToken: string;
        readonly leaseExpiresAt: string;
      }
    | { readonly status: 'expired' | 'already_handled' | 'unavailable' }
  > {
    this.fetches.push(input);
    return this.delivery;
  }

  public async reportDeliveryResult(input: {
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly leaseToken: string;
    readonly result: MessagingSendResult;
  }): Promise<{
    readonly disposition:
      | 'completed'
      | 'terminal'
      | 'already_handled'
      | 'lease_expired'
      | 'unavailable'
      | 'retry_scheduled'
      | 'reconciliation_required';
    readonly retryAt?: string;
  }> {
    this.reports.push(input);
    return this.result;
  }

  public async acknowledgeSignal(input: {
    readonly deliveryId: string;
    readonly sequence: number;
  }): Promise<void> {
    this.acknowledgements.push(input);
  }

  public async heartbeat(input: {
    readonly bridgeId: string;
    readonly state: MessagingConnectionState;
    readonly safeErrorCategory: string | null;
  }): Promise<void> {
    this.heartbeats.push(input);
  }
}

async function startHarness() {
  const signals = new FakeSignals();
  const api = new FakeApi();
  const evolution = new FakeEvolution();
  const bridge = new LocalWhatsAppBridge(signals, api, evolution, {
    bridgeId: 'jarvis-test-bridge',
  });
  await bridge.start();
  return { signals, api, evolution, bridge };
}

describe('offline-first local WhatsApp bridge', () => {
  it('keeps an opaque signal pending while Evolution is offline and delivers it only after reconnect', async () => {
    const harness = await startHarness();
    harness.evolution.state = 'disconnected';
    await harness.bridge.refreshConnection();
    await harness.signals.emit([signal]);

    expect(harness.api.fetches).toHaveLength(0);
    expect(harness.evolution.sent).toHaveLength(0);
    expect(harness.api.acknowledgements).toHaveLength(0);

    harness.evolution.state = 'connected';
    await harness.bridge.refreshConnection();

    expect(harness.api.fetches).toHaveLength(1);
    expect(harness.evolution.sent).toHaveLength(1);
    expect(harness.api.reports).toHaveLength(1);
    expect(harness.api.acknowledgements).toEqual([{ deliveryId, sequence: 1 }]);
    expect(harness.api.heartbeats.at(-1)).toMatchObject({ state: 'connected' });
    await harness.bridge.stop();
  });

  it('does not send twice when Convex replays a duplicate opaque transport signal', async () => {
    const harness = await startHarness();
    await harness.signals.emit([signal]);
    harness.api.delivery = { status: 'already_handled' };
    await harness.signals.emit([signal]);

    expect(harness.evolution.sent).toHaveLength(1);
    expect(harness.api.fetches).toHaveLength(2);
    expect(harness.api.acknowledgements).toEqual([
      { deliveryId, sequence: 1 },
      { deliveryId, sequence: 1 },
    ]);
    await harness.bridge.stop();
  });

  it('acknowledges an expired outbound delivery without calling Evolution', async () => {
    const harness = await startHarness();
    harness.api.delivery = { status: 'expired' };
    await harness.signals.emit([signal]);

    expect(harness.evolution.sent).toHaveLength(0);
    expect(harness.api.reports).toHaveLength(0);
    expect(harness.api.acknowledgements).toEqual([{ deliveryId, sequence: 1 }]);
    await harness.bridge.stop();
  });

  it('records an uncertain Evolution exception as reconciliation-required instead of retrying a possible send', async () => {
    const harness = await startHarness();
    harness.evolution.throws = true;
    harness.api.result = { disposition: 'reconciliation_required' };
    await harness.signals.emit([signal]);

    expect(harness.evolution.sent).toHaveLength(1);
    expect(harness.api.reports[0]?.result).toMatchObject({
      disposition: 'retryable_failure',
      errorCategory: 'local_evolution_unavailable',
      requiresReconciliation: true,
    });
    expect(harness.api.acknowledgements).toEqual([{ deliveryId, sequence: 1 }]);
    await harness.bridge.stop();
  });

  it.each([
    ['accepted Evolution send', accepted, 'completed'],
    [
      'retryable Evolution send result',
      {
        disposition: 'retryable_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: 'evolution_retryable',
        requiresReconciliation: false,
      },
      'retry_scheduled',
    ],
    [
      'terminal Evolution send result',
      {
        disposition: 'terminal_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: 'evolution_terminal',
        requiresReconciliation: false,
      },
      'terminal',
    ],
  ] as const)('reports and acknowledges a %s', async (_label, sendResult, resultDisposition) => {
    const harness = await startHarness();
    harness.evolution.result = sendResult;
    harness.api.result = { disposition: resultDisposition };
    await harness.signals.emit([signal]);

    expect(harness.api.reports[0]?.result).toEqual(sendResult);
    expect(harness.api.acknowledgements).toEqual([{ deliveryId, sequence: 1 }]);
    await harness.bridge.stop();
  });
});
