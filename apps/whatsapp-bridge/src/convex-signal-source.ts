import type { OpaqueTransportSignal, ReactiveTransportSignalSource } from './bridge.js';

export interface OpaqueConvexSignalSubscription {
  /**
   * The concrete Convex adapter subscribes to `transportSignals:listPendingForBridge`. Its
   * callback type deliberately cannot carry arbitrary Convex documents or a message body.
   */
  subscribePending(input: {
    readonly bridgeToken: string;
    readonly limit: number;
    readonly onUpdate: (signals: readonly OpaqueTransportSignal[]) => Promise<void>;
  }): Promise<() => Promise<void>>;
}

/**
 * A thin concrete boundary for the bridge's generated Convex subscription. The app composition
 * supplies an SDK-backed implementation during local setup; tests use a deterministic fake. This
 * keeps the SDK boundary content-free and makes reconnect replay part of the bridge contract.
 */
export class ConvexTransportSignalSource implements ReactiveTransportSignalSource {
  public constructor(
    private readonly subscription: OpaqueConvexSignalSubscription,
    private readonly bridgeToken: string,
    private readonly limit = 100,
  ) {}

  public async subscribe(
    handler: (signals: readonly OpaqueTransportSignal[]) => Promise<void>,
  ): Promise<() => Promise<void>> {
    return this.subscription.subscribePending({
      bridgeToken: this.bridgeToken,
      limit: this.limit,
      onUpdate: handler,
    });
  }
}
