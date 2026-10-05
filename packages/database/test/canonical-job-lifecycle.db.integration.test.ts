import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, test } from 'vitest';

import type { DurableJob } from '@jarvis/contracts';
import {
  commitments,
  createDatabaseRuntime,
  DrizzleDurableJobLifecycleProjection,
  jobExecutions,
  jobs,
  owners,
  type DurableJobLifecycleProjection,
} from '@jarvis/database';
import { StatelessCanonicalJobExecutor } from '@jarvis/orchestration';

const testDatabaseUrl = process.env.JARVIS_TEST_DATABASE_URL;
const secondaryTestDatabaseUrl = process.env.JARVIS_TEST_DATABASE_SECONDARY_URL;
const migrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');
const journalPath = resolve(migrationRoot, 'meta/_journal.json');
const workerOne = 'c36c3-test-worker-one';
const workerTwo = 'c36c3-test-worker-two';

function assertDedicatedLocalTestDatabase(url: string): void {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const databaseName = parsed.pathname.replace(/^\//, '').toLowerCase();
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

  if (!localHosts.has(host) || !databaseName.includes('test')) {
    throw new Error(
      'JARVIS_TEST_DATABASE_URL must name an isolated local/container PostgreSQL test database.',
    );
  }
}

function secondaryDatabaseUrl(): string {
  if (!testDatabaseUrl || !secondaryTestDatabaseUrl) {
    throw new Error(
      'JARVIS_TEST_DATABASE_URL and JARVIS_TEST_DATABASE_SECONDARY_URL are required for concurrent database coverage.',
    );
  }
  assertDedicatedLocalTestDatabase(testDatabaseUrl);
  assertDedicatedLocalTestDatabase(secondaryTestDatabaseUrl);
  const primary = new URL(testDatabaseUrl);
  const secondary = new URL(secondaryTestDatabaseUrl);
  const primaryDatabase = primary.pathname.replace(/^\//, '').toLowerCase();
  const secondaryDatabase = secondary.pathname.replace(/^\//, '').toLowerCase();
  if (
    primaryDatabase !== secondaryDatabase ||
    !primary.username ||
    !secondary.username ||
    primary.username === secondary.username
  ) {
    throw new Error(
      'The primary and secondary test URLs must use distinct PostgreSQL roles against the same disposable database.',
    );
  }
  return secondaryTestDatabaseUrl;
}

function secondaryRoleName(): string | undefined {
  if (!secondaryTestDatabaseUrl) return undefined;

  const roleName = decodeURIComponent(new URL(secondaryTestDatabaseUrl).username);
  if (!/^[a-z_][a-z0-9_$]{0,62}$/i.test(roleName)) {
    throw new Error(
      'JARVIS_TEST_DATABASE_SECONDARY_URL must use a conventional PostgreSQL role name.',
    );
  }
  return roleName;
}

function quotePostgresIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
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

async function resetApplicationSchemas(url: string): Promise<void> {
  const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
  try {
    // The test URL is checked above and must point at a disposable local database. These are the
    // only application schemas created by this suite; no DATABASE_URL is ever consulted.
    await runtime.pool.query('DROP SCHEMA IF EXISTS jarvis CASCADE');
    await runtime.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  } finally {
    await runtime.close();
  }
}

async function migrateFull(url: string): Promise<void> {
  const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
  try {
    await migrate(runtime.db, { migrationsFolder: migrationRoot });
    const secondaryRole = secondaryRoleName();
    if (secondaryRole) {
      secondaryDatabaseUrl();
      const role = quotePostgresIdentifier(secondaryRole);
      // The secondary connection represents a separate worker. It can only exercise the canonical
      // lifecycle tables required by these races; schema reset and migrations remain primary-only.
      await runtime.pool.query(`GRANT USAGE ON SCHEMA jarvis TO ${role}`);
      await runtime.pool.query(
        `GRANT SELECT, INSERT, UPDATE ON TABLE jarvis.jobs, jarvis.job_executions, jarvis.audit_events TO ${role}`,
      );
    }
  } finally {
    await runtime.close();
  }
}

async function migrateThrough0006(url: string): Promise<void> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'jarvis-c36c3-migrations-'));
  try {
    const rawJournal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      version: string;
      dialect: string;
      entries: Array<{
        readonly idx: number;
        readonly tag: string;
        readonly [key: string]: unknown;
      }>;
    };
    const entries = rawJournal.entries.filter((entry) => entry.idx <= 6);
    await mkdir(resolve(temporaryRoot, 'meta'), { recursive: true });
    await Promise.all(
      entries.map((entry) =>
        copyFile(
          resolve(migrationRoot, `${entry.tag}.sql`),
          resolve(temporaryRoot, `${entry.tag}.sql`),
        ),
      ),
    );
    await writeFile(
      resolve(temporaryRoot, 'meta', '_journal.json'),
      `${JSON.stringify({ ...rawJournal, entries }, null, 2)}\n`,
      'utf8',
    );
    const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
    try {
      await migrate(runtime.db, { migrationsFolder: temporaryRoot });
    } finally {
      await runtime.close();
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function seedJob(
  url: string,
  input: {
    readonly jobType?: string;
    readonly executionDeadline?: Date | null;
    readonly generation?: number;
    readonly availableAfter?: Date;
    readonly scheduledFor?: Date;
    readonly payload?: Record<string, unknown>;
  } = {},
): Promise<{
  readonly ownerId: string;
  readonly jobId: string;
  readonly correlationId: string;
}> {
  const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
  const ownerId = randomUUID();
  const jobId = randomUUID();
  const correlationId = randomUUID();
  const past = new Date('2020-01-01T00:00:00.000Z');
  try {
    await runtime.db.insert(owners).values({
      id: ownerId,
      emailNormalized: `${ownerId}@test.invalid`,
      displayName: 'Phase 3.6C.3 synthetic owner',
      timezone: 'UTC',
      isPrimary: false,
    });
    await runtime.db.insert(jobs).values({
      id: jobId,
      ownerId,
      jobType: input.jobType ?? 'jarvis.event.process',
      payload: input.payload ?? { eventId: randomUUID(), ownerId },
      status: 'queued',
      priority: 0,
      scheduledFor: input.scheduledFor ?? past,
      availableAfter: input.availableAfter ?? past,
      executionDeadline: input.executionDeadline ?? null,
      dispatchGeneration: input.generation ?? 1,
      maximumAttempts: 3,
      correlationId,
      idempotencyKey: `c36c3-job:${jobId}`,
    });
    return { ownerId, jobId, correlationId };
  } finally {
    await runtime.close();
  }
}

async function loadJob(url: string, jobId: string): Promise<typeof jobs.$inferSelect> {
  const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
  try {
    const [current] = await runtime.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!current) throw new Error('The synthetic canonical job was unexpectedly absent.');
    return current;
  } finally {
    await runtime.close();
  }
}

function lifecycle(url: string): {
  readonly lifecycle: DrizzleDurableJobLifecycleProjection;
  close(): Promise<void>;
} {
  const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
  return {
    lifecycle: new DrizzleDurableJobLifecycleProjection(runtime.db),
    close: () => runtime.close(),
  };
}

function executor(input: {
  readonly lifecycle: DurableJobLifecycleProjection;
  readonly executions: { value: number };
}): StatelessCanonicalJobExecutor {
  return new StatelessCanonicalJobExecutor({
    lifecycle: input.lifecycle,
    workerId: 'c36c3-callback-executor',
    handler: {
      async execute(job: DurableJob) {
        void job;
        input.executions.value += 1;
      },
    },
  });
}

describe.sequential('canonical generation and execution expiry with real PostgreSQL', () => {
  test.skipIf(!testDatabaseUrl)(
    'migrates a fresh disposable database through the full chain',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      await resetApplicationSchemas(url);
      await migrateFull(url);

      const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
      try {
        const columns = await runtime.pool.query<{
          readonly column_name: string;
          readonly is_nullable: string;
          readonly column_default: string | null;
        }>(
          "select column_name, is_nullable, column_default from information_schema.columns where table_schema = 'jarvis' and table_name = 'jobs' and column_name in ('dispatch_generation', 'execution_deadline') order by column_name",
        );
        expect(columns.rows).toEqual([
          { column_name: 'dispatch_generation', is_nullable: 'NO', column_default: '1' },
          { column_name: 'execution_deadline', is_nullable: 'YES', column_default: null },
        ]);
        const participantId = await runtime.pool.query<{
          readonly is_nullable: string;
          readonly column_default: string | null;
        }>(
          "select is_nullable, column_default from information_schema.columns where table_schema = 'jarvis' and table_name = 'telegram_bot_participants' and column_name = 'id'",
        );
        expect(participantId.rows).toEqual([
          { is_nullable: 'NO', column_default: 'gen_random_uuid()' },
        ]);
      } finally {
        await runtime.close();
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'upgrades representative schema-through-0006 rows without expiry',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      await resetApplicationSchemas(url);
      await migrateThrough0006(url);

      const runtime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
      const ownerId = randomUUID();
      const jobId = randomUUID();
      const correlationId = randomUUID();
      try {
        await runtime.db.insert(owners).values({
          id: ownerId,
          emailNormalized: `${ownerId}@test.invalid`,
          displayName: 'Phase 3.6C.3 upgrade owner',
          timezone: 'UTC',
          isPrimary: false,
        });
        // Use the actual 0006 column set here. The current Drizzle schema intentionally knows
        // about 0007, so it cannot be used to prove that a pre-0007 row upgrades safely.
        await runtime.pool.query(
          "insert into jarvis.jobs (id, owner_id, job_type, payload, status, priority, scheduled_for, available_after, attempt_count, maximum_attempts, correlation_id, idempotency_key) values ($1, $2, $3, $4::jsonb, 'queued', 0, $5, $6, 0, $7, $8, $9)",
          [
            jobId,
            ownerId,
            'jarvis.event.process',
            JSON.stringify({ eventId: randomUUID(), ownerId }),
            new Date('2020-01-01T00:00:00.000Z'),
            new Date('2020-01-01T00:00:00.000Z'),
            3,
            correlationId,
            `c36c3-upgrade-job:${jobId}`,
          ],
        );
        await runtime.pool.query(
          "insert into jarvis.job_executions (owner_id, job_id, worker_id, attempt_number, status, leased_at, correlation_id) values ($1, $2, $3, 1, 'leased', $4, $5)",
          [ownerId, jobId, workerOne, new Date('2020-01-01T00:00:00.000Z'), correlationId],
        );
      } finally {
        await runtime.close();
      }

      await migrateFull(url);
      const upgraded = await loadJob(url, jobId);
      expect(upgraded.dispatchGeneration).toBe(1);
      expect(upgraded.executionDeadline).toBeNull();
      const verifyRuntime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
      try {
        const [execution] = await verifyRuntime.db
          .select()
          .from(jobExecutions)
          .where(eq(jobExecutions.jobId, jobId));
        expect(execution?.dispatchGeneration).toBe(1);
      } finally {
        await verifyRuntime.close();
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'allows exactly one matching-generation lease across separate connections',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const secondaryUrl = secondaryDatabaseUrl();
      const fixture = await seedJob(url);
      const first = lifecycle(url);
      const second = lifecycle(secondaryUrl);
      const firstReady = deferred();
      const secondReady = deferred();
      const release = deferred();
      try {
        const claim = async (
          target: DrizzleDurableJobLifecycleProjection,
          ready: { resolve(): void },
          workerId: string,
        ) => {
          ready.resolve();
          await release.promise;
          return target.recordLease({
            jobId: fixture.jobId,
            expectedGeneration: 1,
            expectedCorrelationId: fixture.correlationId,
            workerId,
            leaseDurationMilliseconds: 60_000,
          });
        };
        const firstClaim = claim(first.lifecycle, firstReady, workerOne);
        const secondClaim = claim(second.lifecycle, secondReady, workerTwo);
        await Promise.all([firstReady.promise, secondReady.promise]);
        release.resolve();
        const results = await Promise.all([firstClaim, secondClaim]);

        expect(results.filter((result) => result.disposition === 'claimed')).toHaveLength(1);
        expect(results.filter((result) => result.disposition === 'stale')).toHaveLength(1);
        const canonical = await loadJob(url, fixture.jobId);
        expect(canonical.status).toBe('leased');
        expect(canonical.attemptCount).toBe(1);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'rejects a held old callback after a canonical reschedule advances generation',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const secondaryUrl = secondaryDatabaseUrl();
      const fixture = await seedJob(url);
      const primary = lifecycle(url);
      const reviser = lifecycle(secondaryUrl);
      const leaseEntered = deferred();
      const releaseLease = deferred();
      const executions = { value: 0 };
      const blockingLifecycle: DurableJobLifecycleProjection = {
        async recordLease(input) {
          leaseEntered.resolve();
          await releaseLease.promise;
          return primary.lifecycle.recordLease(input);
        },
        recordCompletion: (input) => primary.lifecycle.recordCompletion(input),
        recordFailure: (input) => primary.lifecycle.recordFailure(input),
      };
      try {
        const running = executor({ lifecycle: blockingLifecycle, executions }).run({
          jobId: fixture.jobId,
          correlationId: fixture.correlationId,
          generation: 1,
        });
        await leaseEntered.promise;
        const revised = await reviser.lifecycle.reschedule({
          jobId: fixture.jobId,
          expectedGeneration: 1,
          scheduledFor: '2020-01-01T00:00:00.000Z',
          availableAfter: '2020-01-01T00:00:00.000Z',
          executionDeadline: null,
        });
        expect(revised.disposition).toBe('rescheduled');
        releaseLease.resolve();

        await expect(running).resolves.toEqual({ disposition: 'stale' });
        expect(executions.value).toBe(0);
        expect((await loadJob(url, fixture.jobId)).dispatchGeneration).toBe(2);
      } finally {
        await Promise.all([primary.close(), reviser.close()]);
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'advances generation for a replacement while ordinary retries retain it',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const secondaryUrl = secondaryDatabaseUrl();
      const replaceFixture = await seedJob(url);
      const retryFixture = await seedJob(url);
      const replaceRuntime = lifecycle(secondaryUrl);
      const retryRuntime = lifecycle(url);
      try {
        const originalLease = await replaceRuntime.lifecycle.recordLease({
          jobId: replaceFixture.jobId,
          expectedGeneration: 1,
          expectedCorrelationId: replaceFixture.correlationId,
          workerId: workerOne,
          leaseDurationMilliseconds: 60_000,
        });
        expect(originalLease.disposition).toBe('claimed');
        if (originalLease.disposition !== 'claimed') {
          throw new Error('The synthetic replacement fixture did not acquire its first lease.');
        }
        await expect(
          replaceRuntime.lifecycle.recordFailure({
            jobId: replaceFixture.jobId,
            expectedGeneration: 1,
            workerId: workerOne,
            attemptNumber: originalLease.attemptNumber,
            classification: {
              category: 'transient_network',
              disposition: 'retryable',
              summary: 'A transient network dependency failed.',
            },
          }),
        ).resolves.toMatchObject({ status: 'retry_wait' });

        const replacement = await replaceRuntime.lifecycle.replacePendingInstruction({
          jobId: replaceFixture.jobId,
          expectedGeneration: 1,
          payload: { eventId: 'replacement-event', ownerId: replaceFixture.ownerId },
          scheduledFor: '2020-01-01T00:00:00.000Z',
          availableAfter: '2020-01-01T00:00:00.000Z',
          executionDeadline: null,
        });
        expect(replacement.disposition).toBe('replaced');
        if (replacement.disposition === 'replaced') {
          expect(replacement.job.dispatchGeneration).toBe(2);
          expect(replacement.job.attemptCount).toBe(0);
          expect(replacement.job.payload).toEqual({
            eventId: 'replacement-event',
            ownerId: replaceFixture.ownerId,
          });
        }

        const replacementLease = await retryRuntime.lifecycle.recordLease({
          jobId: replaceFixture.jobId,
          expectedGeneration: 2,
          expectedCorrelationId: replaceFixture.correlationId,
          workerId: workerTwo,
          leaseDurationMilliseconds: 60_000,
        });
        expect(replacementLease).toMatchObject({ disposition: 'claimed', attemptNumber: 1 });
        const executionRuntime = createDatabaseRuntime({
          connectionString: url,
          maxConnections: 1,
        });
        try {
          const executionRows = await executionRuntime.db
            .select({
              dispatchGeneration: jobExecutions.dispatchGeneration,
              attemptNumber: jobExecutions.attemptNumber,
            })
            .from(jobExecutions)
            .where(eq(jobExecutions.jobId, replaceFixture.jobId));
          expect(executionRows).toEqual(
            expect.arrayContaining([
              { dispatchGeneration: 1, attemptNumber: 1 },
              { dispatchGeneration: 2, attemptNumber: 1 },
            ]),
          );
        } finally {
          await executionRuntime.close();
        }

        const lease = await retryRuntime.lifecycle.recordLease({
          jobId: retryFixture.jobId,
          expectedGeneration: 1,
          expectedCorrelationId: retryFixture.correlationId,
          workerId: workerOne,
          leaseDurationMilliseconds: 60_000,
        });
        expect(lease.disposition).toBe('claimed');
        if (lease.disposition !== 'claimed') {
          throw new Error('The synthetic retry fixture did not acquire its expected first lease.');
        }
        const failure = await retryRuntime.lifecycle.recordFailure({
          jobId: retryFixture.jobId,
          expectedGeneration: 1,
          workerId: workerOne,
          attemptNumber: lease.attemptNumber,
          classification: {
            category: 'transient_network',
            disposition: 'retryable',
            summary: 'A transient network dependency failed.',
          },
        });
        expect(failure.status).toBe('retry_wait');
        expect((await loadJob(url, retryFixture.jobId)).dispatchGeneration).toBe(1);
      } finally {
        await Promise.all([replaceRuntime.close(), retryRuntime.close()]);
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'serializes cancellation racing a lease and fences stale completion',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const secondaryUrl = secondaryDatabaseUrl();
      const fixture = await seedJob(url);
      const claimant = lifecycle(url);
      const canceller = lifecycle(secondaryUrl);
      const claimantReady = deferred();
      const cancellerReady = deferred();
      const release = deferred();
      try {
        const claimPromise = (async () => {
          claimantReady.resolve();
          await release.promise;
          return claimant.lifecycle.recordLease({
            jobId: fixture.jobId,
            expectedGeneration: 1,
            expectedCorrelationId: fixture.correlationId,
            workerId: workerOne,
            leaseDurationMilliseconds: 60_000,
          });
        })();
        const cancelPromise = (async () => {
          cancellerReady.resolve();
          await release.promise;
          return canceller.lifecycle.cancelPending({
            jobId: fixture.jobId,
            expectedGeneration: 1,
          });
        })();
        await Promise.all([claimantReady.promise, cancellerReady.promise]);
        release.resolve();
        const [claim, cancellation] = await Promise.all([claimPromise, cancelPromise]);

        if (claim.disposition === 'claimed') {
          expect(cancellation).toEqual({ disposition: 'lease_active' });
          await claimant.lifecycle.recordCompletion({
            jobId: fixture.jobId,
            expectedGeneration: 1,
            workerId: workerOne,
            attemptNumber: claim.attemptNumber,
          });
          expect((await loadJob(url, fixture.jobId)).status).toBe('completed');
        } else {
          expect(claim).toEqual({ disposition: 'stale' });
          expect(cancellation.disposition).toBe('cancelled');
          const canonical = await loadJob(url, fixture.jobId);
          expect(canonical.status).toBe('cancelled');
          expect(canonical.dispatchGeneration).toBe(2);
        }
      } finally {
        await Promise.all([claimant.close(), canceller.close()]);
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'serializes rescheduling racing a lease without allowing an old state write',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const secondaryUrl = secondaryDatabaseUrl();
      const fixture = await seedJob(url);
      const claimant = lifecycle(url);
      const reviser = lifecycle(secondaryUrl);
      const claimantReady = deferred();
      const reviserReady = deferred();
      const release = deferred();
      try {
        const claimPromise = (async () => {
          claimantReady.resolve();
          await release.promise;
          return claimant.lifecycle.recordLease({
            jobId: fixture.jobId,
            expectedGeneration: 1,
            expectedCorrelationId: fixture.correlationId,
            workerId: workerOne,
            leaseDurationMilliseconds: 60_000,
          });
        })();
        const reschedulePromise = (async () => {
          reviserReady.resolve();
          await release.promise;
          return reviser.lifecycle.reschedule({
            jobId: fixture.jobId,
            expectedGeneration: 1,
            scheduledFor: '2020-01-01T00:00:00.000Z',
            availableAfter: '2020-01-01T00:00:00.000Z',
            executionDeadline: null,
          });
        })();
        await Promise.all([claimantReady.promise, reviserReady.promise]);
        release.resolve();
        const [claim, revision] = await Promise.all([claimPromise, reschedulePromise]);

        if (claim.disposition === 'claimed') {
          expect(revision).toEqual({ disposition: 'lease_active' });
          await claimant.lifecycle.recordCompletion({
            jobId: fixture.jobId,
            expectedGeneration: 1,
            workerId: workerOne,
            attemptNumber: claim.attemptNumber,
          });
          expect((await loadJob(url, fixture.jobId)).status).toBe('completed');
        } else {
          expect(claim).toEqual({ disposition: 'stale' });
          expect(revision.disposition).toBe('rescheduled');
          const canonical = await loadJob(url, fixture.jobId);
          expect(canonical.status).toBe('queued');
          expect(canonical.dispatchGeneration).toBe(2);
        }
      } finally {
        await Promise.all([claimant.close(), reviser.close()]);
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'enforces latest-start deadline before, at, and after it without handler execution',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const before = await seedJob(url, {
        executionDeadline: new Date('2100-01-01T00:00:00.000Z'),
      });
      const at = await seedJob(url, { executionDeadline: new Date('2100-01-01T00:00:00.000Z') });
      const after = await seedJob(url, {
        executionDeadline: new Date('2000-01-01T00:00:00.000Z'),
      });
      const expiredLease = await seedJob(url, {
        executionDeadline: new Date('2100-01-01T00:00:00.000Z'),
      });
      const beforeRuntime = lifecycle(url);
      const atRuntime = lifecycle(url);
      const afterRuntime = lifecycle(url);
      const expiredLeaseRuntime = lifecycle(url);
      const executions = { value: 0 };
      try {
        await expect(
          executor({ lifecycle: beforeRuntime.lifecycle, executions }).run({
            jobId: before.jobId,
            correlationId: before.correlationId,
            generation: 1,
          }),
        ).resolves.toEqual({ disposition: 'completed' });

        const clock = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
        try {
          // `now()` becomes the exact latest-start boundary in the canonical database. The claim
          // predicate is strictly greater-than, so the subsequent callback is ineligible.
          await clock.db
            .update(jobs)
            .set({ executionDeadline: sql`now()` })
            .where(eq(jobs.id, at.jobId));
        } finally {
          await clock.close();
        }
        await expect(
          executor({ lifecycle: atRuntime.lifecycle, executions }).run({
            jobId: at.jobId,
            correlationId: at.correlationId,
            generation: 1,
          }),
        ).resolves.toEqual({ disposition: 'expired' });
        await expect(
          executor({ lifecycle: afterRuntime.lifecycle, executions }).run({
            jobId: after.jobId,
            correlationId: after.correlationId,
            generation: 1,
          }),
        ).resolves.toEqual({ disposition: 'expired' });

        const initialLease = await expiredLeaseRuntime.lifecycle.recordLease({
          jobId: expiredLease.jobId,
          expectedGeneration: 1,
          expectedCorrelationId: expiredLease.correlationId,
          workerId: workerOne,
          leaseDurationMilliseconds: 60_000,
        });
        expect(initialLease.disposition).toBe('claimed');
        const expireLease = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
        try {
          await expireLease.db
            .update(jobs)
            .set({
              executionDeadline: sql`now()`,
              leaseExpiresAt: sql`now() - interval '1 millisecond'`,
            })
            .where(eq(jobs.id, expiredLease.jobId));
        } finally {
          await expireLease.close();
        }
        await expect(
          expiredLeaseRuntime.lifecycle.recordLease({
            jobId: expiredLease.jobId,
            expectedGeneration: 1,
            expectedCorrelationId: expiredLease.correlationId,
            workerId: workerTwo,
            leaseDurationMilliseconds: 60_000,
          }),
        ).resolves.toEqual({ disposition: 'expired' });

        expect(executions.value).toBe(1);
        const expired = await loadJob(url, after.jobId);
        expect(expired.status).toBe('terminal_failed');
        expect(expired.lastErrorCategory).toBe('expired');
        const expiredLeaseJob = await loadJob(url, expiredLease.jobId);
        expect(expiredLeaseJob.status).toBe('terminal_failed');
        expect(expiredLeaseJob.lastErrorCategory).toBe('expired');
      } finally {
        await Promise.all([
          beforeRuntime.close(),
          atRuntime.close(),
          afterRuntime.close(),
          expiredLeaseRuntime.close(),
        ]);
      }
    },
  );

  test.skipIf(!testDatabaseUrl)(
    'keeps durable non-expiring work leaseable and leaves an expired reminder commitment open',
    async () => {
      const url = testDatabaseUrl;
      if (!url) return;
      assertDedicatedLocalTestDatabase(url);
      const durable = await seedJob(url, {
        availableAfter: new Date('2000-01-01T00:00:00.000Z'),
        scheduledFor: new Date('2000-01-01T00:00:00.000Z'),
        executionDeadline: null,
      });
      const reminder = await seedJob(url, {
        jobType: 'jarvis.reminder.fire',
        executionDeadline: new Date('2000-01-01T00:00:00.000Z'),
      });
      const commitmentId = randomUUID();
      const commitmentRuntime = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
      try {
        await commitmentRuntime.db.insert(commitments).values({
          id: commitmentId,
          ownerId: reminder.ownerId,
          title: 'Synthetic reminder commitment remains open',
          source: 'internal_test',
          status: 'open',
        });
        await commitmentRuntime.db
          .update(jobs)
          .set({ payload: { reminderId: randomUUID(), commitmentId } })
          .where(eq(jobs.id, reminder.jobId));
      } finally {
        await commitmentRuntime.close();
      }
      const durableRuntime = lifecycle(url);
      const reminderRuntime = lifecycle(url);
      const executions = { value: 0 };
      try {
        await expect(
          executor({ lifecycle: durableRuntime.lifecycle, executions }).run({
            jobId: durable.jobId,
            correlationId: durable.correlationId,
            generation: 1,
          }),
        ).resolves.toEqual({ disposition: 'completed' });
        await expect(
          executor({ lifecycle: reminderRuntime.lifecycle, executions }).run({
            jobId: reminder.jobId,
            correlationId: reminder.correlationId,
            generation: 1,
          }),
        ).resolves.toEqual({ disposition: 'expired' });
        expect(executions.value).toBe(1);

        const verification = createDatabaseRuntime({ connectionString: url, maxConnections: 1 });
        try {
          const [commitment] = await verification.db
            .select({ status: commitments.status })
            .from(commitments)
            .where(eq(commitments.id, commitmentId));
          expect(commitment?.status).toBe('open');
        } finally {
          await verification.close();
        }
      } finally {
        await Promise.all([durableRuntime.close(), reminderRuntime.close()]);
      }
    },
  );
});
