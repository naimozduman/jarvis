import type { DurableJob } from '@jarvis/contracts';
import { classifyJobError, type DurableJobLifecycleProjection } from '@jarvis/database';

export interface StatelessJobHandler {
  execute(job: DurableJob): Promise<void>;
}

export type CanonicalJobExecutionResult =
  | {
      readonly disposition: 'completed' | 'already_completed' | 'stale' | 'cancelled' | 'expired';
    }
  | { readonly disposition: 'retry_allowed'; readonly retryAt: number }
  | { readonly disposition: 'retry_not_allowed' };

export interface StatelessCanonicalJobExecutorOptions {
  readonly lifecycle: DurableJobLifecycleProjection;
  readonly handler: StatelessJobHandler;
  readonly workerId: string;
  readonly leaseDurationMs?: number;
}

/**
 * Vercel-safe canonical job claimant. The callback can supply only opaque identity and the Neon
 * generation it was scheduled for. `recordLease` performs the authoritative conditional update
 * and returns the exact current payload snapshot; this executor never runs an earlier read.
 */
export class StatelessCanonicalJobExecutor {
  private readonly leaseDurationMs: number;

  public constructor(private readonly options: StatelessCanonicalJobExecutorOptions) {
    this.leaseDurationMs = options.leaseDurationMs ?? 300_000;
  }

  public async run(input: {
    readonly jobId: string;
    readonly correlationId: string;
    readonly generation: number;
  }): Promise<CanonicalJobExecutionResult> {
    const lease = await this.options.lifecycle.recordLease({
      jobId: input.jobId,
      expectedGeneration: input.generation,
      expectedCorrelationId: input.correlationId,
      workerId: this.options.workerId,
      leaseDurationMilliseconds: this.leaseDurationMs,
    });
    if (lease.disposition !== 'claimed') {
      return { disposition: lease.disposition };
    }

    try {
      await this.options.handler.execute(lease.job);
      await this.options.lifecycle.recordCompletion({
        jobId: lease.job.id,
        expectedGeneration: lease.job.dispatchGeneration,
        workerId: this.options.workerId,
        attemptNumber: lease.attemptNumber,
      });
      return { disposition: 'completed' };
    } catch (error) {
      const classification = classifyJobError(error);
      const result = await this.options.lifecycle.recordFailure({
        jobId: lease.job.id,
        expectedGeneration: lease.job.dispatchGeneration,
        workerId: this.options.workerId,
        attemptNumber: lease.attemptNumber,
        classification,
      });
      if (result.status !== 'retry_wait' || result.retryAt === null) {
        return { disposition: 'retry_not_allowed' };
      }
      return {
        disposition: 'retry_allowed',
        retryAt: Date.parse(result.retryAt),
      };
    }
  }
}
