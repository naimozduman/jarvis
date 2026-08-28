import { sql } from 'drizzle-orm';
import { fromDrizzle, PgBoss } from 'pg-boss';
import type { DrizzleTransactionLike, Job } from 'pg-boss';

import type { DurableJobInput, JobErrorCategory } from '@jarvis/contracts';

export const phaseOneQueueNames = [
  'jarvis.event.process',
  'jarvis.reminder.fire',
  'jarvis.reminder.follow-up',
  'jarvis.connector.reconcile',
  'jarvis.dead-letter',
] as const;

export type PhaseOneQueueName = (typeof phaseOneQueueNames)[number];

export interface TransactionalJobTransport {
  enqueue(transaction: DrizzleTransactionLike, job: DurableJobInput): Promise<void>;
}

export interface PgBossJobTransportOptions {
  readonly connectionString: string;
  readonly schema?: string;
  readonly applicationName?: string;
  readonly workerId?: string;
}

export interface ClaimedDurableJob {
  readonly id: string;
  readonly name: string;
  readonly data: Record<string, unknown>;
  readonly signal: AbortSignal;
}

export type ClaimedJobHandler = (job: ClaimedDurableJob) => Promise<void>;

/**
 * Records the application lifecycle only after pg-boss has claimed the physical job. It is not a
 * second queue or a competing claim loop.
 */
export interface DurableJobLifecycleProjection {
  recordLease(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly leaseExpiresAt: Date;
  }): Promise<{ readonly attemptNumber: number }>;
  recordCompletion(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly attemptNumber: number;
  }): Promise<void>;
  recordFailure(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly attemptNumber: number;
    readonly classification: ClassifiedJobError;
  }): Promise<void>;
}

/**
 * pg-boss is the only concurrent claim mechanism. JARVIS's `jobs` table projects lifecycle/audit
 * fields but never runs a second timer or `SKIP LOCKED` claim loop.
 */
export class PgBossDurableJobTransport implements TransactionalJobTransport {
  private readonly boss: PgBoss;
  private readonly workerId: string;
  private started = false;

  public constructor(options: PgBossJobTransportOptions) {
    this.boss = new PgBoss({
      application_name: options.applicationName ?? 'jarvis-worker',
      connectionString: options.connectionString,
      schema: options.schema ?? 'pgboss',
    });
    this.workerId = options.workerId ?? `jarvis-worker:${process.pid}`;
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await this.boss.start();

    for (const name of phaseOneQueueNames) {
      const queueOptions = {
        deleteAfterSeconds: 0,
        expireInSeconds: 300,
        heartbeatSeconds: 60,
        retryBackoff: true,
        retryDelay: 2,
        retryDelayMax: 3_600,
        retryLimit: 4,
      };

      if (name === 'jarvis.dead-letter') {
        await this.boss.createQueue(name, queueOptions);
      } else {
        await this.boss.createQueue(name, {
          ...queueOptions,
          deadLetter: 'jarvis.dead-letter',
        });
      }
    }

    this.started = true;
  }

  public async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    await this.boss.stop();
    this.started = false;
  }

  public async enqueue(transaction: DrizzleTransactionLike, job: DurableJobInput): Promise<void> {
    if (!this.started) {
      throw new Error('The pg-boss durable-job transport is not initialized.');
    }

    const queuedId = await this.boss.send(job.jobType, job.payload, {
      db: fromDrizzle(transaction, sql),
      deadLetter: 'jarvis.dead-letter',
      deleteAfterSeconds: 0,
      expireInSeconds: 300,
      heartbeatSeconds: 60,
      id: job.id,
      priority: job.priority,
      retryBackoff: true,
      retryDelay: 2,
      retryDelayMax: 3_600,
      retryLimit: Math.max(0, job.maximumAttempts - 1),
      startAfter: job.availableAfter,
    });

    if (queuedId !== job.id) {
      throw new Error('The durable job transport did not retain the canonical job identifier.');
    }
  }

  public async registerWorker(
    name: PhaseOneQueueName,
    handler: ClaimedJobHandler,
    lifecycleProjection?: DurableJobLifecycleProjection,
  ): Promise<string> {
    if (!this.started) {
      throw new Error('The pg-boss durable-job transport is not initialized.');
    }

    return this.boss.work<Record<string, unknown>>(
      name,
      {
        heartbeatRefreshSeconds: 30,
        localConcurrency: 1,
        pollingIntervalSeconds: 2,
      },
      async (jobs: Job<Record<string, unknown>>[]) => {
        for (const job of jobs) {
          const lease = lifecycleProjection
            ? await lifecycleProjection.recordLease({
                jobId: job.id,
                workerId: this.workerId,
                leaseExpiresAt: new Date(Date.now() + job.expireInSeconds * 1_000),
              })
            : undefined;

          try {
            await handler({
              id: job.id,
              name: job.name,
              data: job.data,
              signal: job.signal,
            });
            if (lease) {
              await lifecycleProjection?.recordCompletion({
                jobId: job.id,
                workerId: this.workerId,
                attemptNumber: lease.attemptNumber,
              });
            }
          } catch (error) {
            const classification = classifyJobError(error);
            if (lease) {
              await lifecycleProjection?.recordFailure({
                jobId: job.id,
                workerId: this.workerId,
                attemptNumber: lease.attemptNumber,
                classification,
              });
            }

            if (classification.disposition === 'retryable') {
              throw error;
            }
          }
        }
      },
    );
  }
}

