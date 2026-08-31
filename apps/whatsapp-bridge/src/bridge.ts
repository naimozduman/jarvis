import type {
  IncomingEventEnvelope,
  MessagingConnectionState,
  MessagingSendResult,
  MessagingTransport,
  OutboundDeliveryIntent,
} from '@jarvis/contracts';

export interface OpaqueTransportSignal {
  readonly deliveryId: string;
  readonly sequence: number;
  readonly createdAt: number;
  readonly state: 'pending';
}

/** Convex subscriptions replay pending opaque signals on reconnect; this port never polls Vercel. */
export interface ReactiveTransportSignalSource {
  subscribe(
    handler: (signals: readonly OpaqueTransportSignal[]) => Promise<void>,
  ): Promise<() => Promise<void>>;
}

export type BridgeDeliveryResultDisposition =
  | 'completed'
  | 'terminal'
  | 'already_handled'
  | 'lease_expired'
  | 'unavailable'
  | 'retry_scheduled'
  | 'reconciliation_required';

export interface BridgeApiPort {
  /** Inbound content travels only from the local bridge to the canonical Vercel/Neon boundary. */
  forwardInbound(event: IncomingEventEnvelope): Promise<void>;
  /** Private content is returned only after Vercel acquired a short Neon lease for this bridge. */
  fetchPendingDelivery(input: { readonly deliveryId: string; readonly bridgeId: string }): Promise<
    | {
        readonly status: 'ready';
        readonly intent: OutboundDeliveryIntent;
        readonly leaseToken: string;
        readonly leaseExpiresAt: string;
      }
    | { readonly status: 'expired' | 'already_handled' | 'unavailable' }
  >;
  reportDeliveryResult(input: {
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly leaseToken: string;
    readonly result: MessagingSendResult;
  }): Promise<{ readonly disposition: BridgeDeliveryResultDisposition; readonly retryAt?: string }>;
  acknowledgeSignal(input: {
    readonly deliveryId: string;
    readonly sequence: number;
  }): Promise<void>;
  heartbeat(input: {
    readonly bridgeId: string;
    readonly state: MessagingConnectionState;
    readonly safeErrorCategory: string | null;
  }): Promise<void>;
}

/** Evolution is implemented behind this local-only port; it never leaks into the cloud API. */
export interface LocalEvolutionPort {
  getConnectionState(): Promise<'connected' | 'disconnected' | 'degraded' | 'unconfigured'>;
  send(intent: OutboundDeliveryIntent): Promise<MessagingSendResult>;
}

export interface InboundNormalizer {
  normalize(input: {
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly body: unknown;
  }): Promise<IncomingEventEnvelope | undefined>;
}

export type LocalBridgeState = 'offline' | 'connecting' | 'connected' | 'degraded' | 'stopped';

export interface LocalWhatsAppBridgeOptions {
  /** Stable local-process identity used as the canonical lease owner; it is not a credential. */
  readonly bridgeId?: string;
}

function safeEvolutionFailure(): MessagingSendResult {
  return {
    disposition: 'retryable_failure',
    providerMessageReference: null,
    acceptedAt: null,
    errorCategory: 'local_evolution_unavailable',
    // A throw can occur after a provider request started. Do not automatically resend it.
    requiresReconciliation: true,
  };
}

function stateForHeartbeat(state: LocalBridgeState): MessagingConnectionState {
  switch (state) {
    case 'connected':
      return 'connected';
    case 'degraded':
      return 'degraded';
    case 'connecting':
      return 'connecting';
    case 'offline':
      return 'disconnected';
    case 'stopped':
      return 'disabled';
  }
}

/**
 * Offline-first local bridge controller. A Convex signal conveys no body; only when local
 * Evolution is connected does the bridge request an authoritative, fresh, lease-bound delivery
 * from Vercel/Neon. A duplicate signal cannot cause a second concurrent provider send.
 */
export class LocalWhatsAppBridge {
  private state: LocalBridgeState = 'stopped';
  private unsubscribe: (() => Promise<void>) | undefined;
  private pendingSignals: readonly OpaqueTransportSignal[] = [];
  private readonly inFlightDeliveryIds = new Set<string>();
  private readonly bridgeId: string;

  public constructor(
    private readonly signals: ReactiveTransportSignalSource,
    private readonly api: BridgeApiPort,
    private readonly evolution: LocalEvolutionPort,
    options: LocalWhatsAppBridgeOptions = {},
  ) {
    this.bridgeId = options.bridgeId ?? 'jarvis-local-whatsapp-bridge';
  }

  public getState(): LocalBridgeState {
    return this.state;
  }

  public async start(): Promise<void> {
    if (this.state !== 'stopped') return;
    this.state = 'connecting';
    this.unsubscribe = await this.signals.subscribe(async (signals) => {
      this.pendingSignals = signals;
      await this.handleSignals(signals);
    });
    await this.refreshConnection();
  }

  public async stop(): Promise<void> {
    await this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.pendingSignals = [];
    this.state = 'stopped';
    await this.publishHeartbeat().catch(() => undefined);
  }

