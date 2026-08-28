import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { createSafeAuditEvent } from '@jarvis/security';
import type { ClassifiedJobError, DurableJobLifecycleProjection } from './jobs.js';
import { resolveJobFailureState } from './jobs.js';

import type { JarvisDatabase } from './client.js';
import { auditEvents, jobExecutions, jobs } from './schema/index.js';

type TransactionCallback = Parameters<JarvisDatabase['transaction']>[0];
type DatabaseTransaction = Parameters<TransactionCallback>[0];

interface JobProjectionRow {
  readonly id: string;
  readonly ownerId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly status:
    'queued' | 'leased' | 'retry_wait' | 'completed' | 'terminal_failed' | 'cancelled';
  readonly attemptCount: number;
  readonly maximumAttempts: number;
  readonly leaseExpiresAt: Date | null;
}

function isLeaseable(job: JobProjectionRow, now: Date): boolean {
  return (
    job.status === 'queued' ||
    job.status === 'retry_wait' ||
    (job.status === 'leased' && job.leaseExpiresAt !== null && job.leaseExpiresAt < now)
  );
}

async function appendJobAudit(
  transaction: DatabaseTransaction,
  input: {
    readonly job: Pick<JobProjectionRow, 'id' | 'ownerId' | 'correlationId' | 'causationId'>;
    readonly action: string;
    readonly reason: string;
    readonly metadata: Record<string, unknown>;
  },
): Promise<void> {
  const safe = createSafeAuditEvent({
    id: randomUUID(),
    ownerId: input.job.ownerId,
    actorType: 'worker',
    actorId: null,
    action: input.action,
    targetType: 'job',
    targetId: input.job.id,
    occurredAt: new Date().toISOString(),
    correlationId: input.job.correlationId,
    ...(input.job.causationId ? { causationId: input.job.causationId } : {}),
    previousState: { entityType: 'job', entityId: input.job.id },
    resultingState: { entityType: 'job', entityId: input.job.id },
    reason: input.reason,
    source: 'internal',
    metadata: input.metadata,
  });

  await transaction.insert(auditEvents).values({
    id: safe.id,
    ownerId: safe.ownerId,
    actorType: safe.actorType,
    actorId: safe.actorId,
    action: safe.action,
    targetType: safe.targetType,
    targetId: safe.targetId,
    occurredAt: new Date(safe.occurredAt),
    correlationId: safe.correlationId,
    causationId: safe.causationId,
    previousStateReference: safe.previousState ?? undefined,
    resultingStateReference: safe.resultingState ?? undefined,
    reason: safe.reason,
    source: safe.source,
    metadata: safe.metadata,
  });
}

/**
 * Keeps JARVIS-owned job lifecycle/audit records in sync with a pg-boss worker. pg-boss remains
 * the only physical claimant; this projection has optimistic concurrency protection so a stale
 * lease cannot overwrite a newer retry attempt.
 */
export class DrizzleDurableJobLifecycleProjection implements DurableJobLifecycleProjection {
  public constructor(private readonly database: JarvisDatabase) {}

