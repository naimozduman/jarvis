import type { DurableJob } from '@jarvis/contracts';
import {
  classifyJobError,
  resolveJobFailureState,
  type CanonicalJobRepository,
  type DurableJobLifecycleProjection,
} from '@jarvis/database';

export interface StatelessJobHandler {
  execute(job: DurableJob): Promise<void>;
}

export type CanonicalJobExecutionResult =
  | { readonly disposition: 'completed' | 'already_completed' | 'stale' | 'cancelled' }
  | { readonly disposition: 'retry_allowed'; readonly retryAt: number }
  | { readonly disposition: 'retry_not_allowed' };

export interface StatelessCanonicalJobExecutorOptions {
  readonly jobs: CanonicalJobRepository;
  readonly lifecycle: DurableJobLifecycleProjection;
  readonly handler: StatelessJobHandler;
  readonly workerId: string;
  readonly leaseDurationMs?: number;
  readonly now?: () => Date;
}

/**
 * A Vercel-safe canonical job claimant. The Convex callback supplies an ID and correlation ID,
 * then this executor rehydrates the full job from Neon, obtains its audited Postgres lease, and
 * executes only a registered handler. A duplicate callback cannot obtain a second successful
 * lease; a stale callback never receives the job payload.
 */
export class StatelessCanonicalJobExecutor {
  private readonly now: () => Date;
  private readonly leaseDurationMs: number;

  public constructor(private readonly options: StatelessCanonicalJobExecutorOptions) {
    this.now = options.now ?? (() => new Date());
    this.leaseDurationMs = options.leaseDurationMs ?? 300_000;
  }

  public async run(input: {
    readonly jobId: string;
    readonly correlationId: string;
  }): Promise<CanonicalJobExecutionResult> {
    const job = await this.options.jobs.load({ jobId: input.jobId });
    if (!job || job.correlationId !== input.correlationId) {
      return { disposition: 'stale' };
    }
    if (job.status === 'completed') {
      return { disposition: 'already_completed' };
    }
    if (job.status === 'cancelled' || job.status === 'terminal_failed') {
      return { disposition: 'cancelled' };
    }

    let attemptNumber: number;
    try {
      const lease = await this.options.lifecycle.recordLease({
        jobId: job.id,
        workerId: this.options.workerId,
        leaseExpiresAt: new Date(this.now().getTime() + this.leaseDurationMs),
      });
      attemptNumber = lease.attemptNumber;
    } catch {
      // The canonical record decided whether another callback owns/finished the job. Never turn
      // a lost lease into a synthetic retry or a second execution.
      return { disposition: 'stale' };
    }

    try {
      await this.options.handler.execute(job);
      await this.options.lifecycle.recordCompletion({
        jobId: job.id,
        workerId: this.options.workerId,
        attemptNumber,
      });
      return { disposition: 'completed' };
    } catch (error) {
      const classification = classifyJobError(error);
      const next = resolveJobFailureState(attemptNumber, job.maximumAttempts, classification);
      await this.options.lifecycle.recordFailure({
        jobId: job.id,
        workerId: this.options.workerId,
        attemptNumber,
        classification,
      });
      if (next.status !== 'retry_wait' || !next.retryDelaySeconds) {
        return { disposition: 'retry_not_allowed' };
      }
      return {
        disposition: 'retry_allowed',
        retryAt: this.now().getTime() + next.retryDelaySeconds * 1_000,
      };
    }
  }
}
