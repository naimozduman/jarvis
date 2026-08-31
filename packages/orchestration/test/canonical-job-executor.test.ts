import { describe, expect, it } from 'vitest';

import type { DurableJob } from '@jarvis/contracts';
import type { CanonicalJobRepository, DurableJobLifecycleProjection } from '@jarvis/database';
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

  public async recordLease(): Promise<{ readonly attemptNumber: number }> {
    if (this.status !== 'queued' && this.status !== 'retry_wait') {
      throw new Error('concurrency: lease unavailable');
    }
    this.status = 'leased';
    this.attempts += 1;
    return { attemptNumber: this.attempts };
  }

  public async recordCompletion(): Promise<void> {
    if (this.status !== 'leased') throw new Error('concurrency: stale completion');
    this.status = 'completed';
    this.completed = true;
  }

  public async recordFailure(): Promise<void> {
    if (this.status !== 'leased') throw new Error('concurrency: stale failure');
    this.status = 'retry_wait';
    this.failed = true;
  }
}

class FakeJobs implements CanonicalJobRepository {
  public constructor(
    private readonly source: DurableJob,
    private readonly lifecycle: FakeLifecycle,
  ) {}

  public async load(): Promise<DurableJob> {
    return { ...this.source, status: this.lifecycle.status, attemptCount: this.lifecycle.attempts };
  }

  public async loadForSourceEvent(): Promise<DurableJob | undefined> {
    return undefined;
  }
}

function executor(
  input: { readonly lifecycle?: FakeLifecycle; readonly handler?: () => Promise<void> } = {},
) {
  const lifecycle = input.lifecycle ?? new FakeLifecycle();
  let executions = 0;
  const instance = new StatelessCanonicalJobExecutor({
    jobs: new FakeJobs(job(), lifecycle),
    lifecycle,
    workerId: 'test-vercel-callback',
    now: () => now,
    handler: {
      async execute() {
        executions += 1;
        await input.handler?.();
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
  it('runs a scheduled job once and treats a duplicate trigger as already completed', async () => {
    const harness = executor();
    await expect(harness.instance.run({ jobId, correlationId })).resolves.toEqual({
      disposition: 'completed',
    });
    await expect(harness.instance.run({ jobId, correlationId })).resolves.toEqual({
      disposition: 'already_completed',
    });
    expect(harness.executions).toBe(1);
  });

  it('rejects stale correlation IDs and a cancelled canonical job without invoking its handler', async () => {
    const stale = executor();
    await expect(
      stale.instance.run({ jobId, correlationId: 'wrong-correlation' }),
    ).resolves.toEqual({
      disposition: 'stale',
    });
    expect(stale.executions).toBe(0);

    const cancelledLifecycle = new FakeLifecycle();
    cancelledLifecycle.status = 'cancelled';
    const cancelled = executor({ lifecycle: cancelledLifecycle });
    await expect(cancelled.instance.run({ jobId, correlationId })).resolves.toEqual({
      disposition: 'cancelled',
    });
    expect(cancelled.executions).toBe(0);
  });

  it('classifies a retryable execution error and returns bounded retry scheduling information', async () => {
    const harness = executor({
      handler: async () => {
        throw new Error('connection reset by peer');
      },
    });
    await expect(harness.instance.run({ jobId, correlationId })).resolves.toEqual({
      disposition: 'retry_allowed',
      retryAt: now.getTime() + 2_000,
    });
    expect(harness.lifecycle.failed).toBe(true);
  });
});
