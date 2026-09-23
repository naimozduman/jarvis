import { describe, expect, it, vi } from 'vitest';

import type { DurableJob } from '@jarvis/contracts';

import {
  phase3d1RecoveryTarget,
  Phase3d1RecoveryRefusedError,
  recoverPhase3d1ExistingJob,
} from '../src/phase-3-6d1-job-recovery.js';

function exactJob(overrides: Partial<DurableJob> = {}): DurableJob {
  return {
    id: phase3d1RecoveryTarget.jobId,
    ownerId: phase3d1RecoveryTarget.ownerId,
    jobType: 'jarvis.event.process',
    payload: { eventId: phase3d1RecoveryTarget.eventId },
    status: 'queued',
    priority: 0,
    scheduledFor: '2026-09-22T22:26:23.000Z',
    availableAfter: '2026-09-22T22:26:23.000Z',
    executionDeadline: null,
    dispatchGeneration: 1,
    attemptCount: 0,
    maximumAttempts: 5,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCategory: null,
    lastErrorSummary: null,
    createdAt: '2026-09-22T22:26:23.000Z',
    updatedAt: '2026-09-22T22:26:23.000Z',
    completedAt: null,
    correlationId: '78e54c94-482b-498e-beb3-ec00506d4409',
    sourceEventId: phase3d1RecoveryTarget.eventId,
    idempotencyKey: 'phase-3-6d1-existing-job-only',
    ...overrides,
  };
}

describe('Phase 3.6D.1 exact existing-job recovery', () => {
  it('reloads the fixed Neon row and publishes only its canonical opaque signal', async () => {
    const job = exactJob();
    const load = vi.fn().mockResolvedValue(job);
    const scheduleJob = vi.fn().mockResolvedValue(undefined);

    const result = await recoverPhase3d1ExistingJob({
      jobs: { load },
      orchestration: { scheduleJob },
    });

    expect(load).toHaveBeenCalledWith({ jobId: phase3d1RecoveryTarget.jobId });
    expect(scheduleJob).toHaveBeenCalledWith({
      jobId: phase3d1RecoveryTarget.jobId,
      correlationId: job.correlationId,
      triggerType: 'canonical_job',
      scheduledAt: job.availableAfter,
      generation: 1,
      maximumDispatchAttempts: job.maximumAttempts,
    });
    expect(scheduleJob.mock.calls[0]?.[0]).not.toHaveProperty('payload');
    expect(result).toEqual({
      jobId: phase3d1RecoveryTarget.jobId,
      generation: 1,
      published: true,
    });
  });

  it.each([
    ['missing row', undefined],
    ['different job', exactJob({ id: '36c20000-0000-4000-8000-000000000901' })],
    ['different event', exactJob({ sourceEventId: '36c20000-0000-4000-8000-000000000902' })],
    ['different owner', exactJob({ ownerId: '36c20000-0000-4000-8000-000000000903' })],
    ['different job type', exactJob({ jobType: 'jarvis.reminder.fire' })],
    ['different generation', exactJob({ dispatchGeneration: 2 })],
    ['non-queued state', exactJob({ status: 'retry_wait' })],
    ['attempted job', exactJob({ attemptCount: 1 })],
    ['lease owner', exactJob({ leaseOwner: 'worker' })],
    ['lease expiry', exactJob({ leaseExpiresAt: '2026-09-22T22:30:00.000Z' })],
    ['completed job', exactJob({ completedAt: '2026-09-22T22:30:00.000Z' })],
  ])('refuses %s without publishing', async (_label, job) => {
    const scheduleJob = vi.fn();

    await expect(
      recoverPhase3d1ExistingJob({
        jobs: { load: vi.fn().mockResolvedValue(job) },
        orchestration: { scheduleJob },
      }),
    ).rejects.toBeInstanceOf(Phase3d1RecoveryRefusedError);
    expect(scheduleJob).not.toHaveBeenCalled();
  });

  it('reconstructs the identical coordinator key on a repeated recovery attempt', async () => {
    const signals: unknown[] = [];
    const dependencies = {
      jobs: { load: vi.fn().mockResolvedValue(exactJob()) },
      orchestration: {
        scheduleJob: vi.fn(async (signal) => {
          signals.push(signal);
        }),
      },
    };

    await recoverPhase3d1ExistingJob(dependencies);
    await recoverPhase3d1ExistingJob(dependencies);

    expect(signals).toHaveLength(2);
    expect(signals[1]).toEqual(signals[0]);
    expect(signals[0]).toMatchObject({
      jobId: phase3d1RecoveryTarget.jobId,
      generation: phase3d1RecoveryTarget.generation,
    });
  });
});