  public async refreshConnection(): Promise<void> {
    try {
      const connection = await this.evolution.getConnectionState();
      this.state =
        connection === 'connected'
          ? 'connected'
          : connection === 'degraded'
            ? 'degraded'
            : 'offline';
      await this.publishHeartbeat();
    } catch {
      this.state = 'degraded';
      await this.publishHeartbeat().catch(() => undefined);
    }
    await this.handleSignals(this.pendingSignals);
  }

  public async forwardNormalizedInbound(event: IncomingEventEnvelope): Promise<void> {
    await this.api.forwardInbound(event);
  }

  private async publishHeartbeat(): Promise<void> {
    await this.api.heartbeat({
      bridgeId: this.bridgeId,
      state: stateForHeartbeat(this.state),
      safeErrorCategory: this.state === 'degraded' ? 'local_bridge_degraded' : null,
    });
  }

  private async handleSignals(signals: readonly OpaqueTransportSignal[]): Promise<void> {
    if (this.state !== 'connected') {
      // Convex retains the pending opaque signals and the reactive query replays them after a
      // reconnect. No provider call, acknowledgement, or canonical mutation happens while down.
      return;
    }
    for (const signal of signals) {
      if (!this.inFlightDeliveryIds.has(signal.deliveryId)) {
        await this.handleSignal(signal);
      }
    }
  }

  private async handleSignal(signal: OpaqueTransportSignal): Promise<void> {
    this.inFlightDeliveryIds.add(signal.deliveryId);
    try {
      const delivery = await this.api.fetchPendingDelivery({
        deliveryId: signal.deliveryId,
        bridgeId: this.bridgeId,
      });
      if (delivery.status !== 'ready') {
        if (delivery.status === 'expired' || delivery.status === 'already_handled') {
          await this.api.acknowledgeSignal({
            deliveryId: signal.deliveryId,
            sequence: signal.sequence,
          });
        }
        return;
      }

      let result: MessagingSendResult;
      try {
        result = await this.evolution.send(delivery.intent);
      } catch {
        result = safeEvolutionFailure();
      }
      const outcome = await this.api.reportDeliveryResult({
        deliveryId: signal.deliveryId,
        bridgeId: this.bridgeId,
        leaseToken: delivery.leaseToken,
        result,
      });
      if (outcome.disposition !== 'unavailable') {
        await this.api.acknowledgeSignal({
          deliveryId: signal.deliveryId,
          sequence: signal.sequence,
        });
      }
    } finally {
      this.inFlightDeliveryIds.delete(signal.deliveryId);
    }
  }
}

/**
 * Adapter from the existing local Evolution transport port to bridge delivery intent. The raw
 * configured owner phone remains inside EvolutionMessagingTransport; this adapter receives only
 * Neon-loaded content and opaque references after a Vercel lease.
 */
export class LocalEvolutionMessagingPort implements LocalEvolutionPort {
  public constructor(
    private readonly transport: MessagingTransport,
    private readonly connectionId: string,
  ) {}

  public async getConnectionState(): Promise<
    'connected' | 'disconnected' | 'degraded' | 'unconfigured'
  > {
    const status = await this.transport.getConnectionStatus({ connectionId: this.connectionId });
    if (status.state === 'connected') return 'connected';
    if (status.state === 'unconfigured' || status.readiness === 'not_configured')
      return 'unconfigured';
    return status.state === 'degraded' ? 'degraded' : 'disconnected';
  }

  public async send(intent: OutboundDeliveryIntent): Promise<MessagingSendResult> {
    if (intent.contentType === 'text' && intent.content) {
      return this.transport.sendText({
        deliveryId: intent.id,
        ownerId: intent.ownerId,
        connectionId: intent.connectionId,
        targetReference: intent.targetReference,
        operationKey: intent.operationKey,
        text: intent.content,
        correlationId: intent.correlationId,
        causationId: intent.causationId,
      });
    }
    if (!intent.mediaObjectReference) {
      return {
        disposition: 'terminal_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: 'missing_media_reference',
        requiresReconciliation: false,
      };
    }
    const media = {
      deliveryId: intent.id,
      ownerId: intent.ownerId,
      connectionId: intent.connectionId,
      targetReference: intent.targetReference,
      operationKey: intent.operationKey,
      objectReference: intent.mediaObjectReference,
      mimeType: 'application/octet-stream',
      fileName: null,
      caption: intent.content,
      correlationId: intent.correlationId,
      causationId: intent.causationId,
    } as const;
    switch (intent.contentType) {
      case 'image':
        return this.transport.sendImage(media);
      case 'audio':
        return this.transport.sendAudio(media);
      case 'document':
        return this.transport.sendDocument(media);
      case 'text':
        return {
          disposition: 'terminal_failure',
          providerMessageReference: null,
          acceptedAt: null,
          errorCategory: 'missing_text_content',
          requiresReconciliation: false,
        };
    }
  }
}
