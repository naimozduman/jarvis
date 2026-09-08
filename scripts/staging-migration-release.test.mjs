import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  APPROVED_APPLICATION_SHA,
  APPROVED_APPLICATION_TREE,
  MigrationGateError,
  STAGING_TARGET,
  createDefaultClient,
  createFixedMigrationTargetPolicy,
  createMigrationChildEnvironment,
  readExpectedMigrations,
  runPnpmMigration,
  runStagingMigration,
  validateMigrationConnectionString,
} from './staging-migration-release.mjs';

const applicationRoot = resolve(process.cwd());
const automationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const syntheticConnectionString = [
  'postgresql://',
  `${STAGING_TARGET.role}:synthetic-password@`,
  STAGING_TARGET.directHost,
  `/${STAGING_TARGET.database}?sslmode=verify-full`,
].join('');

function expectGateError(callback, category) {
  assert.throws(callback, (error) => {
    return error instanceof MigrationGateError && error.category === category;
  });
}

function createClient({
  journalHashes,
  stage,
  jobsCount = 3,
  executionsCount = 7,
  auditCount = 11,
  encrypted = true,
  authorized = true,
}) {
  return {
    connection: { stream: { encrypted, authorized } },
    async connect() {},
    async end() {},
    async query(sql) {
      if (sql.includes('current_database() as database')) {
        return { rows: [{ database: STAGING_TARGET.database, role: STAGING_TARGET.role }] };
      }

      if (sql.includes('from "drizzle"."__drizzle_migrations"')) {
        return { rows: journalHashes.map((hash, index) => ({ hash, created_at: index })) };
      }

      if (sql.includes('active_leases')) {
        return {
          rows: [
            {
              jobs_count: String(jobsCount),
              executions_count: String(executionsCount),
              audit_count: String(auditCount),
              active_leases: '0',
            },
          ],
        };
      }

      if (sql.includes('information_schema.columns')) {
        assert.equal(stage, 'postflight');
        return {
          rows: [
            {
              table_name: 'jobs',
              column_name: 'dispatch_generation',
              is_nullable: 'NO',
              column_default: '1',
            },
            {
              table_name: 'jobs',
              column_name: 'execution_deadline',
              is_nullable: 'YES',
              column_default: null,
            },
            {
              table_name: 'job_executions',
              column_name: 'dispatch_generation',
              is_nullable: 'NO',
              column_default: '1',
            },
          ],
        };
      }

      if (sql.includes('from pg_constraint')) {
        assert.equal(stage, 'postflight');
        return {
          rows: [
            { conname: 'jobs_dispatch_generation_positive' },
            { conname: 'job_executions_dispatch_generation_positive' },
          ],
        };
      }

      if (sql.includes('from pg_indexes')) {
        assert.equal(stage, 'postflight');
        return {
          rows: [
            { indexname: 'jobs_lease_eligibility_index' },
            { indexname: 'job_executions_job_generation_attempt_unique' },
          ],
        };
      }

      if (sql.includes('invalid_generation_count')) {
        assert.equal(stage, 'postflight');
        return {
          rows: [
            {
              jobs_count: String(jobsCount),
              executions_count: String(executionsCount),
              audit_count: String(auditCount),
              invalid_generation_count: '0',
              safe_existing_jobs: String(jobsCount),
              safe_existing_executions: String(executionsCount),
            },
          ],
        };
      }

      throw new Error('unexpected synthetic query');
    },
  };
}