export type JobFailureDisposition = 'retryable' | 'terminal';

export interface ClassifiedJobError {
  readonly category: JobErrorCategory;
  readonly disposition: JobFailureDisposition;
  readonly summary: string;
}

export function classifyJobError(error: unknown): ClassifiedJobError {
  const message = error instanceof Error ? error.message : 'Unknown job failure.';
  const normalized = message.toLowerCase();

  if (/(timeout|timed out)/.test(normalized)) {
    return { category: 'timeout', disposition: 'retryable', summary: 'The job timed out.' };
  }

  if (/(rate limit|too many requests)/.test(normalized)) {
    return {
      category: 'rate_limited',
      disposition: 'retryable',
      summary: 'The job was rate limited.',
    };
  }

  if (/(network|connection reset|connection refused|temporar)/.test(normalized)) {
    return {
      category: 'transient_network',
      disposition: 'retryable',
      summary: 'A transient network dependency failed.',
    };
  }

  if (/(serialization|deadlock|concurrency)/.test(normalized)) {
    return {
      category: 'concurrency_conflict',
      disposition: 'retryable',
      summary: 'A concurrent operation must be retried.',
    };
  }

  if (/(validation|schema)/.test(normalized)) {
    return {
      category: 'validation',
      disposition: 'terminal',
      summary: 'Job input validation failed.',
    };
  }

  if (/(unauthorized|forbidden|permission)/.test(normalized)) {
    return {
      category: 'unauthorized',
      disposition: 'terminal',
      summary: 'Job authorization failed.',
    };
  }

  if (/(policy|approval)/.test(normalized)) {
    return {
      category: 'policy_denied',
      disposition: 'terminal',
      summary: 'Policy denied the job.',
    };
  }

  return { category: 'unknown', disposition: 'terminal', summary: 'The job failed unexpectedly.' };
}

export function calculateRetryDelaySeconds(
  attemptCount: number,
  maximumDelaySeconds = 3_600,
): number {
  const initialDelaySeconds = 2;
  return Math.min(maximumDelaySeconds, initialDelaySeconds * 2 ** Math.max(0, attemptCount - 1));
}

export function resolveJobFailureState(
  attemptCount: number,
  maximumAttempts: number,
  classification: ClassifiedJobError,
): {
  readonly status: 'retry_wait' | 'terminal_failed';
  readonly retryDelaySeconds: number | undefined;
} {
  if (classification.disposition === 'retryable' && attemptCount < maximumAttempts) {
    return {
      status: 'retry_wait',
      retryDelaySeconds: calculateRetryDelaySeconds(attemptCount),
    };
  }

  return { status: 'terminal_failed', retryDelaySeconds: undefined };
}

export interface QueueReadinessInput {
  readonly appEnvironment: 'development' | 'test' | 'production';
  readonly started: boolean;
  readonly workerHeartbeatVerified: boolean;
}

export function getQueueFoundationStatus(input: QueueReadinessInput): {
  readonly status: 'pass' | 'fail' | 'not_initialized';
  readonly detail: string;
} {
  if (input.started && input.workerHeartbeatVerified) {
    return {
      status: 'pass',
      detail: 'The durable queue and worker heartbeat are verified.',
    };
  }

  if (input.appEnvironment === 'production') {
    return {
      status: 'fail',
      detail: 'The required durable queue or worker heartbeat has not been verified.',
    };
  }

  return {
    status: 'not_initialized',
    detail:
      'The durable queue is intentionally uninitialized for provider-free development or test.',
  };
}
