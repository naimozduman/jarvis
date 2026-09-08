import type { DurableJob } from '@jarvis/contracts';

export type OrchestrationTriggerType =
  'canonical_job' | 'retry' | 'reminder' | 'follow_up' | 'transport_delivery';

export interface OrchestrationJobSignal {
  readonly jobId: string;
  readonly correlationId: string;
  readonly triggerType: OrchestrationTriggerType;
  readonly scheduledAt: string;
  readonly generation: number;
  readonly maximumDispatchAttempts: number;
}

export interface OrchestrationPublisher {
  scheduleJob(signal: OrchestrationJobSignal): Promise<void>;
  cancelScheduledJob(input: { readonly jobId: string; readonly generation: number }): Promise<void>;
  publishTransportSignal(input: {
    readonly deliveryId: string;
    readonly createdAt: string;
  }): Promise<void>;
  scheduleTransportSignal(input: {
    readonly deliveryId: string;
    readonly scheduledAt: string;
  }): Promise<void>;
  acknowledgeTransportSignal(input: {
    readonly deliveryId: string;
    readonly sequence: number;
    readonly acknowledgedAt: string;
  }): Promise<void>;
}

export class OrchestrationUnavailableError extends Error {
  public constructor() {
    super('network: the opaque orchestration coordinator is unavailable.');
    this.name = 'OrchestrationUnavailableError';
  }
}

export interface ConvexHttpOrchestrationPublisherOptions {
  readonly baseUrl: string | undefined;
  readonly secret: string | undefined;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Vercel's narrow command client. It sends only opaque IDs and server-derived timestamps to the
 * Convex HTTP router; it cannot serialise canonical payloads, messages, or model context.
 */
export class ConvexHttpOrchestrationPublisher implements OrchestrationPublisher {
  private readonly fetch: typeof globalThis.fetch;

  public constructor(private readonly options: ConvexHttpOrchestrationPublisherOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  public async scheduleJob(signal: OrchestrationJobSignal): Promise<void> {
    await this.post('/internal/schedule', {
      jobId: signal.jobId,
      correlationId: signal.correlationId,
      triggerType: signal.triggerType,
      scheduledAt: new Date(signal.scheduledAt).getTime(),
      generation: signal.generation,
      maximumDispatchAttempts: signal.maximumDispatchAttempts,
    });
  }

  public async cancelScheduledJob(input: {
    readonly jobId: string;
    readonly generation: number;
  }): Promise<void> {
    await this.post('/internal/cancel', input);
  }

  public async publishTransportSignal(input: {
    readonly deliveryId: string;
    readonly createdAt: string;
  }): Promise<void> {
    await this.post('/internal/transport-signal', {
      deliveryId: input.deliveryId,
      createdAt: new Date(input.createdAt).getTime(),
    });
  }

  public async scheduleTransportSignal(input: {
    readonly deliveryId: string;
    readonly scheduledAt: string;
  }): Promise<void> {
    await this.post('/internal/transport-signal/schedule', {
      deliveryId: input.deliveryId,
      scheduledAt: new Date(input.scheduledAt).getTime(),
    });
  }

  public async acknowledgeTransportSignal(input: {
    readonly deliveryId: string;
    readonly sequence: number;
    readonly acknowledgedAt: string;
  }): Promise<void> {
    await this.post('/internal/transport-signal/ack', {
      deliveryId: input.deliveryId,
      sequence: input.sequence,
      acknowledgedAt: new Date(input.acknowledgedAt).getTime(),
    });
  }

  private async post(path: string, body: Readonly<Record<string, unknown>>): Promise<void> {
    if (!this.options.baseUrl || !this.options.secret) {
      throw new OrchestrationUnavailableError();
    }
    let response: Response;
    try {
      response = await this.fetch(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new OrchestrationUnavailableError();
    }
    if (!response.ok) {
      throw new OrchestrationUnavailableError();
    }
  }
}

/**
 * Produces the opaque coordinator signal from a Neon-owned snapshot. Callers must reload this
 * canonical row after any revision; this helper never invents a generation on Convex's behalf.
 */
export function canonicalJobSignal(
  job: Pick<
    DurableJob,
    'id' | 'correlationId' | 'jobType' | 'availableAfter' | 'maximumAttempts' | 'dispatchGeneration'
  >,
): OrchestrationJobSignal {
  const triggerType: OrchestrationTriggerType =
    job.jobType === 'jarvis.transport.outbound.send'
      ? 'transport_delivery'
      : job.jobType === 'jarvis.reminder.fire'
        ? 'reminder'
        : job.jobType === 'jarvis.reminder.follow-up'
          ? 'follow_up'
          : 'canonical_job';
  return {
    jobId: job.id,
    correlationId: job.correlationId,
    triggerType,
    scheduledAt: job.availableAfter,
    generation: job.dispatchGeneration,
    maximumDispatchAttempts: job.maximumAttempts,
  };
}