test('accepts only the approved direct, role-bound, TLS-verified target', () => {
  const parsed = validateMigrationConnectionString(syntheticConnectionString);

  assert.equal(parsed.hostname, STAGING_TARGET.directHost);
  assert.equal(decodeURIComponent(parsed.username), STAGING_TARGET.role);
  assert.equal(parsed.pathname, `/${STAGING_TARGET.database}`);
  assert.equal(parsed.searchParams.get('sslmode'), 'verify-full');

  for (const invalidConnectionString of [
    syntheticConnectionString.replace(STAGING_TARGET.role, 'jarvis_runtime_staging'),
    syntheticConnectionString.replace(STAGING_TARGET.directHost, STAGING_TARGET.pooledHost),
    syntheticConnectionString.replace(`/${STAGING_TARGET.database}?`, '/other_database?'),
    syntheticConnectionString.replace('sslmode=verify-full', 'sslmode=require'),
    `${syntheticConnectionString}&host=unapproved.example.test`,
    `${syntheticConnectionString}&channel_binding=require`,
  ]) {
    expectGateError(
      () => validateMigrationConnectionString(invalidConnectionString),
      'migration_target_invalid',
    );
  }
});

test('the live entrypoint cannot be redirected through a supplied test target policy', async () => {
  const testTargetPolicy = createFixedMigrationTargetPolicy({
    target: {
      database: 'jarvis_migration_rehearsal',
      role: 'jarvis_migration_rehearsal',
      directHost: 'localhost',
      pooledHost: 'localhost-pooler.invalid',
    },
    allowedPorts: ['55432'],
    requiredQueryParameters: [
      ['sslmode', 'verify-full'],
      ['sslrootcert', '/synthetic/rehearsal-ca.crt'],
    ],
  });
  const localOnlyConnectionString = [
    'postgresql://',
    'jarvis_migration_rehearsal:synthetic-password@',
    'localhost:55432/jarvis_migration_rehearsal?',
    'sslmode=verify-full&sslrootcert=%2Fsynthetic%2Frehearsal-ca.crt',
  ].join('');

  await assert.rejects(
    () =>
      runStagingMigration({
        applicationRoot,
        connectionString: localOnlyConnectionString,
        targetPolicy: testTargetPolicy,
        clientFactory: async () => {
          throw new Error('the live target validation must fail before a client is created');
        },
      }),
    (error) => error instanceof MigrationGateError && error.category === 'migration_target_invalid',
  );
});

test('passes the migration credential only through an allowlisted child environment', () => {
  const childEnvironment = createMigrationChildEnvironment(
    {
      PATH: '/synthetic/toolchain',
      HOME: '/synthetic/home',
      COREPACK_HOME: '/synthetic/corepack',
      DATABASE_URL: 'must-not-cross-the-boundary',
      JARVIS_VERCEL_TO_CONVEX_SECRET: 'must-not-cross-the-boundary',
      UNRELATED_VALUE: 'must-not-cross-the-boundary',
    },
    syntheticConnectionString,
  );

  assert.deepEqual(childEnvironment, {
    PATH: '/synthetic/toolchain',
    HOME: '/synthetic/home',
    COREPACK_HOME: '/synthetic/corepack',
    PGCONNECT_TIMEOUT: '30',
    JARVIS_MIGRATIONS_DATABASE_URL: syntheticConnectionString,
  });
  assert.equal('DATABASE_URL' in childEnvironment, false);
  assert.equal('JARVIS_VERCEL_TO_CONVEX_SECRET' in childEnvironment, false);
  assert.equal(childEnvironment.PGCONNECT_TIMEOUT, '30');
});

