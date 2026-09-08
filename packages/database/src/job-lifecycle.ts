import { randomUUID } from 'node:crypto';

import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { maximumJobDispatchGeneration, type DurableJob } from '@jarvis/contracts';
import { createSafeAuditEvent } from '@jarvis/security';

import type {
  CanonicalJobFailureResult,
  CanonicalJobLeaseResult,
  ClassifiedJobError,
  DurableJobLifecycleProjection,
} from './jobs.js';
import { resolveJobFailureState } from './jobs.js';
import type { JarvisDatabase } from './client.js';
import { auditEvents, jobExecutions, jobs } from './schema/index.js';

type TransactionCallback = Parameters<JarvisDatabase['transaction']>[0];
type DatabaseTransaction = Parameters<TransactionCallback>[0];
type JobRow = typeof jobs.$inferSelect;
type JobAuditRow = Pick<
  JobRow,
  'id' | 'ownerId' | 'correlationId' | 'causationId' | 'dispatchGeneration'
>;

const executionExpirySummary = 'The job reached its latest-start deadline before execution.';
const cancellationSummary = 'The canonical job was cancelled before a new execution lease began.';

function asDurableJob(row: JobRow): DurableJob {
  return {
    id: row.id,
    ownerId: row.ownerId,
    jobType: row.jobType,
    payload: row.payload,
    status: row.status,
    priority: row.priority,
    scheduledFor: row.scheduledFor.toISOString(),
    availableAfter: row.availableAfter.toISOString(),
    executionDeadline: row.executionDeadline?.toISOString() ?? null,
    dispatchGeneration: row.dispatchGeneration,
    attemptCount: row.attemptCount,
    maximumAttempts: row.maximumAttempts,
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
    lastErrorCategory: row.lastErrorCategory,
    lastErrorSummary: row.lastErrorSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    correlationId: row.correlationId,
    ...(row.causationId ? { causationId: row.causationId } : {}),
    ...(row.sourceEventId ? { sourceEventId: row.sourceEventId } : {}),
    idempotencyKey: row.idempotencyKey,
  };
}

export interface CanonicalJobRepository {
  load(input: { readonly jobId: string }): Promise<DurableJob | undefined>;
  loadForSourceEvent(input: { readonly sourceEventId: string }): Promise<DurableJob | undefined>;
}

export type CanonicalJobRevisionResult =
  | {
      readonly disposition: 'rescheduled' | 'replaced' | 'cancelled';
      readonly job: DurableJob;
    }
  | {
      readonly disposition: 'stale' | 'lease_active' | 'already_completed' | 'already_cancelled';
    };

/**
 * Explicit mutation surface for future reminder/scheduler producers. It is intentionally narrow:
 * only Neon advances dispatch authority, and callers must publish the returned canonical snapshot
 * to Convex after commit.
 */
export interface CanonicalJobRevisionRepository {
  reschedule(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly scheduledFor: string;
    readonly availableAfter: string;
    readonly executionDeadline: string | null;
  }): Promise<CanonicalJobRevisionResult>;
  replacePendingInstruction(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly payload: Record<string, unknown>;
    readonly scheduledFor: string;
    readonly availableAfter: string;
    readonly executionDeadline: string | null;
  }): Promise<CanonicalJobRevisionResult>;
  cancelPending(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
  }): Promise<CanonicalJobRevisionResult>;
}

