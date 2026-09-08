import { describe, expect, it } from 'vitest';

import type { DurableJob } from '@jarvis/contracts';
import type {
  CanonicalJobFailureResult,
  CanonicalJobLeaseResult,
  DurableJobLifecycleProjection,
} from '@jarvis/database';
import { StatelessCanonicalJobExecutor } from '@jarvis/orchestration';

const ownerId = '00000000-0000-4000-8000-000000000001';
const jobId = '00000000-0000-4000-8000-000000000002';
const correlationId = '00000000-0000-4000-8000-000000000003';
const now = new Date('2026-08-31T12:00:00.000Z');

function job(overrides: Partial<DurableJob> = {}): DurableJob {
  return {
    id: jobId,
    ownerId,
    jobType: 'jarvis.event.process',
    payload: { eventId: '00000000-0000-4000-8000-000000000004', ownerId },
    status: 'queued',
    priority: 0,
    scheduledFor: now.toISOString(),
    availableAfter: now.toISOString(),
    executionDeadline: null,
    dispatchGeneration: 2,
    attemptCount: 0,
    maximumAttempts: 3,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCategory: null,
    lastErrorSummary: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
    correlationId,
    idempotencyKey: 'canonical-job-executor-test-0001',
    ...overrides,
  };
}

class FakeLifecycle implements DurableJobLifecycleProjection {
  public attempts = 0;
  public completed = false;
  public failed = false;
  public status: DurableJob['status'] = 'queued';
  public readonly leaseInputs: Array<{
    readonly expectedGeneration: number;
    readonly expectedCorrelationId: string | undefined;
  }> = [];

  public constructor(private readonly source: DurableJob) {}

  public async recordLease(input: {
    readonly expectedGeneration: number;
    readonly expectedCorrelationId?: string;
  }): Promise<CanonicalJobLeaseResult> {
    this.leaseInputs.push({
      expectedGeneration: input.expectedGeneration,
      expectedCorrelationId: input.expectedCorrelationId,
    });
    if (
      input.expectedGeneration !== this.source.dispatchGeneration ||
      input.expectedCorrelationId !== this.source.correlationId
    ) {
      return { disposition: 'stale' };
    }
    if (this.status === 'completed') return { disposition: 'already_completed' };
    if (this.status === 'cancelled' || this.status === 'terminal_failed') {
      return { disposition: 'cancelled' };
    }
    if (this.status !== 'queued' && this.status !== 'retry_wait') {
      return { disposition: 'stale' };
    }
    this.status = 'leased';
    this.attempts += 1;
    return {
      disposition: 'claimed',
      attemptNumber: this.attempts,
      job: { ...this.source, status: 'leased', attemptCount: this.attempts },
    };
  }

  public async recordCompletion(): Promise<void> {
    if (this.status !== 'leased') throw new Error('concurrency: stale completion');
    this.status = 'completed';
    this.completed = true;
  }

  public async recordFailure(): Promise<CanonicalJobFailureResult> {
    if (this.status !== 'leased') throw new Error('concurrency: stale failure');
    this.status = 'retry_wait';
    this.failed = true;
    return {
      status: 'retry_wait',
      retryAt: new Date(now.getTime() + 2_000).toISOString(),
    };
  }
}

function executor(
  input: {
    readonly lifecycle?: FakeLifecycle;
    readonly source?: DurableJob;
    readonly handler?: (claimed: DurableJob) => Promise<void>;
  } = {},
) {
  const source = input.source ?? job();
  const lifecycle = input.lifecycle ?? new FakeLifecycle(source);
  let executions = 0;
  const instance = new StatelessCanonicalJobExecutor({
    lifecycle,
    workerId: 'test-vercel-callback',
    handler: {
      async execute(claimed) {
        executions += 1;
        await input.handler?.(claimed);
      },
    },
  });
  return {
    instance,
    lifecycle,
    get executions() {
      return executions;
    },
  };
}

describe('stateless canonical job executor', () => {
  it('runs a matching canonical generation once and treats a duplicate as already completed', async () => {
    const harness = executor();
    await expect(harness.instance.run({ jobId, correlationId, generation: 2 })).resolves.toEqual({
      disposition: 'completed',
    });
    await expect(harness.instance.run({ jobId, correlationId, generation: 2 })).resolves.toEqual({
      disposition: 'already_completed',
    });
    expect(harness.executions).toBe(1);
  });

  it('rejects a stale generation while the canonical job is otherwise queued and available', async () => {
    const harness = executor();
    await expect(harness.instance.run({ jobId, correlationId, generation: 1 })).resolves.toEqual({
      disposition: 'stale',
    });
    expect(harness.executions).toBe(0);
    expect(harness.lifecycle.leaseInputs).toEqual([
      { expectedGeneration: 1, expectedCorrelationId: correlationId },
    ]);
  });

  it('rejects a stale correlation ID and a cancelled canonical job without invoking its handler', async () => {
    const stale = executor();
    await expect(
      stale.instance.run({ jobId, correlationId: 'wrong-correlation', generation: 2 }),
    ).resolves.toEqual({ disposition: 'stale' });
    expect(stale.executions).toBe(0);

    const cancelledLifecycle = new FakeLifecycle(job());
    cancelledLifecycle.status = 'cancelled';
    const cancelled = executor({ lifecycle: cancelledLifecycle });
    await expect(cancelled.instance.run({ jobId, correlationId, generation: 2 })).resolves.toEqual({
      disposition: 'cancelled',
    });
    expect(cancelled.executions).toBe(0);
  });

  it('uses the canonical snapshot returned by the lease rather than a pre-lease payload', async () => {
    const replacement = job({ payload: { eventId: 'replacement-event', ownerId } });
    const harness = executor({
      source: replacement,
      handler: async (claimed) => {
        expect(claimed.payload).toEqual({ eventId: 'replacement-event', ownerId });
      },
    });

    await expect(harness.instance.run({ jobId, correlationId, generation: 2 })).resolves.toEqual({
      disposition: 'completed',
    });
  });

  it('classifies a retryable execution error from the canonical failure result', async () => {
    const harness = executor({
      handler: async () => {
        throw new Error('connection reset by peer');
      },
    });
    await expect(harness.instance.run({ jobId, correlationId, generation: 2 })).resolves.toEqual({
      disposition: 'retry_allowed',
      retryAt: now.getTime() + 2_000,
    });
    expect(harness.lifecycle.failed).toBe(true);
  });
});
