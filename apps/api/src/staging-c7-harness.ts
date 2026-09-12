import { randomUUID } from 'node:crypto';

import type { DurableJob } from '@jarvis/contracts';
import type {
  CanonicalEventRepository,
  CanonicalJobRepository,
  CanonicalJobRevisionRepository,
  DurableJobLifecycleProjection,
} from '@jarvis/database';
import { ingestCanonicalEvent, type EventPipelineDependencies } from '@jarvis/domain';
import {
  canonicalJobSignal,
  OrchestrationUnavailableError,
  StatelessCanonicalJobExecutor,
  type StatelessJobHandler,
} from '@jarvis/orchestration';

const c7CaseNames = [
  'stale_generation',
  'held_stale_callback',
  'cancellation',
  'rescheduling',
  'expiry',
  'retry_generation',
  'publication_recovery',
] as const;

export type StagingC7CaseName = (typeof c7CaseNames)[number];

export type StagingC7FailureCode =
  | 'fixture_not_ready'
  | 'fixture_not_quiescent'
  | 'fixture_creation_failed'
  | 'assertion_failed'
  | 'cleanup_failed'
  | 'unexpected_failure';

/** Contains only fixed case names and categories; never a database, provider, or secret error. */
export class StagingC7HarnessError extends Error {
  public constructor(
    public readonly safeCode: StagingC7FailureCode,
    public readonly safeCase?: StagingC7CaseName,
  ) {
    super(`staging_c7:${safeCode}${safeCase ? `:${safeCase}` : ''}`);
    this.name = 'StagingC7HarnessError';
  }
}

type StagingC7Lifecycle = DurableJobLifecycleProjection &
  CanonicalJobRepository &
  CanonicalJobRevisionRepository;

interface Fixture {
  readonly caseName: StagingC7CaseName;
  readonly eventId: string;
  readonly jobId: string;
  readonly correlationId: string;
}

export interface StagingC7HarnessDependencies {
  /** The route authenticates before this code runs; this value is never read from a request body. */
  readonly ownerId: string;
  readonly pipeline: EventPipelineDependencies;
  readonly lifecycle: StagingC7Lifecycle;
  readonly events: CanonicalEventRepository;
  /** The normal canonical handler only sees an unknown internal test event and marks it ignored. */
  readonly canonicalHandler: StatelessJobHandler;
  /** Verifies the dedicated non-primary test.invalid owner and that it has no active work. */
  readonly assertFixtureReady: () => Promise<boolean>;
  /** Bounded only for the canonical retry delay; it never creates a background timer or worker. */
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly now?: () => Date;
}

export interface StagingC7HarnessResult {
  readonly passed: true;
  readonly cases: readonly StagingC7CaseName[];
  readonly noActiveSyntheticWork: true;
}

function fail(code: StagingC7FailureCode, safeCase?: StagingC7CaseName): never {
  throw new StagingC7HarnessError(code, safeCase);
}

function isTerminalJob(status: DurableJob['status']): boolean {
  return status === 'completed' || status === 'terminal_failed' || status === 'cancelled';
}

function isTerminalEvent(
  status: 'received' | 'queued' | 'processing' | 'processed' | 'failed' | 'ignored',
) {
  return status === 'processed' || status === 'failed' || status === 'ignored';
}

function pastIso(now: Date): string {
  return new Date(now.getTime() - 5_000).toISOString();
}

function futureIso(now: Date): string {
  return new Date(now.getTime() + 60 * 60 * 1_000).toISOString();
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function deferred(): { readonly promise: Promise<void>; resolve(): void } {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve() {
      resolvePromise?.();
    },
  };
}

function noOpHandler(executions: { value: number }): StatelessJobHandler {
  return {
    async execute() {
      executions.value += 1;
    },
  };
}

function executor(input: {
  readonly lifecycle: DurableJobLifecycleProjection;
  readonly handler: StatelessJobHandler;
  readonly workerId: string;
}): StatelessCanonicalJobExecutor {
  return new StatelessCanonicalJobExecutor({
    lifecycle: input.lifecycle,
    handler: input.handler,
    workerId: input.workerId,
    // A harness failure must not strand a long-lived fixture lease. All expected handlers are
    // synchronous canonical operations, so this is ample for the fixed test cases.
    leaseDurationMs: 5_000,
  });
}