async function appendJobAudit(
  transaction: DatabaseTransaction,
  input: {
    readonly job: JobAuditRow;
    readonly action: string;
    readonly reason: string;
    readonly metadata: Record<string, unknown>;
    readonly occurredAt?: Date;
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
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    correlationId: input.job.correlationId,
    ...(input.job.causationId ? { causationId: input.job.causationId } : {}),
    previousState: { entityType: 'job', entityId: input.job.id },
    resultingState: {
      entityType: 'job',
      entityId: input.job.id,
      version: input.job.dispatchGeneration,
    },
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

function pendingOrExpiredLease(): ReturnType<typeof or> {
  return or(
    inArray(jobs.status, ['queued', 'retry_wait']),
    and(eq(jobs.status, 'leased'), lte(jobs.leaseExpiresAt, sql`now()`)),
  );
}

function leaseableStatus(): ReturnType<typeof or> {
  return or(
    inArray(jobs.status, ['queued', 'retry_wait']),
    and(eq(jobs.status, 'leased'), lte(jobs.leaseExpiresAt, sql`now()`)),
  );
}

function assertCanonicalGeneration(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > maximumJobDispatchGeneration) {
    throw new Error('validation: canonical job generation is invalid.');
  }
}

/**
 * Neon owns the successful conditional update. A preliminary read is only ever used to classify
 * an unsuccessful claim after its authoritative mutation has already failed to match.
 */
export class DrizzleDurableJobLifecycleProjection
  implements DurableJobLifecycleProjection, CanonicalJobRepository, CanonicalJobRevisionRepository
{
  public constructor(private readonly database: JarvisDatabase) {}

  public async load(input: { readonly jobId: string }): Promise<DurableJob | undefined> {
    const [job] = await this.database.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
    return job ? asDurableJob(job) : undefined;
  }

  public async loadForSourceEvent(input: {
    readonly sourceEventId: string;
  }): Promise<DurableJob | undefined> {
    const [job] = await this.database
      .select()
      .from(jobs)
      .where(eq(jobs.sourceEventId, input.sourceEventId))
      .limit(1);
    return job ? asDurableJob(job) : undefined;
  }

  public async recordLease(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly expectedCorrelationId?: string;
    readonly workerId: string;
    readonly leaseDurationMilliseconds: number;
  }): Promise<CanonicalJobLeaseResult> {
    assertCanonicalGeneration(input.expectedGeneration);
    if (
      !Number.isInteger(input.leaseDurationMilliseconds) ||
      input.leaseDurationMilliseconds <= 0
    ) {
      throw new Error('validation: canonical job lease input is invalid.');
    }

    return this.database.transaction(async (transaction) => {
      const conditions = [
        eq(jobs.id, input.jobId),
        eq(jobs.dispatchGeneration, input.expectedGeneration),
        lte(jobs.scheduledFor, sql`now()`),
        lte(jobs.availableAfter, sql`now()`),
        lt(jobs.attemptCount, jobs.maximumAttempts),
        or(isNull(jobs.executionDeadline), gt(jobs.executionDeadline, sql`now()`)),
        leaseableStatus(),
        ...(input.expectedCorrelationId
          ? [eq(jobs.correlationId, input.expectedCorrelationId)]
          : []),
      ];
      const [claimed] = await transaction
        .update(jobs)
        .set({
          status: 'leased',
          attemptCount: sql`${jobs.attemptCount} + 1`,
          leaseOwner: input.workerId,
          leaseExpiresAt: sql`now() + (${input.leaseDurationMilliseconds} * interval '1 millisecond')`,
          updatedAt: sql`now()`,
        })
        .where(and(...conditions))
        .returning();

      if (claimed) {
        await transaction.insert(jobExecutions).values({
          ownerId: claimed.ownerId,
          jobId: claimed.id,
          workerId: input.workerId,
          attemptNumber: claimed.attemptCount,
          dispatchGeneration: claimed.dispatchGeneration,
          status: 'leased',
          leasedAt: claimed.updatedAt,
          leaseExpiresAt: claimed.leaseExpiresAt,
          correlationId: claimed.correlationId,
        });
        await appendJobAudit(transaction, {
          job: claimed,
          action: 'job.leased',
          reason: 'A trusted runtime acquired this canonical durable-job lease.',
          occurredAt: claimed.updatedAt,
          metadata: {
            attemptNumber: claimed.attemptCount,
            dispatchGeneration: claimed.dispatchGeneration,
            workerId: input.workerId,
          },
        });
        return {
          disposition: 'claimed',
          attemptNumber: claimed.attemptCount,
          job: asDurableJob(claimed),
        };
      }

      const expired = await this.expireIfPastDeadline(transaction, input);
      if (expired) {
        return { disposition: 'expired' };
      }

      const current = await this.findJob(transaction, input.jobId);
      if (
        !current ||
        current.dispatchGeneration !== input.expectedGeneration ||
        (input.expectedCorrelationId !== undefined &&
          current.correlationId !== input.expectedCorrelationId)
      ) {
        return { disposition: 'stale' };
      }
      if (current.status === 'completed') {
        return { disposition: 'already_completed' };
      }
      if (current.status === 'terminal_failed' && current.lastErrorCategory === 'expired') {
        return { disposition: 'expired' };
      }
      if (current.status === 'cancelled' || current.status === 'terminal_failed') {
        return { disposition: 'cancelled' };
      }
      return { disposition: 'stale' };
    });
  }

  public async recordCompletion(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly workerId: string;
    readonly attemptNumber: number;
  }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const [completed] = await transaction
        .update(jobs)
        .set({
          status: 'completed',
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.dispatchGeneration, input.expectedGeneration),
            eq(jobs.status, 'leased'),
            eq(jobs.leaseOwner, input.workerId),
            eq(jobs.attemptCount, input.attemptNumber),
            gt(jobs.leaseExpiresAt, sql`now()`),
          ),
        )
        .returning();

      if (!completed) {
        throw new Error('concurrency: a worker cannot complete a lease it does not own.');
      }

      await transaction
        .update(jobExecutions)
        .set({
          status: 'completed',
          completedAt: completed.updatedAt,
          updatedAt: completed.updatedAt,
        })
        .where(
          and(
            eq(jobExecutions.jobId, input.jobId),
            eq(jobExecutions.workerId, input.workerId),
            eq(jobExecutions.attemptNumber, input.attemptNumber),
            eq(jobExecutions.dispatchGeneration, input.expectedGeneration),
          ),
        );
      await appendJobAudit(transaction, {
        job: completed,
        action: 'job.completed',
        reason: 'The durable job handler completed successfully.',
        occurredAt: completed.updatedAt,
        metadata: {
          attemptNumber: input.attemptNumber,
          dispatchGeneration: input.expectedGeneration,
          workerId: input.workerId,
        },
      });
    });
  }

  public async recordFailure(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly workerId: string;
    readonly attemptNumber: number;
    readonly classification: ClassifiedJobError;
  }): Promise<CanonicalJobFailureResult> {
    return this.database.transaction(async (transaction) => {
      const job = await this.findJob(transaction, input.jobId);
      if (
        !job ||
        job.dispatchGeneration !== input.expectedGeneration ||
        job.attemptCount !== input.attemptNumber
      ) {
        throw new Error('concurrency: a stale worker cannot record a newer job attempt as failed.');
      }
      const serverNow = await this.databaseNow(transaction, input.jobId);
      const next = resolveJobFailureState(
        input.attemptNumber,
        job.maximumAttempts,
        input.classification,
      );
      const retryAt = next.retryDelaySeconds
        ? new Date(serverNow.getTime() + next.retryDelaySeconds * 1_000)
        : undefined;
      const expiresBeforeRetry =
        next.status === 'retry_wait' &&
        job.executionDeadline !== null &&
        retryAt !== undefined &&
        retryAt >= job.executionDeadline;
      const status: 'retry_wait' | 'terminal_failed' = expiresBeforeRetry
        ? 'terminal_failed'
        : next.status;
      const errorCategory = expiresBeforeRetry ? 'expired' : input.classification.category;
      const errorSummary = expiresBeforeRetry
        ? executionExpirySummary
        : input.classification.summary;
      const [updated] = await transaction
        .update(jobs)
        .set({
          status,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCategory: errorCategory,
          lastErrorSummary: errorSummary,
          ...(status === 'retry_wait' && retryAt ? { availableAfter: retryAt } : {}),
          ...(status === 'terminal_failed' ? { completedAt: sql`now()` } : {}),
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.dispatchGeneration, input.expectedGeneration),
            eq(jobs.status, 'leased'),
            eq(jobs.leaseOwner, input.workerId),
            eq(jobs.attemptCount, input.attemptNumber),
            gt(jobs.leaseExpiresAt, sql`now()`),
          ),
        )
        .returning();

      if (!updated) {
        throw new Error('concurrency: a worker cannot fail a lease it does not own.');
      }

      await transaction
        .update(jobExecutions)
        .set({
          status,
          completedAt: updated.updatedAt,
          errorCategory,
          errorSummary,
          updatedAt: updated.updatedAt,
        })
        .where(
          and(
            eq(jobExecutions.jobId, input.jobId),
            eq(jobExecutions.workerId, input.workerId),
            eq(jobExecutions.attemptNumber, input.attemptNumber),
            eq(jobExecutions.dispatchGeneration, input.expectedGeneration),
          ),
        );
      await appendJobAudit(transaction, {
        job: updated,
        action:
          status === 'retry_wait'
            ? 'job.retry_scheduled'
            : errorCategory === 'expired'
              ? 'job.expired'
              : 'job.terminal_failed',
        reason: errorSummary,
        occurredAt: updated.updatedAt,
        metadata: {
          attemptNumber: input.attemptNumber,
          dispatchGeneration: input.expectedGeneration,
          errorCategory,
          status,
          workerId: input.workerId,
        },
      });
      return {
        status,
        retryAt: status === 'retry_wait' ? updated.availableAfter.toISOString() : null,
      };
    });
  }

  public async reschedule(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly scheduledFor: string;
    readonly availableAfter: string;
    readonly executionDeadline: string | null;
  }): Promise<CanonicalJobRevisionResult> {
    assertCanonicalGeneration(input.expectedGeneration);
    return this.revisePendingJob({
      ...input,
      disposition: 'rescheduled',
      action: 'job.rescheduled',
      reason: 'The pending canonical job schedule was revised.',
      resetAttempts: false,
    });
  }

  public async replacePendingInstruction(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly payload: Record<string, unknown>;
    readonly scheduledFor: string;
    readonly availableAfter: string;
    readonly executionDeadline: string | null;
  }): Promise<CanonicalJobRevisionResult> {
    assertCanonicalGeneration(input.expectedGeneration);
    return this.revisePendingJob({
      ...input,
      disposition: 'replaced',
      action: 'job.instruction_replaced',
      reason: 'The pending canonical job instruction was replaced before execution.',
      resetAttempts: true,
    });
  }

  public async cancelPending(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
  }): Promise<CanonicalJobRevisionResult> {
    assertCanonicalGeneration(input.expectedGeneration);
    return this.database.transaction(async (transaction) => {
      const [cancelled] = await transaction
        .update(jobs)
        .set({
          status: 'cancelled',
          dispatchGeneration: sql`${jobs.dispatchGeneration} + 1`,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCategory: 'cancelled',
          lastErrorSummary: cancellationSummary,
          completedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.dispatchGeneration, input.expectedGeneration),
            pendingOrExpiredLease(),
          ),
        )
        .returning();
      if (!cancelled) {
        return this.classifyRevisionMiss(transaction, input);
      }
      await appendJobAudit(transaction, {
        job: cancelled,
        action: 'job.cancelled',
        reason: cancellationSummary,
        occurredAt: cancelled.updatedAt,
        metadata: { dispatchGeneration: cancelled.dispatchGeneration },
      });
      return { disposition: 'cancelled', job: asDurableJob(cancelled) };
    });
  }

  private async revisePendingJob(input: {
    readonly jobId: string;
    readonly expectedGeneration: number;
    readonly scheduledFor: string;
    readonly availableAfter: string;
    readonly executionDeadline: string | null;
    readonly payload?: Record<string, unknown>;
    readonly disposition: 'rescheduled' | 'replaced';
    readonly action: string;
    readonly reason: string;
    readonly resetAttempts: boolean;
  }): Promise<CanonicalJobRevisionResult> {
    return this.database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(jobs)
        .set({
          status: 'queued',
          scheduledFor: new Date(input.scheduledFor),
          availableAfter: new Date(input.availableAfter),
          executionDeadline: input.executionDeadline ? new Date(input.executionDeadline) : null,
          ...(input.payload ? { payload: input.payload } : {}),
          ...(input.resetAttempts ? { attemptCount: 0 } : {}),
          dispatchGeneration: sql`${jobs.dispatchGeneration} + 1`,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCategory: null,
          lastErrorSummary: null,
          completedAt: null,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.dispatchGeneration, input.expectedGeneration),
            pendingOrExpiredLease(),
          ),
        )
        .returning();
      if (!updated) {
        return this.classifyRevisionMiss(transaction, input);
      }
      await appendJobAudit(transaction, {
        job: updated,
        action: input.action,
        reason: input.reason,
        occurredAt: updated.updatedAt,
        metadata: {
          dispatchGeneration: updated.dispatchGeneration,
          previousGeneration: input.expectedGeneration,
          attemptsReset: input.resetAttempts,
        },
      });
      return { disposition: input.disposition, job: asDurableJob(updated) };
    });
  }

  private async expireIfPastDeadline(
    transaction: DatabaseTransaction,
    input: {
      readonly jobId: string;
      readonly expectedGeneration: number;
      readonly expectedCorrelationId?: string;
    },
  ): Promise<JobRow | undefined> {
    const [expired] = await transaction
      .update(jobs)
      .set({
        status: 'terminal_failed',
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCategory: 'expired',
        lastErrorSummary: executionExpirySummary,
        completedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(jobs.id, input.jobId),
          eq(jobs.dispatchGeneration, input.expectedGeneration),
          pendingOrExpiredLease(),
          lte(jobs.executionDeadline, sql`now()`),
          ...(input.expectedCorrelationId
            ? [eq(jobs.correlationId, input.expectedCorrelationId)]
            : []),
        ),
      )
      .returning();
    if (!expired) {
      return undefined;
    }
    await appendJobAudit(transaction, {
      job: expired,
      action: 'job.expired',
      reason: executionExpirySummary,
      occurredAt: expired.updatedAt,
      metadata: { dispatchGeneration: expired.dispatchGeneration },
    });
    return expired;
  }

  private async classifyRevisionMiss(
    transaction: DatabaseTransaction,
    input: { readonly jobId: string; readonly expectedGeneration: number },
  ): Promise<CanonicalJobRevisionResult> {
    const current = await this.findJob(transaction, input.jobId);
    if (!current || current.dispatchGeneration !== input.expectedGeneration) {
      return { disposition: 'stale' };
    }
    if (current.status === 'completed') {
      return { disposition: 'already_completed' };
    }
    if (current.status === 'cancelled') {
      return { disposition: 'already_cancelled' };
    }
    if (current.status === 'leased') {
      return { disposition: 'lease_active' };
    }
    return { disposition: 'stale' };
  }

  private async findJob(
    transaction: DatabaseTransaction,
    jobId: string,
  ): Promise<JobRow | undefined> {
    const [job] = await transaction.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return job;
  }

  private async databaseNow(transaction: DatabaseTransaction, jobId: string): Promise<Date> {
    const [clock] = await transaction
      .select({ currentTime: sql<Date>`clock_timestamp()` })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    if (!clock) {
      throw new Error('The canonical job disappeared while its lease failure was recorded.');
    }
    return clock.currentTime;
  }
}
