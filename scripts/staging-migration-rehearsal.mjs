import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  MigrationGateError,
  createDefaultClient,
  createFixedMigrationTargetPolicy,
  migrationErrorCategory,
  readExpectedMigrations,
  runMigrationRelease,
} from './staging-migration-release.mjs';

const REHEARSAL_TARGET = Object.freeze({
  database: 'jarvis_migration_rehearsal',
  role: 'jarvis_migration_rehearsal',
  directHost: 'localhost',
  pooledHost: 'localhost-pooler.invalid',
});
const REHEARSAL_MISMATCH_HOST = 'jarvis-rehearsal-mismatch.local';
const REHEARSAL_PORT = '55432';

function requireEnvironmentValue(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new MigrationGateError('rehearsal_configuration_missing');
  }
  return value;
}

function requireCondition(condition, category) {
  if (!condition) {
    throw new MigrationGateError(category);
  }
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function rehearsalPolicy(certificateAuthorityPath, hostname = REHEARSAL_TARGET.directHost) {
  return createFixedMigrationTargetPolicy({
    target: { ...REHEARSAL_TARGET, directHost: hostname },
    allowedPorts: [REHEARSAL_PORT],
    requiredQueryParameters: [
      ['sslmode', 'verify-full'],
      ['sslrootcert', certificateAuthorityPath],
    ],
  });
}

function createDatabaseWorkspaceRequire(applicationRoot) {
  return createRequire(
    pathToFileURL(resolve(applicationRoot, 'packages/database/package.json')).href,
  );
}

async function verifyRehearsalClient(client) {
  requireCondition(
    client?.connection?.stream?.encrypted === true && client.connection.stream.authorized === true,
    'tls_transport_unverified',
  );

  const session = await client.query('select current_database() as database, current_user as role');
  requireCondition(session.rows.length === 1, 'rehearsal_database_state_unexpected');
  requireCondition(
    session.rows[0].database === REHEARSAL_TARGET.database &&
      session.rows[0].role === REHEARSAL_TARGET.role,
    'rehearsal_target_mismatch',
  );

  const tls = await client.query('select ssl from pg_stat_ssl where pid = pg_backend_pid()');
  requireCondition(tls.rows.length === 1 && tls.rows[0].ssl === true, 'tls_transport_unverified');
}

async function withRehearsalClient(applicationRoot, connectionString, operation) {
  const client = await createDefaultClient(applicationRoot, connectionString);
  try {
    await client.connect();
    await verifyRehearsalClient(client);
    return await operation(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function migrateThrough0006(applicationRoot, connectionString) {
  const migrationsRoot = resolve(applicationRoot, 'packages/database/drizzle');
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'jarvis-staging-migration-rehearsal-'));

  try {
    const journal = JSON.parse(
      await readFile(resolve(migrationsRoot, 'meta/_journal.json'), 'utf8'),
    );
    const entries = journal.entries.filter((entry) => entry.idx <= 6);
    await mkdir(resolve(temporaryRoot, 'meta'), { recursive: true });
    await Promise.all(
      entries.map((entry) =>
        copyFile(
          resolve(migrationsRoot, `${entry.tag}.sql`),
          resolve(temporaryRoot, `${entry.tag}.sql`),
        ),
      ),
    );
    await writeFile(
      resolve(temporaryRoot, 'meta/_journal.json'),
      `${JSON.stringify({ ...journal, entries }, null, 2)}\n`,
      'utf8',
    );

    const requireFromDatabaseWorkspace = createDatabaseWorkspaceRequire(applicationRoot);
    const { drizzle } = requireFromDatabaseWorkspace('drizzle-orm/node-postgres');
    const migratorModule = await import(
      pathToFileURL(requireFromDatabaseWorkspace.resolve('drizzle-orm/node-postgres/migrator')).href
    );
    const client = await createDefaultClient(applicationRoot, connectionString);

    try {
      await client.connect();
      await verifyRehearsalClient(client);
      await migratorModule.migrate(drizzle(client), { migrationsFolder: temporaryRoot });
    } finally {
      await client.end().catch(() => undefined);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function seedRepresentativeRows(applicationRoot, connectionString) {
  const ownerId = randomUUID();
  const jobId = randomUUID();
  const executionId = randomUUID();
  const correlationId = randomUUID();

  await withRehearsalClient(applicationRoot, connectionString, async (client) => {
    await client.query(
      `
        insert into jarvis.owners (id, email_normalized, display_name, timezone, is_primary)
        values ($1, $2, $3, 'UTC', false)
      `,
      [ownerId, `${ownerId}@rehearsal.invalid`, 'Staging migration rehearsal owner'],
    );
    await client.query(
      `
        insert into jarvis.jobs (
          id, owner_id, job_type, payload, status, priority, scheduled_for, available_after,
          maximum_attempts, correlation_id, idempotency_key
        ) values (
          $1, $2, 'jarvis.event.process', '{}'::jsonb, 'queued', 0, current_timestamp,
          current_timestamp, 3, $3, $4
        )
      `,
      [jobId, ownerId, correlationId, `staging-migration-rehearsal:${jobId}`],
    );
    await client.query(
      `
        insert into jarvis.job_executions (
          id, owner_id, job_id, worker_id, attempt_number, status, leased_at, completed_at,
          correlation_id
        ) values ($1, $2, $3, 'rehearsal-worker', 1, 'completed', current_timestamp,
          current_timestamp, $4)
      `,
      [executionId, ownerId, jobId, correlationId],
    );
    await client.query(
      `
        insert into jarvis.audit_events (
          owner_id, actor_type, action, target_type, target_id, occurred_at, correlation_id, source
        ) values ($1, 'system', 'rehearsal.seeded', 'job', $2, current_timestamp, $3, 'rehearsal')
      `,
      [ownerId, jobId, correlationId],
    );
  });

  return { jobId };
}

async function readSnapshot(applicationRoot, connectionString) {
  return withRehearsalClient(applicationRoot, connectionString, async (client) => {
    const journal = await client.query(
      'select hash from drizzle.__drizzle_migrations order by created_at asc, id asc',
    );
    const counts = await client.query(`
      select
        (select count(*)::integer from jarvis.jobs) as jobs_count,
        (select count(*)::integer from jarvis.job_executions) as executions_count,
        (select count(*)::integer from jarvis.audit_events) as audit_count,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'jarvis' and table_name = 'jobs' and column_name = 'dispatch_generation'
        ) as has_job_generation,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'jarvis' and table_name = 'jobs' and column_name = 'execution_deadline'
        ) as has_execution_deadline,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'jarvis' and table_name = 'job_executions' and column_name = 'dispatch_generation'
        ) as has_execution_generation
    `);
    requireCondition(counts.rows.length === 1, 'rehearsal_database_state_unexpected');

    return {
      journalHashes: journal.rows.map((row) => row.hash),
      jobsCount: Number(counts.rows[0].jobs_count),
      executionsCount: Number(counts.rows[0].executions_count),
      auditCount: Number(counts.rows[0].audit_count),
      hasJobGeneration: counts.rows[0].has_job_generation,
      hasExecutionDeadline: counts.rows[0].has_execution_deadline,
      hasExecutionGeneration: counts.rows[0].has_execution_generation,
    };
  });
}

async function assertSnapshotUnchanged(applicationRoot, connectionString, expected) {
  const actual = await readSnapshot(applicationRoot, connectionString);
  requireCondition(
    JSON.stringify(actual) === JSON.stringify(expected),
    'rehearsal_unexpected_database_mutation',
  );
}

async function expectGateFailure(name, expectedCategory, operation) {
  try {
    await operation();
  } catch (error) {
    requireCondition(
      migrationErrorCategory(error) === expectedCategory,
      'rehearsal_unexpected_failure_category',
    );
    console.log(`rehearsal: ${name}=pass`);
    return error;
  }

  throw new MigrationGateError('rehearsal_expected_failure_missing');
}

function migrationMustNotStart() {
  throw new MigrationGateError('rehearsal_migration_child_started_before_preflight');
}

async function withPathOverride(pathPrefix, operation) {
  const originalPath = process.env.PATH;
  process.env.PATH = pathPrefix;
  try {
    return await operation();
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  }
}

async function verifyFinalState(applicationRoot, connectionString, expectedMigrations, baseline) {
  const final = await readSnapshot(applicationRoot, connectionString);
  requireCondition(
    equalArrays(
      final.journalHashes,
      expectedMigrations.map((migration) => migration.hash),
    ),
    'rehearsal_final_journal_unexpected',
  );
  requireCondition(final.jobsCount === baseline.jobsCount, 'rehearsal_existing_jobs_not_preserved');
  requireCondition(
    final.executionsCount === baseline.executionsCount,
    'rehearsal_existing_executions_not_preserved',
  );
  requireCondition(
    final.auditCount === baseline.auditCount,
    'rehearsal_existing_audits_not_preserved',
  );
  requireCondition(
    final.hasJobGeneration === true &&
      final.hasExecutionDeadline === true &&
      final.hasExecutionGeneration === true,
    'rehearsal_final_schema_unexpected',
  );

  await withRehearsalClient(applicationRoot, connectionString, async (client) => {
    const rows = await client.query(`
      select
        (select count(*)::integer from jarvis.jobs
          where dispatch_generation = 1 and execution_deadline is null) as safe_jobs,
        (select count(*)::integer from jarvis.job_executions
          where dispatch_generation = 1) as safe_executions,
        coalesce((
          select indexdef from pg_indexes
          where schemaname = 'jarvis' and indexname = 'job_executions_job_generation_attempt_unique'
        ), '') as generation_attempt_index
    `);
    requireCondition(rows.rows.length === 1, 'rehearsal_final_schema_unexpected');
    requireCondition(
      Number(rows.rows[0].safe_jobs) === baseline.jobsCount,
      'rehearsal_default_unexpected',
    );
    requireCondition(
      Number(rows.rows[0].safe_executions) === baseline.executionsCount,
      'rehearsal_default_unexpected',
    );
    requireCondition(
      /\("job_id", "dispatch_generation", "attempt_number"\)/.test(
        rows.rows[0].generation_attempt_index,
      ),
      'rehearsal_execution_history_index_unexpected',
    );
  });
}

export async function runStagingMigrationRehearsal({ applicationRoot = process.cwd() } = {}) {
  const connectionString = requireEnvironmentValue('JARVIS_REHEARSAL_DATABASE_URL');
  const certificateAuthorityPath = requireEnvironmentValue('JARVIS_REHEARSAL_CA_PATH');
  const untrustedCertificateAuthorityPath = requireEnvironmentValue(
    'JARVIS_REHEARSAL_UNTRUSTED_CA_PATH',
  );
  const policy = rehearsalPolicy(certificateAuthorityPath);
  const expectedMigrations = await readExpectedMigrations(applicationRoot);
  const expectedPreflightHashes = expectedMigrations.slice(0, 7).map((migration) => migration.hash);

  await migrateThrough0006(applicationRoot, connectionString);
  const seeded = await seedRepresentativeRows(applicationRoot, connectionString);
  const baseline = await readSnapshot(applicationRoot, connectionString);
  requireCondition(
    equalArrays(baseline.journalHashes, expectedPreflightHashes),
    'rehearsal_preflight_journal_unexpected',
  );
  requireCondition(
    baseline.jobsCount === 1 && baseline.executionsCount === 1 && baseline.auditCount === 1,
    'rehearsal_seed_unexpected',
  );
  console.log('rehearsal: baseline_through_0006=pass');

  const wrongRole = new URL(connectionString);
  wrongRole.username = 'wrong_rehearsal_role';
  await expectGateFailure('wrong_target_or_role', 'migration_target_invalid', () =>
    runMigrationRelease({
      applicationRoot,
      connectionString: wrongRole.toString(),
      targetPolicy: policy,
      runMigration: migrationMustNotStart,
    }),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, baseline);

  const fakeJournalHash = 'f'.repeat(64);
  await withRehearsalClient(applicationRoot, connectionString, (client) =>
    client.query('insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)', [
      fakeJournalHash,
      Date.now(),
    ]),
  );
  const wrongJournalBaseline = await readSnapshot(applicationRoot, connectionString);
  await expectGateFailure('wrong_journal', 'migration_journal_unexpected', () =>
    runMigrationRelease({
      applicationRoot,
      connectionString,
      targetPolicy: policy,
      runMigration: migrationMustNotStart,
    }),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, wrongJournalBaseline);
  await withRehearsalClient(applicationRoot, connectionString, (client) =>
    client.query('delete from drizzle.__drizzle_migrations where hash = $1', [fakeJournalHash]),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, baseline);

  await withRehearsalClient(applicationRoot, connectionString, (client) =>
    client.query(
      `
        update jarvis.jobs
        set lease_owner = 'rehearsal-active-lease', lease_expires_at = current_timestamp + interval '5 minutes'
        where id = $1
      `,
      [seeded.jobId],
    ),
  );
  const activeLeaseBaseline = await readSnapshot(applicationRoot, connectionString);
  await expectGateFailure('active_lease', 'active_leases_present', () =>
    runMigrationRelease({
      applicationRoot,
      connectionString,
      targetPolicy: policy,
      runMigration: migrationMustNotStart,
    }),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, activeLeaseBaseline);
  await withRehearsalClient(applicationRoot, connectionString, (client) =>
    client.query(
      'update jarvis.jobs set lease_owner = null, lease_expires_at = null where id = $1',
      [seeded.jobId],
    ),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, baseline);

  const untrustedUrl = new URL(connectionString);
  untrustedUrl.searchParams.set('sslrootcert', untrustedCertificateAuthorityPath);
  await expectGateFailure('untrusted_certificate', 'tls_transport_unverified', () =>
    runMigrationRelease({
      applicationRoot,
      connectionString: untrustedUrl.toString(),
      targetPolicy: rehearsalPolicy(untrustedCertificateAuthorityPath),
      runMigration: migrationMustNotStart,
    }),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, baseline);

  const wrongHostnameUrl = new URL(connectionString);
  wrongHostnameUrl.hostname = REHEARSAL_MISMATCH_HOST;
  await expectGateFailure('wrong_certificate_hostname', 'tls_transport_unverified', () =>
    runMigrationRelease({
      applicationRoot,
      connectionString: wrongHostnameUrl.toString(),
      targetPolicy: rehearsalPolicy(certificateAuthorityPath, REHEARSAL_MISMATCH_HOST),
      runMigration: migrationMustNotStart,
    }),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, baseline);

  const temporaryBin = await mkdtemp(join(tmpdir(), 'jarvis-staging-migration-failing-pnpm-'));
  const emptyBin = await mkdtemp(join(tmpdir(), 'jarvis-staging-migration-empty-path-'));
  try {
    const failingPnpm = resolve(temporaryBin, 'pnpm');
    await writeFile(
      failingPnpm,
      '#!/usr/bin/env bash\nprintf "synthetic migration failure" >&2\nexit 73\n',
      {
        mode: 0o700,
      },
    );

    const nonzeroBaseline = await readSnapshot(applicationRoot, connectionString);
    const nonzeroError = await withPathOverride(`${temporaryBin}:${process.env.PATH ?? ''}`, () =>
      expectGateFailure('nonzero_migration_child', 'migration_command_failed_or_uncertain', () =>
        runMigrationRelease({ applicationRoot, connectionString, targetPolicy: policy }),
      ),
    );
    requireCondition(nonzeroError.migrationExitCode === 73, 'rehearsal_nonzero_exit_unexpected');
    await assertSnapshotUnchanged(applicationRoot, connectionString, nonzeroBaseline);

    const uncertainBaseline = await readSnapshot(applicationRoot, connectionString);
    const uncertainError = await withPathOverride(emptyBin, () =>
      expectGateFailure('uncertain_migration_child', 'migration_command_failed_or_uncertain', () =>
        runMigrationRelease({ applicationRoot, connectionString, targetPolicy: policy }),
      ),
    );
    requireCondition(
      uncertainError.migrationExitCode === null,
      'rehearsal_uncertain_exit_unexpected',
    );
    await assertSnapshotUnchanged(applicationRoot, connectionString, uncertainBaseline);
  } finally {
    await rm(temporaryBin, { recursive: true, force: true });
    await rm(emptyBin, { recursive: true, force: true });
  }

  const result = await runMigrationRelease({
    applicationRoot,
    connectionString,
    targetPolicy: policy,
  });
  requireCondition(result.exitCode === 0, 'rehearsal_success_exit_unexpected');
  await verifyFinalState(applicationRoot, connectionString, expectedMigrations, baseline);
  console.log('rehearsal: guarded_pnpm_drizzle_migration=pass');

  const secondInvocationBaseline = await readSnapshot(applicationRoot, connectionString);
  await expectGateFailure('already_applied_journal', 'migration_journal_unexpected', () =>
    runMigrationRelease({
      applicationRoot,
      connectionString,
      targetPolicy: policy,
      runMigration: migrationMustNotStart,
    }),
  );
  await assertSnapshotUnchanged(applicationRoot, connectionString, secondInvocationBaseline);
  console.log('rehearsal: complete');
}

async function main() {
  try {
    await runStagingMigrationRehearsal({ applicationRoot: process.cwd() });
  } catch (error) {
    console.error(`rehearsal: ${migrationErrorCategory(error)}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] === undefined ? null : resolve(process.argv[1]);
const modulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === modulePath) {
  await main();
}
