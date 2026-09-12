import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { CanonicalEvent, DurableJob, DurableJobInput } from '@jarvis/contracts';
import type {
  CanonicalEventRepository,
  CanonicalJobFailureResult,
  CanonicalJobLeaseResult,
  CanonicalJobRepository,
  CanonicalJobRevisionRepository,
  CanonicalJobRevisionResult,
  ClassifiedJobError,
  DurableJobLifecycleProjection,
} from '@jarvis/database';
import type {
  EventPipelineDependencies,
  EventTransaction,
  TransactionalEventStore,
} from '@jarvis/domain';

import { runStagingC7Harness } from '../src/staging-c7-harness.js';

const ownerId = '00000000-0000-4000-8000-000000000901';

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryEvents implements CanonicalEventRepository {
  public readonly values = new Map<string, CanonicalEvent>();

  public async load(input: { readonly ownerId: string; readonly eventId: string }) {
    const event = this.values.get(input.eventId);
    return event?.ownerId === input.ownerId ? clone(event) : undefined;
  }

  public async markProcessing(input: { readonly event: CanonicalEvent; readonly summary: string }) {
    await this.setStatus(input.event, 'processing', input.summary);
  }

  public async markProcessed(input: { readonly event: CanonicalEvent; readonly summary: string }) {
    await this.setStatus(input.event, 'processed', input.summary);
  }

  public async markIgnored(input: { readonly event: CanonicalEvent; readonly summary: string }) {
    await this.setStatus(input.event, 'ignored', input.summary);
  }

  public async markFailed(input: { readonly event: CanonicalEvent; readonly summary: string }) {
    await this.setStatus(input.event, 'failed', input.summary);
  }

  private async setStatus(
    event: CanonicalEvent,
    processingStatus: CanonicalEvent['processingStatus'],
    summary: string,
  ) {
    void summary;
    const current = this.values.get(event.id);
    if (!current) throw new Error('fixture event missing');
    this.values.set(event.id, {
      ...current,
      processingStatus,
    });
  }
}