  public async recordLease(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly leaseExpiresAt: Date;
  }): Promise<{ readonly attemptNumber: number }> {
    return this.database.transaction(async (transaction) => {
      const now = new Date();
      const job = await this.findJob(transaction, input.jobId);
      if (!isLeaseable(job, now)) {
        throw new Error('concurrency: the JARVIS job projection is not available for this lease.');
      }

      const attemptNumber = job.attemptCount + 1;
      const [updated] = await transaction
        .update(jobs)
        .set({
          status: 'leased',
          attemptCount: attemptNumber,
          leaseOwner: input.workerId,
          leaseExpiresAt: input.leaseExpiresAt,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, input.jobId), eq(jobs.attemptCount, job.attemptCount)))
        .returning({ id: jobs.id });

      if (!updated) {
        throw new Error('concurrency: another worker updated the JARVIS job projection first.');
      }

      await transaction.insert(jobExecutions).values({
        ownerId: job.ownerId,
        jobId: job.id,
        workerId: input.workerId,
        attemptNumber,
        status: 'leased',
        leasedAt: now,
        leaseExpiresAt: input.leaseExpiresAt,
        correlationId: job.correlationId,
      });
      await appendJobAudit(transaction, {
        job,
        action: 'job.leased',
        reason: 'pg-boss assigned this job to a durable worker lease.',
        metadata: { attemptNumber, workerId: input.workerId },
      });

      return { attemptNumber };
    });
  }

  public async recordCompletion(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly attemptNumber: number;
  }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const job = await this.findJob(transaction, input.jobId);
      const now = new Date();
      const [updated] = await transaction
        .update(jobs)
        .set({
          status: 'completed',
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, input.jobId), eq(jobs.leaseOwner, input.workerId)))
        .returning({ id: jobs.id });

      if (!updated) {
        throw new Error('concurrency: a worker cannot complete a lease it does not own.');
      }

      await transaction
        .update(jobExecutions)
        .set({ status: 'completed', completedAt: now, updatedAt: now })
        .where(
          and(
            eq(jobExecutions.jobId, input.jobId),
            eq(jobExecutions.workerId, input.workerId),
            eq(jobExecutions.attemptNumber, input.attemptNumber),
          ),
        );
      await appendJobAudit(transaction, {
        job,
        action: 'job.completed',
        reason: 'The durable job handler completed successfully.',
        metadata: { attemptNumber: input.attemptNumber, workerId: input.workerId },
      });
    });
  }

  public async recordFailure(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly attemptNumber: number;
    readonly classification: ClassifiedJobError;
  }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const job = await this.findJob(transaction, input.jobId);
      if (job.attemptCount !== input.attemptNumber) {
        throw new Error('concurrency: a stale worker cannot record a newer job attempt as failed.');
      }

      const now = new Date();
      const next = resolveJobFailureState(
        input.attemptNumber,
        job.maximumAttempts,
        input.classification,
      );
      const retryAvailableAfter = next.retryDelaySeconds
        ? new Date(now.getTime() + next.retryDelaySeconds * 1_000)
        : undefined;
      const [updated] = await transaction
        .update(jobs)
        .set({
          status: next.status,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCategory: input.classification.category,
          lastErrorSummary: input.classification.summary,
          ...(retryAvailableAfter ? { availableAfter: retryAvailableAfter } : {}),
          ...(next.status === 'terminal_failed' ? { completedAt: now } : {}),
          updatedAt: now,
        })
        .where(and(eq(jobs.id, input.jobId), eq(jobs.leaseOwner, input.workerId)))
        .returning({ id: jobs.id });

      if (!updated) {
        throw new Error('concurrency: a worker cannot fail a lease it does not own.');
      }

      await transaction
        .update(jobExecutions)
        .set({
          status: next.status,
          completedAt: now,
          errorCategory: input.classification.category,
          errorSummary: input.classification.summary,
          updatedAt: now,
        })
        .where(
          and(
            eq(jobExecutions.jobId, input.jobId),
            eq(jobExecutions.workerId, input.workerId),
            eq(jobExecutions.attemptNumber, input.attemptNumber),
          ),
        );
      await appendJobAudit(transaction, {
        job,
        action: next.status === 'retry_wait' ? 'job.retry_scheduled' : 'job.terminal_failed',
        reason: input.classification.summary,
        metadata: {
          attemptNumber: input.attemptNumber,
          errorCategory: input.classification.category,
          status: next.status,
          workerId: input.workerId,
        },
      });
    });
  }

  private async findJob(
    transaction: DatabaseTransaction,
    jobId: string,
  ): Promise<JobProjectionRow> {
    const [job] = await transaction
      .select({
        id: jobs.id,
        ownerId: jobs.ownerId,
        correlationId: jobs.correlationId,
        causationId: jobs.causationId,
        status: jobs.status,
        attemptCount: jobs.attemptCount,
        maximumAttempts: jobs.maximumAttempts,
        leaseExpiresAt: jobs.leaseExpiresAt,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      throw new Error('The pg-boss job does not have a JARVIS lifecycle projection.');
    }

    return job;
  }
}