test('runs only the guarded migration command through the stripped child environment', async () => {
  let spawnInvocation;

  const result = await runPnpmMigration(applicationRoot, syntheticConnectionString, {
    parentEnvironment: {
      PATH: '/synthetic/toolchain',
      HOME: '/synthetic/home',
      DATABASE_URL: 'must-not-cross-the-boundary',
      ANOTHER_RUNTIME_SECRET: 'must-not-cross-the-boundary',
    },
    spawnProcess: (command, args, options) => {
      spawnInvocation = { command, args, options };
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from('synthetic standard output'));
        child.stderr.emit('data', Buffer.from('synthetic standard error'));
        child.emit('close', 0, null);
      });

      return child;
    },
  });

  assert.deepEqual(result, {
    exitCode: 0,
    signal: null,
    outputBytes:
      Buffer.byteLength('synthetic standard output') +
      Buffer.byteLength('synthetic standard error'),
    diagnosticCategory: null,
  });
  assert.equal(spawnInvocation.command, 'pnpm');
  assert.deepEqual(spawnInvocation.args, ['db:migrate']);
  assert.equal(spawnInvocation.options.cwd, applicationRoot);
  assert.equal(spawnInvocation.options.shell, false);
  assert.deepEqual(spawnInvocation.options.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(spawnInvocation.options.timeout, 5 * 60 * 1000);
  assert.equal(spawnInvocation.options.killSignal, 'SIGTERM');
  assert.equal(
    spawnInvocation.options.env.JARVIS_MIGRATIONS_DATABASE_URL,
    syntheticConnectionString,
  );
  assert.equal('DATABASE_URL' in spawnInvocation.options.env, false);
  assert.equal('ANOTHER_RUNTIME_SECRET' in spawnInvocation.options.env, false);
});

test('classifies mocked migration diagnostics without emitting their text', async () => {
  const diagnostic = 'password authentication failed for synthetic test role';

  const result = await runPnpmMigration(applicationRoot, syntheticConnectionString, {
    spawnProcess: () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      queueMicrotask(() => {
        child.stderr.emit('data', Buffer.from(diagnostic));
        child.emit('close', 17, null);
      });

      return child;
    },
  });

  assert.deepEqual(result, {
    exitCode: 17,
    signal: null,
    outputBytes: Buffer.byteLength(diagnostic),
    diagnosticCategory: 'database_authentication_failed',
  });
});

test('pins the reviewed application source and migration pair', async () => {
  const migrations = await readExpectedMigrations(applicationRoot);

  assert.equal(APPROVED_APPLICATION_SHA, '940ab613d71ee349ab06341dd3684dff63e25c08');
  assert.equal(APPROVED_APPLICATION_TREE, '5434d843f852be65af481ad297221ecd440d698f');
  assert.deepEqual(
    migrations.slice(-2).map((migration) => [migration.tag, migration.hash]),
    [
      ['0007_nasty_spyke', '0187ecc1d4fa75cb36b08055fa7d8457b1452ebcb53a61e06281786b6f182d28'],
      [
        '0008_striped_dreadnoughts',
        '6f130bc05ff27fe0844acb906359e4a0cc8ecdb16a4f1734c1a72ebb5902c0ff',
      ],
    ],
  );
});

test('resolves the preflight PostgreSQL client from the installed database workspace', async () => {
  const client = await createDefaultClient(applicationRoot, syntheticConnectionString);

  assert.equal(client.constructor.name, 'Client');
  await client.end();
});

test('keeps the hosted workflow manual, fixed-source, and migration-only', async () => {
  const workflow = await readFile(
    resolve(automationRoot, '.github/workflows/staging-migration-manual.yml'),
    'utf8',
  );

  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /group: jarvis-staging-migration/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /ref: 940ab613d71ee349ab06341dd3684dff63e25c08/);
  assert.match(
    workflow,
    /JARVIS_MIGRATIONS_DATABASE_URL: \$\{\{ secrets\.JARVIS_STAGING_MIGRATIONS_DATABASE_URL \}\}/,
  );
  assert.doesNotMatch(workflow, /^\s+DATABASE_URL:/m);
  assert.doesNotMatch(workflow, /^\s*(uses|run):.*\b(vercel|convex)\b/im);
  assert.doesNotMatch(workflow, /\b(retry|artifact|upload)\b/i);
});