class MemoryLifecycle
  implements DurableJobLifecycleProjection, CanonicalJobRepository, CanonicalJobRevisionRepository
{
  public readonly values = new Map<string, DurableJob>();

  public add(input: DurableJobInput): void {
    this.values.set(input.id, {
      ...input,
      status: 'queued',
      attemptCount: 0,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCategory: null,
      lastErrorSummary: null,
      createdAt: input.scheduledFor,
      updatedAt: input.scheduledFor,
      completedAt: null,
    });
  }

  public async load(input: { readonly jobId: string }) {
    const job = this.values.get(input.jobId);
    return job ? clone(job) : undefined;
  }

  public async loadForSourceEvent(input: { readonly sourceEventId: string }) {
    for (const job of this.values.values()) {
      if (job.sourceEventId === input.sourceEventId) return clone(job);
    }
    return undefined;
  }

  public async recordLease(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly expectedCorrelationId?: string;
    readonly workerId: string;
    readonly leaseDurationMilliseconds: number;
  }): Promise<CanonicalJobLeaseResult> {
    const job = this.require(input.jobId);
    if (
      job.dispatchGeneration !== input.expectedGeneration ||
      (input.expectedCorrelationId !== undefined &&
        job.correlationId !== input.expectedCorrelationId)
    ) {
      return { disposition: 'stale' };
    }
    if (job.status === 'completed') return { disposition: 'already_completed' };
    if (job.status === 'cancelled') return { disposition: 'cancelled' };
    if (job.status === 'terminal_failed' && job.lastErrorCategory === 'expired') {
      return { disposition: 'expired' };
    }
    if (job.executionDeadline && Date.parse(job.executionDeadline) <= Date.now()) {
      this.values.set(job.id, {
        ...job,
        status: 'terminal_failed',
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCategory: 'expired',
        lastErrorSummary: 'expired fixture',
        completedAt: new Date().toISOString(),
      });
      return { disposition: 'expired' };
    }
    if (job.status !== 'queued' && job.status !== 'retry_wait') {
      return { disposition: 'stale' };
    }
    const claimed: DurableJob = {
      ...job,
      status: 'leased',
      attemptCount: job.attemptCount + 1,
      leaseOwner: input.workerId,
      leaseExpiresAt: new Date(Date.now() + input.leaseDurationMilliseconds).toISOString(),
    };
    this.values.set(job.id, claimed);
    return { disposition: 'claimed', attemptNumber: claimed.attemptCount, job: clone(claimed) };
  }

  public async recordCompletion(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly workerId: string;
    readonly attemptNumber: number;
  }): Promise<void> {
    const job = this.require(input.jobId);
    if (
      job.status !== 'leased' ||
      job.dispatchGeneration !== input.expectedGeneration ||
      job.leaseOwner !== input.workerId ||
      job.attemptCount !== input.attemptNumber
    ) {
      throw new Error('fixture completion fencing failed');
    }
    this.values.set(job.id, {
      ...job,
      status: 'completed',
      leaseOwner: null,
      leaseExpiresAt: null,
      completedAt: new Date().toISOString(),
    });
  }

  public async recordFailure(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly workerId: string;
    readonly attemptNumber: number;
    readonly classification: ClassifiedJobError;
  }): Promise<CanonicalJobFailureResult> {
    const job = this.require(input.jobId);
    if (
      job.status !== 'leased' ||
      job.dispatchGeneration !== input.expectedGeneration ||
      job.leaseOwner !== input.workerId ||
      job.attemptCount !== input.attemptNumber
    ) {
      throw new Error('fixture failure fencing failed');
    }
    if (input.classification.disposition === 'retryable') {
      this.values.set(job.id, {
        ...job,
        status: 'retry_wait',
        leaseOwner: null,
        leaseExpiresAt: null,
        availableAfter: new Date(Date.now() - 1).toISOString(),
        lastErrorCategory: input.classification.category,
        lastErrorSummary: input.classification.summary,
      });
      return { status: 'retry_wait', retryAt: new Date(Date.now() - 1).toISOString() };
    }
    this.values.set(job.id, {
      ...job,
      status: 'terminal_failed',
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCategory: input.classification.category,
      lastErrorSummary: input.classification.summary,
      completedAt: new Date().toISOString(),
    });
    return { status: 'terminal_failed', retryAt: null };
  }

  public async reschedule(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly scheduledFor: string;
    readonly availableAfter: string;
    readonly executionDeadline: string | null;
  }): Promise<CanonicalJobRevisionResult> {
    const job = this.require(input.jobId);
    if (job.dispatchGeneration !== input.expectedGeneration) return { disposition: 'stale' };
    if (job.status === 'leased') return { disposition: 'lease_active' };
    if (job.status === 'completed') return { disposition: 'already_completed' };
    if (job.status === 'cancelled') return { disposition: 'already_cancelled' };
    const revised: DurableJob = {
      ...job,
      status: 'queued',
      dispatchGeneration: job.dispatchGeneration + 1,
      scheduledFor: input.scheduledFor,
      availableAfter: input.availableAfter,
      executionDeadline: input.executionDeadline,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCategory: null,
      lastErrorSummary: null,
      completedAt: null,
    };
    this.values.set(job.id, revised);
    return { disposition: 'rescheduled', job: clone(revised) };
  }

  public async replacePendingInstruction(): Promise<CanonicalJobRevisionResult> {
    throw new Error('not used by this fixed C.7 harness');
  }

  public async cancelPending(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
  }): Promise<CanonicalJobRevisionResult> {
    const job = this.require(input.jobId);
    if (job.dispatchGeneration !== input.expectedGeneration) return { disposition: 'stale' };
    if (job.status === 'completed') return { disposition: 'already_completed' };
    if (job.status === 'cancelled') return { disposition: 'already_cancelled' };
    if (job.status === 'leased') return { disposition: 'lease_active' };
    const cancelled: DurableJob = {
      ...job,
      status: 'cancelled',
      dispatchGeneration: job.dispatchGeneration + 1,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCategory: 'cancelled',
      lastErrorSummary: 'cancelled fixture',
      completedAt: new Date().toISOString(),
    };
    this.values.set(job.id, cancelled);
    return { disposition: 'cancelled', job: clone(cancelled) };
  }

  private require(jobId: string): DurableJob {
    const job = this.values.get(jobId);
    if (!job) throw new Error('fixture job missing');
    return job;
  }
}