async function createFixture(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
  caseName: StagingC7CaseName,
): Promise<{ readonly fixture: Fixture; readonly job: DurableJob }> {
  const now = dependencies.now?.() ?? new Date();
  const runId = randomUUID();
  const idempotencyKey = `staging-c7:${runId}:${caseName}`;
  const result = await ingestCanonicalEvent(dependencies.pipeline, {
    ownerId: dependencies.ownerId,
    envelope: {
      // No deterministic handler is registered for this test-only event, so the normal canonical
      // handler can retire it as ignored without entering Brain, a model gateway, or transport.
      eventType: 'internal.staging.c7.lifecycle.v1',
      source: 'internal',
      sourceEventId: idempotencyKey,
      idempotencyKey,
      occurredAt: now.toISOString(),
      schemaVersion: 1,
      payload: { kind: 'staging_c7_lifecycle_fixture', case: caseName },
      correlationId: randomUUID(),
    },
    receivedAt: now.toISOString(),
    correlationId: randomUUID(),
  });
  if (result.duplicate || !result.job) {
    fail('fixture_creation_failed', caseName);
  }
  const fixture: Fixture = {
    caseName,
    eventId: result.event.id,
    jobId: result.job.id,
    correlationId: result.job.correlationId,
  };
  fixtures.push(fixture);
  const job = await dependencies.lifecycle.load({ jobId: fixture.jobId });
  if (!job || job.ownerId !== dependencies.ownerId || job.dispatchGeneration !== 1) {
    fail('fixture_creation_failed', caseName);
  }
  return { fixture, job };
}

async function retireFixture(
  dependencies: StagingC7HarnessDependencies,
  fixture: Fixture,
): Promise<void> {
  const current = await dependencies.lifecycle.load({ jobId: fixture.jobId });
  if (!current || current.ownerId !== dependencies.ownerId) {
    fail('cleanup_failed', fixture.caseName);
  }
  if (!isTerminalJob(current.status)) {
    const cancelled = await dependencies.lifecycle.cancelPending({
      jobId: current.id,
      expectedGeneration: current.dispatchGeneration,
    });
    if (cancelled.disposition !== 'cancelled' && cancelled.disposition !== 'already_cancelled') {
      fail('cleanup_failed', fixture.caseName);
    }
  }

  const event = await dependencies.events.load({
    ownerId: dependencies.ownerId,
    eventId: fixture.eventId,
  });
  if (!event) {
    fail('cleanup_failed', fixture.caseName);
  }
  if (!isTerminalEvent(event.processingStatus)) {
    await dependencies.events.markIgnored({
      event,
      summary: 'The fixed staging C.7 lifecycle fixture was retired without external processing.',
    });
  }

  const finalJob = await dependencies.lifecycle.load({ jobId: fixture.jobId });
  if (!finalJob || !isTerminalJob(finalJob.status)) {
    fail('cleanup_failed', fixture.caseName);
  }
}

async function runStaleGeneration(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'stale_generation');
  const now = dependencies.now?.() ?? new Date();
  const revised = await dependencies.lifecycle.reschedule({
    jobId: job.id,
    expectedGeneration: job.dispatchGeneration,
    scheduledFor: pastIso(now),
    availableAfter: pastIso(now),
    executionDeadline: null,
  });
  if (revised.disposition !== 'rescheduled' || revised.job.dispatchGeneration !== 2) {
    fail('assertion_failed', fixture.caseName);
  }

  const executions = { value: 0 };
  const result = await executor({
    lifecycle: dependencies.lifecycle,
    handler: noOpHandler(executions),
    workerId: 'staging-c7-stale-generation',
  }).run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: job.dispatchGeneration,
  });
  if (result.disposition !== 'stale' || executions.value !== 0) {
    fail('assertion_failed', fixture.caseName);
  }
}

