import type { DurableJob } from '@jarvis/contracts';
import type { CanonicalJobRepository } from '@jarvis/database';
import { canonicalJobSignal, type OrchestrationPublisher } from '@jarvis/orchestration';

export const phase3d1RecoveryTarget = {
  jobId: '279bc54a-358b-4445-8460-acfc4af45384',
  eventId: '4586c188-91b1-48e5-9fea-3aff4c2a237a',
  ownerId: '36c20000-0000-4000-8000-000000000900',
  generation: 1,
} as const;

export class Phase3d1RecoveryRefusedError extends Error {
  public constructor() {
    super('phase_3_6d1_recovery_refused');
    this.name = 'Phase3d1RecoveryRefusedError';
  }
}

function isExactRecoverableTarget(job: DurableJob | undefined): job is DurableJob {
  return Boolean(
    job &&
    job.id === phase3d1RecoveryTarget.jobId &&
    job.sourceEventId === phase3d1RecoveryTarget.eventId &&
    job.ownerId === phase3d1RecoveryTarget.ownerId &&
    job.jobType === 'jarvis.event.process' &&
    job.dispatchGeneration === phase3d1RecoveryTarget.generation &&
    job.status === 'queued' &&
    job.attemptCount === 0 &&
    job.leaseOwner === null &&
    job.leaseExpiresAt === null &&
    job.completedAt === null,
  );
}

export interface Phase3d1JobRecoveryDependencies {
  readonly jobs: Pick<CanonicalJobRepository, 'load'>;
  readonly orchestration: Pick<OrchestrationPublisher, 'scheduleJob'>;
}

/**
 * Republishes one pre-authorized canonical job snapshot without mutating Neon or invoking Brain.
 * There are no caller-supplied selectors; the coordinator receives only the canonical opaque
 * signal and treats the same job/generation as idempotent.
 */
export async function recoverPhase3d1ExistingJob(
  dependencies: Phase3d1JobRecoveryDependencies,
): Promise<{ readonly jobId: string; readonly generation: 1; readonly published: true }> {
  const job = await dependencies.jobs.load({ jobId: phase3d1RecoveryTarget.jobId });
  if (!isExactRecoverableTarget(job)) {
    throw new Phase3d1RecoveryRefusedError();
  }
  await dependencies.orchestration.scheduleJob(canonicalJobSignal(job));
  return { jobId: phase3d1RecoveryTarget.jobId, generation: 1, published: true };
}