test('keeps the hosted rehearsal isolated to its branch and local-only PostgreSQL fixture', async () => {
  const workflow = await readFile(
    resolve(automationRoot, '.github/workflows/staging-migration-rehearsal.yml'),
    'utf8',
  );

  assert.match(
    workflow,
    /^on:\n  push:\n    branches:\n      - verify\/staging-migration-workflow$/m,
  );
  assert.doesNotMatch(workflow, /^  (workflow_dispatch|pull_request|schedule|workflow_run):/m);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /group: jarvis-staging-migration-rehearsal-\$\{\{ github\.ref \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(
    workflow,
    /postgres:18\.6@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280/,
  );
  assert.match(workflow, /--publish '127\.0\.0\.1:55432:5432'/);
  assert.match(workflow, /JARVIS_REHEARSAL_DATABASE_URL/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /^\s*id-token:/m);
  assert.doesNotMatch(workflow, /^\s*environment:/m);
  assert.doesNotMatch(workflow, /\b(vercel|convex|neon)\b/i);
  assert.doesNotMatch(workflow, /JARVIS_STAGING_MIGRATIONS_DATABASE_URL/);
});

test('runs synthetic preflight, migration, and postflight without exposing diagnostics', async () => {
  const migrations = await readExpectedMigrations(applicationRoot);
  const preflightHashes = migrations.slice(0, 7).map((migration) => migration.hash);
  const postflightHashes = migrations.map((migration) => migration.hash);
  const clients = [
    createClient({ journalHashes: preflightHashes, stage: 'preflight' }),
    createClient({ journalHashes: postflightHashes, stage: 'postflight' }),
  ];
  let migrationCalls = 0;

  const result = await runStagingMigration({
    applicationRoot,
    connectionString: syntheticConnectionString,
    clientFactory: async () => {
      const client = clients.shift();
      assert.notEqual(client, undefined);
      return client;
    },
    runMigration: async (root, connectionString) => {
      migrationCalls += 1;
      assert.equal(root, applicationRoot);
      assert.equal(connectionString, syntheticConnectionString);
      return { exitCode: 0, signal: null, outputBytes: 17 };
    },
  });

  assert.deepEqual(result, { exitCode: 0, outputBytes: 17 });
  assert.equal(migrationCalls, 1);
  assert.equal(clients.length, 0);
});

test('does not continue after an uncertain migration command or unverified TLS', async () => {
  const migrations = await readExpectedMigrations(applicationRoot);
  const preflightHashes = migrations.slice(0, 7).map((migration) => migration.hash);
  let migrationCalls = 0;

  await assert.rejects(
    () =>
      runStagingMigration({
        applicationRoot,
        connectionString: syntheticConnectionString,
        clientFactory: async () =>
          createClient({ journalHashes: preflightHashes, stage: 'preflight' }),
        runMigration: async () => {
          migrationCalls += 1;
          return {
            exitCode: 1,
            signal: null,
            outputBytes: 23,
            diagnosticCategory: 'database_role_denied',
          };
        },
      }),
    (error) =>
      error instanceof MigrationGateError &&
      error.category === 'database_role_denied' &&
      error.migrationExitCode === 1,
  );
  assert.equal(migrationCalls, 1);

  await assert.rejects(
    () =>
      runStagingMigration({
        applicationRoot,
        connectionString: syntheticConnectionString,
        clientFactory: async () =>
          createClient({ journalHashes: preflightHashes, stage: 'preflight', encrypted: false }),
        runMigration: async () => {
          throw new Error('the migration command must not run when TLS is unverified');
        },
      }),
    (error) => error instanceof MigrationGateError && error.category === 'tls_transport_unverified',
  );

  await assert.rejects(
    () =>
      runStagingMigration({
        applicationRoot,
        connectionString: syntheticConnectionString,
        clientFactory: async () =>
          createClient({ journalHashes: preflightHashes, stage: 'preflight', authorized: false }),
        runMigration: async () => {
          throw new Error('the migration command must not run when certificate verification fails');
        },
      }),
    (error) => error instanceof MigrationGateError && error.category === 'tls_transport_unverified',
  );
});