async function runHeldStaleCallback(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'held_stale_callback');
  const entered = deferred();
  const release = deferred();
  const heldLifecycle: DurableJobLifecycleProjection = {
    async recordLease(input) {
      entered.resolve();
      await release.promise;
      return dependencies.lifecycle.recordLease(input);
    },
    recordCompletion: (input) => dependencies.lifecycle.recordCompletion(input),
    recordFailure: (input) => dependencies.lifecycle.recordFailure(input),
  };
  const executions = { value: 0 };
  const callback = executor({
    lifecycle: heldLifecycle,
    handler: noOpHandler(executions),
    workerId: 'staging-c7-held-callback',
  }).run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: job.dispatchGeneration,
  });

  await entered.promise;
  const now = dependencies.now?.() ?? new Date();
  let revised;
  try {
    revised = await dependencies.lifecycle.reschedule({
      jobId: job.id,
      expectedGeneration: job.dispatchGeneration,
      scheduledFor: pastIso(now),
      availableAfter: pastIso(now),
      executionDeadline: null,
    });
  } finally {
    release.resolve();
  }
  const result = await callback;
  if (
    revised.disposition !== 'rescheduled' ||
    revised.job.dispatchGeneration !== 2 ||
    result.disposition !== 'stale' ||
    executions.value !== 0
  ) {
    fail('assertion_failed', fixture.caseName);
  }
}

async function runCancellation(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'cancellation');
  const cancelled = await dependencies.lifecycle.cancelPending({
    jobId: job.id,
    expectedGeneration: job.dispatchGeneration,
  });
  if (cancelled.disposition !== 'cancelled' || cancelled.job.dispatchGeneration !== 2) {
    fail('assertion_failed', fixture.caseName);
  }
  const executions = { value: 0 };
  const result = await executor({
    lifecycle: dependencies.lifecycle,
    handler: noOpHandler(executions),
    workerId: 'staging-c7-cancellation',
  }).run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: cancelled.job.dispatchGeneration,
  });
  if (result.disposition !== 'cancelled' || executions.value !== 0) {
    fail('assertion_failed', fixture.caseName);
  }
}

async function runRescheduling(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'rescheduling');
  const now = dependencies.now?.() ?? new Date();
  const revised = await dependencies.lifecycle.reschedule({
    jobId: job.id,
    expectedGeneration: job.dispatchGeneration,
    scheduledFor: futureIso(now),
    availableAfter: futureIso(now),
    executionDeadline: null,
  });
  if (
    revised.disposition !== 'rescheduled' ||
    revised.job.dispatchGeneration !== 2 ||
    revised.job.attemptCount !== 0
  ) {
    fail('assertion_failed', fixture.caseName);
  }
  const executions = { value: 0 };
  const result = await executor({
    lifecycle: dependencies.lifecycle,
    handler: noOpHandler(executions),
    workerId: 'staging-c7-rescheduling',
  }).run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: job.dispatchGeneration,
  });
  if (result.disposition !== 'stale' || executions.value !== 0) {
    fail('assertion_failed', fixture.caseName);
  }
}

async function runExpiry(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'expiry');
  const now = dependencies.now?.() ?? new Date();
  const revised = await dependencies.lifecycle.reschedule({
    jobId: job.id,
    expectedGeneration: job.dispatchGeneration,
    scheduledFor: pastIso(now),
    availableAfter: pastIso(now),
    executionDeadline: pastIso(now),
  });
  if (revised.disposition !== 'rescheduled' || revised.job.dispatchGeneration !== 2) {
    fail('assertion_failed', fixture.caseName);
  }
  const executions = { value: 0 };
  const result = await executor({
    lifecycle: dependencies.lifecycle,
    handler: noOpHandler(executions),
    workerId: 'staging-c7-expiry',
  }).run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: revised.job.dispatchGeneration,
  });
  const expired = await dependencies.lifecycle.load({ jobId: job.id });
  if (
    result.disposition !== 'expired' ||
    executions.value !== 0 ||
    !expired ||
    expired.status !== 'terminal_failed' ||
    expired.lastErrorCategory !== 'expired'
  ) {
    fail('assertion_failed', fixture.caseName);
  }
}

