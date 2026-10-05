export interface WhatsAppCloudBridgeSignalPublisherOptions {
  /** Base URL of the dedicated bridge, never Meta's Graph endpoint. */
  readonly baseUrl: string | undefined;
  /** Server-only signal credential; it is distinct from ingress and orchestration credentials. */
  readonly accessToken: string | undefined;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Sends a wake-up containing only the canonical delivery UUID. The bridge must separately lease
 * the persisted reply from JARVIS, so no prompt, message body, recipient, or provider identifier
 * crosses the scheduler signal boundary.
 */
export class WhatsAppCloudBridgeSignalPublisher {
  private readonly fetch: typeof globalThis.fetch;

  public constructor(private readonly options: WhatsAppCloudBridgeSignalPublisherOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  public async publish(input: {
    readonly deliveryId: string;
    readonly createdAt: string;
  }): Promise<void> {
    if (!this.options.baseUrl || !this.options.accessToken) {
      throw new Error('configuration: the official Cloud bridge signal boundary is unavailable.');
    }
    const endpoint = new URL(
      `/api/internal/jarvis-deliveries/${encodeURIComponent(input.deliveryId)}/signal`,
      this.options.baseUrl,
    ).toString();
    let response: Response;
    try {
      response = await this.fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.options.accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error('network: the official Cloud bridge signal could not be delivered.');
    }
    if (response.ok) return;
    if (response.status === 401 || response.status === 403) {
      throw new Error('unauthorized: the official Cloud bridge rejected its signal credential.');
    }
    if (response.status >= 500) {
      throw new Error('network: the official Cloud bridge is temporarily unavailable.');
    }
    throw new Error('validation: the official Cloud bridge rejected an opaque delivery signal.');
  }
}
