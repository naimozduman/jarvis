import {
  incomingEventEnvelopeSchema,
  messagingSendResultSchema,
  outboundDeliveryIntentSchema,
} from '@jarvis/contracts';
import type {
  IncomingEventEnvelope,
  MessagingConnectionState,
  MessagingSendResult,
} from '@jarvis/contracts';

import type { BridgeApiPort, BridgeDeliveryResultDisposition } from './bridge.js';

export interface VercelBridgeApiClientOptions {
  readonly baseUrl: string;
  /** Shared only with the local bridge and the server-side Vercel route. Never logged. */
  readonly token: string;
  readonly fetch?: typeof globalThis.fetch;
}

function responseRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function resultDisposition(value: unknown): BridgeDeliveryResultDisposition | undefined {
  return value === 'completed' ||
    value === 'terminal' ||
    value === 'already_handled' ||
    value === 'lease_expired' ||
    value === 'unavailable' ||
    value === 'retry_scheduled' ||
    value === 'reconciliation_required'
    ? value
    : undefined;
}

/**
 * Narrow local-to-Vercel client. It has no Convex API, so no private delivery body can ever be
 * sent from this process back into Convex while a signal is acknowledged or retried.
 */
export class VercelBridgeApiClient implements BridgeApiPort {
  private readonly fetch: typeof globalThis.fetch;
  private readonly baseUrl: string;

  public constructor(private readonly options: VercelBridgeApiClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  public async forwardInbound(event: IncomingEventEnvelope): Promise<void> {
    const parsed = incomingEventEnvelopeSchema.parse(event);
    await this.post('/internal/local-bridge/events', parsed);
  }

  public async fetchPendingDelivery(input: {
    readonly deliveryId: string;
    readonly bridgeId: string;
  }): Promise<
    | {
        readonly status: 'ready';
        readonly intent: ReturnType<typeof outboundDeliveryIntentSchema.parse>;
        readonly leaseToken: string;
        readonly leaseExpiresAt: string;
      }
    | { readonly status: 'expired' | 'already_handled' | 'unavailable' }
  > {
    const body = await this.post(
      `/internal/local-bridge/deliveries/${encodeURIComponent(input.deliveryId)}/lease`,
      {
        bridgeId: input.bridgeId,
      },
    );
    const value = responseRecord(body);
    if (!value) throw new Error('The local bridge delivery response was malformed.');
    if (
      value.status === 'expired' ||
      value.status === 'already_handled' ||
      value.status === 'unavailable'
    ) {
      return { status: value.status };
    }
    const intent = outboundDeliveryIntentSchema.safeParse(value.intent);
    const leaseToken = typeof value.leaseToken === 'string' ? value.leaseToken : undefined;
    const leaseExpiresAt =
      typeof value.leaseExpiresAt === 'string' ? value.leaseExpiresAt : undefined;
    if (value.status !== 'ready' || !intent.success || !leaseToken || !leaseExpiresAt) {
      throw new Error('The local bridge delivery response was malformed.');
    }
    return { status: 'ready', intent: intent.data, leaseToken, leaseExpiresAt };
  }

  public async reportDeliveryResult(input: {
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly leaseToken: string;
    readonly result: MessagingSendResult;
  }): Promise<{
    readonly disposition: BridgeDeliveryResultDisposition;
    readonly retryAt?: string;
  }> {
    const body = await this.post(
      `/internal/local-bridge/deliveries/${encodeURIComponent(input.deliveryId)}/result`,
      {
        bridgeId: input.bridgeId,
        leaseToken: input.leaseToken,
        result: messagingSendResultSchema.parse(input.result),
      },
    );
    const value = responseRecord(body);
    const disposition = value ? resultDisposition(value.disposition) : undefined;
    const retryAt = value && typeof value.retryAt === 'string' ? value.retryAt : undefined;
    if (!disposition || (disposition === 'retry_scheduled' && !retryAt)) {
      throw new Error('The local bridge result response was malformed.');
    }
    return retryAt ? { disposition, retryAt } : { disposition };
  }

  public async acknowledgeSignal(input: {
    readonly deliveryId: string;
    readonly sequence: number;
  }): Promise<void> {
    await this.post(
      `/internal/local-bridge/signals/${encodeURIComponent(input.deliveryId)}/${encodeURIComponent(String(input.sequence))}/ack`,
      {},
    );
  }

  public async heartbeat(input: {
    readonly bridgeId: string;
    readonly state: MessagingConnectionState;
    readonly safeErrorCategory: string | null;
  }): Promise<void> {
    await this.post('/internal/local-bridge/heartbeat', input);
  }

  private async post(path: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error('The canonical bridge API is unavailable.');
    }
    if (!response.ok) throw new Error('The canonical bridge API rejected the request.');
    return response.json().catch(() => undefined);
  }
}