async function runRetryGeneration(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'retry_generation');
  const retrying = executor({
    lifecycle: dependencies.lifecycle,
    handler: {
      async execute() {
        throw new Error('temporary network failure for the fixed staging C.7 retry fixture');
      },
    },
    workerId: 'staging-c7-retry-first-attempt',
  });
  const first = await retrying.run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: job.dispatchGeneration,
  });
  if (first.disposition !== 'retry_allowed') {
    fail('assertion_failed', fixture.caseName);
  }
  const waiting = await dependencies.lifecycle.load({ jobId: job.id });
  if (
    !waiting ||
    waiting.status !== 'retry_wait' ||
    waiting.dispatchGeneration !== job.dispatchGeneration ||
    waiting.attemptCount !== 1
  ) {
    fail('assertion_failed', fixture.caseName);
  }

  const delay = Math.max(0, first.retryAt - Date.now()) + 50;
  if (!Number.isFinite(delay) || delay > 5_000) {
    fail('assertion_failed', fixture.caseName);
  }
  await (dependencies.wait ?? defaultWait)(delay);

  const completed = await executor({
    lifecycle: dependencies.lifecycle,
    handler: dependencies.canonicalHandler,
    workerId: 'staging-c7-retry-second-attempt',
  }).run({
    jobId: job.id,
    correlationId: job.correlationId,
    generation: job.dispatchGeneration,
  });
  const final = await dependencies.lifecycle.load({ jobId: job.id });
  if (
    completed.disposition !== 'completed' ||
    !final ||
    final.status !== 'completed' ||
    final.dispatchGeneration !== job.dispatchGeneration ||
    final.attemptCount !== 2
  ) {
    fail('assertion_failed', fixture.caseName);
  }
}

async function simulateUnavailablePublication(): Promise<void> {
  throw new OrchestrationUnavailableError();
}

async function runPublicationRecovery(
  dependencies: StagingC7HarnessDependencies,
  fixtures: Fixture[],
): Promise<void> {
  const { fixture, job } = await createFixture(dependencies, fixtures, 'publication_recovery');
  const originalSignal = canonicalJobSignal(job);
  let unavailable = false;
  try {
    // The fault is deliberately injected after canonical ingress. With Convex held paused, the
    // suite must prove the Neon recovery record without creating an opaque scheduled job.
    await simulateUnavailablePublication();
  } catch (error) {
    unavailable = error instanceof OrchestrationUnavailableError;
  }
  const recovered = await dependencies.lifecycle.load({ jobId: job.id });
  if (!unavailable || !recovered || recovered.status !== 'queued') {
    fail('assertion_failed', fixture.caseName);
  }
  const recoverySignal = canonicalJobSignal(recovered);
  const allowedFields = [
    'correlationId',
    'generation',
    'jobId',
    'maximumDispatchAttempts',
    'scheduledAt',
    'triggerType',
  ];
  if (
    JSON.stringify(Object.keys(recoverySignal).sort()) !== JSON.stringify(allowedFields) ||
    recoverySignal.jobId !== originalSignal.jobId ||
    recoverySignal.correlationId !== originalSignal.correlationId ||
    recoverySignal.generation !== originalSignal.generation ||
    recoverySignal.triggerType !== originalSignal.triggerType
  ) {
    fail('assertion_failed', fixture.caseName);
  }
}

function safeError(error: unknown): StagingC7HarnessError {
  return error instanceof StagingC7HarnessError
    ? error
    : new StagingC7HarnessError('unexpected_failure');
}

/**
 * Runs the exact remaining C.7 lifecycle cases with no caller-controlled action, IDs, payload,
 * schedule, or owner. It does not talk to Convex while the coordinator remains paused; the
 * publication case verifies that a post-commit opaque-publication failure leaves one recoverable
 * Neon record and one fixed opaque signal projection.
 */
export async function runStagingC7Harness(
  dependencies: StagingC7HarnessDependencies,
): Promise<StagingC7HarnessResult> {
  if (!(await dependencies.assertFixtureReady())) {
    fail('fixture_not_ready');
  }

  const fixtures: Fixture[] = [];
  let failure: StagingC7HarnessError | undefined;
  try {
    await runStaleGeneration(dependencies, fixtures);
    await runHeldStaleCallback(dependencies, fixtures);
    await runCancellation(dependencies, fixtures);
    await runRescheduling(dependencies, fixtures);
    await runExpiry(dependencies, fixtures);
    await runRetryGeneration(dependencies, fixtures);
    await runPublicationRecovery(dependencies, fixtures);
  } catch (error) {
    failure = safeError(error);
  }

  try {
    for (const fixture of fixtures) {
      await retireFixture(dependencies, fixture);
    }
    if (!(await dependencies.assertFixtureReady())) {
      fail('fixture_not_quiescent');
    }
  } catch (error) {
    failure ??= safeError(error);
  }
  if (failure) {
    throw failure;
  }
  return {
    passed: true,
    cases: c7CaseNames,
    noActiveSyntheticWork: true,
  };
}