function createPipeline(
  events: MemoryEvents,
  lifecycle: MemoryLifecycle,
): EventPipelineDependencies {
  const store: TransactionalEventStore = {
    async transaction<T>(operation: (transaction: EventTransaction) => Promise<T>): Promise<T> {
      return operation({
        async persistEvent(input) {
          const event: CanonicalEvent = {
            id: randomUUID(),
            ownerId: input.ownerId,
            ...input.envelope,
            receivedAt: input.receivedAt,
            correlationId: input.correlationId,
            processingStatus: 'queued',
          };
          events.values.set(event.id, event);
          return { event, duplicate: false };
        },
        async enqueueJob(input) {
          lifecycle.add(input);
        },
        async appendAudit() {
          return undefined;
        },
      } as EventTransaction);
    },
  };
  return {
    store,
    handlers: new Map(),
    policy: {
      evaluate() {
        throw new Error('policy must not run for the fixed C.7 fixture event');
      },
    },
    createJob(event) {
      const now = new Date(Date.now() - 1_000).toISOString();
      return {
        id: randomUUID(),
        ownerId: event.ownerId,
        jobType: 'jarvis.event.process',
        payload: { eventId: event.id, ownerId: event.ownerId },
        priority: 0,
        scheduledFor: now,
        availableAfter: now,
        executionDeadline: null,
        dispatchGeneration: 1,
        maximumAttempts: 5,
        correlationId: event.correlationId,
        sourceEventId: event.id,
        idempotencyKey: `fixture-job:${event.id}`,
      };
    },
  };
}

describe('staging C.7 lifecycle harness', () => {
  it('runs exactly the fixed cases and retires every synthetic job and event', async () => {
    const events = new MemoryEvents();
    const lifecycle = new MemoryLifecycle();
    const result = await runStagingC7Harness({
      ownerId,
      pipeline: createPipeline(events, lifecycle),
      lifecycle,
      events,
      canonicalHandler: {
        async execute(job) {
          const eventId = typeof job.payload.eventId === 'string' ? job.payload.eventId : undefined;
          if (!eventId) throw new Error('fixture canonical handler lacked an event reference');
          const event = await events.load({ ownerId: job.ownerId, eventId });
          if (!event) throw new Error('fixture canonical event missing');
          await events.markIgnored({ event, summary: 'fixed C.7 test event' });
        },
      },
      assertFixtureReady: async () =>
        [...lifecycle.values.values()].every(
          (job) =>
            job.status === 'completed' ||
            job.status === 'cancelled' ||
            job.status === 'terminal_failed',
        ) &&
        [...events.values.values()].every(
          (event) =>
            event.processingStatus === 'processed' ||
            event.processingStatus === 'ignored' ||
            event.processingStatus === 'failed',
        ),
      wait: async () => undefined,
    });

    expect(result).toEqual({
      passed: true,
      cases: [
        'stale_generation',
        'held_stale_callback',
        'cancellation',
        'rescheduling',
        'expiry',
        'retry_generation',
        'publication_recovery',
      ],
      noActiveSyntheticWork: true,
    });
    expect([...lifecycle.values.values()]).toHaveLength(7);
    expect([...lifecycle.values.values()].every((job) => job.status !== 'queued')).toBe(true);
    expect([...events.values.values()].every((event) => event.processingStatus === 'ignored')).toBe(
      true,
    );
  });
});
