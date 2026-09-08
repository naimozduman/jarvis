import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APPROVED_APPLICATION_SHA = '940ab613d71ee349ab06341dd3684dff63e25c08';
export const APPROVED_APPLICATION_TREE = '5434d843f852be65af481ad297221ecd440d698f';

export const STAGING_TARGET = Object.freeze({
  projectId: 'jolly-truth-47196608',
  branchId: 'br-jolly-scene-ayxtwkhr',
  database: 'neondb',
  role: 'neondb_owner',
  directHost: 'ep-dark-recipe-ay65lknc.c-5.us-east-2.aws.neon.tech',
  pooledHost: 'ep-dark-recipe-ay65lknc-pooler.c-5.us-east-2.aws.neon.tech',
});

export function createFixedMigrationTargetPolicy({
  target,
  allowedPorts,
  requiredQueryParameters,
}) {
  if (
    !target ||
    !Array.isArray(allowedPorts) ||
    !Array.isArray(requiredQueryParameters) ||
    typeof target.database !== 'string' ||
    typeof target.role !== 'string' ||
    typeof target.directHost !== 'string'
  ) {
    throw new TypeError('A migration target policy must be fully specified by trusted code.');
  }

  return Object.freeze({
    target: Object.freeze({ ...target }),
    allowedPorts: Object.freeze([...allowedPorts]),
    requiredQueryParameters: Object.freeze(
      requiredQueryParameters.map(([name, value]) => Object.freeze([name, value])),
    ),
  });
}

const STAGING_TARGET_POLICY = createFixedMigrationTargetPolicy({
  target: STAGING_TARGET,
  allowedPorts: ['', '5432'],
  requiredQueryParameters: [['sslmode', 'verify-full']],
});

const EXPECTED_JOURNAL_TAGS = Object.freeze([
  '0000_large_prima',
  '0001_foamy_blue_shield',
  '0002_great_machine_man',
  '0003_windy_kylun',
  '0004_shallow_grim_reaper',
  '0005_magenta_thor',
  '0006_massive_microchip',
  '0007_nasty_spyke',
  '0008_striped_dreadnoughts',
]);

const EXPECTED_PENDING_HASHES = Object.freeze({
  '0007_nasty_spyke.sql': '0187ecc1d4fa75cb36b08055fa7d8457b1452ebcb53a61e06281786b6f182d28',
  '0008_striped_dreadnoughts.sql':
    '6f130bc05ff27fe0844acb906359e4a0cc8ecdb16a4f1734c1a72ebb5902c0ff',
});

const MAX_CAPTURED_DIAGNOSTIC_BYTES = 64 * 1024;
const MIGRATION_CHILD_TIMEOUT_MS = 5 * 60 * 1000;

const CHILD_ENVIRONMENT_ALLOWLIST = Object.freeze([
  'PATH',
  'HOME',
  'USER',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SHELL',
  'CI',
  'PNPM_HOME',
  'COREPACK_HOME',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
]);

export class MigrationGateError extends Error {
  constructor(category, { migrationExitCode } = {}) {
    super(category);
    this.category = category;
    this.migrationExitCode = migrationExitCode;
  }
}

function requireCondition(condition, category) {
  if (!condition) {
    throw new MigrationGateError(category);
  }
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function asCount(value) {
  const number = Number(value);
  requireCondition(Number.isSafeInteger(number) && number >= 0, 'database_state_unexpected');
  return number;
}

function oneRow(result) {
  requireCondition(result?.rows?.length === 1, 'database_state_unexpected');
  return result.rows[0];
}

function validateMigrationConnectionStringForPolicy(connectionString, targetPolicy) {
  requireCondition(
    typeof connectionString === 'string' && connectionString.length > 0,
    'migration_secret_unavailable',
  );

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new MigrationGateError('migration_target_invalid');
  }

  requireCondition(parsed.protocol === 'postgresql:', 'migration_target_invalid');
  const { target, allowedPorts, requiredQueryParameters } = targetPolicy;
  requireCondition(parsed.hostname === target.directHost, 'migration_target_invalid');
  requireCondition(parsed.hostname !== target.pooledHost, 'migration_target_invalid');
  requireCondition(!parsed.hostname.includes('-pooler.'), 'migration_target_invalid');
  requireCondition(allowedPorts.includes(parsed.port), 'migration_target_invalid');
  requireCondition(decodeURIComponent(parsed.username) === target.role, 'migration_target_invalid');
  requireCondition(parsed.password.length > 0, 'migration_target_invalid');
  requireCondition(parsed.pathname === `/${target.database}`, 'migration_target_invalid');
  requireCondition(parsed.hash === '', 'migration_target_invalid');

  const allowedParameters = new Map(requiredQueryParameters);
  const seenParameters = new Set();

  for (const [name, value] of parsed.searchParams.entries()) {
    requireCondition(allowedParameters.has(name), 'migration_target_invalid');
    requireCondition(!seenParameters.has(name), 'migration_target_invalid');
    requireCondition(value === allowedParameters.get(name), 'migration_target_invalid');
    seenParameters.add(name);
  }

  requireCondition(seenParameters.size === allowedParameters.size, 'migration_target_invalid');
  return parsed;
}

export function validateMigrationConnectionString(connectionString) {
  return validateMigrationConnectionStringForPolicy(connectionString, STAGING_TARGET_POLICY);
}

export function createMigrationChildEnvironment(parentEnvironment, connectionString) {
  const childEnvironment = {};

  for (const name of CHILD_ENVIRONMENT_ALLOWLIST) {
    const value = parentEnvironment[name];
    if (typeof value === 'string' && value.length > 0) {
      childEnvironment[name] = value;
    }
  }

  childEnvironment.PGCONNECT_TIMEOUT = '30';
  childEnvironment.JARVIS_MIGRATIONS_DATABASE_URL = connectionString;
  return childEnvironment;
}

export async function readExpectedMigrations(applicationRoot) {
  const migrationsRoot = resolve(applicationRoot, 'packages/database/drizzle');
  const journalPath = resolve(migrationsRoot, 'meta/_journal.json');
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  const tags = journal.entries?.map((entry) => entry.tag);

  requireCondition(
    Array.isArray(tags) && equalArrays(tags, EXPECTED_JOURNAL_TAGS),
    'migration_source_unexpected',
  );

  const migrations = [];
  for (const entry of journal.entries) {
    const filename = `${entry.tag}.sql`;
    const sql = await readFile(resolve(migrationsRoot, filename), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');

    if (filename in EXPECTED_PENDING_HASHES) {
      requireCondition(hash === EXPECTED_PENDING_HASHES[filename], 'migration_source_unexpected');
    }

    migrations.push({ tag: entry.tag, hash, createdAt: entry.when });
  }

  return migrations;
}

function requireEncryptedTransport(client) {
  requireCondition(
    client?.connection?.stream?.encrypted === true && client.connection.stream.authorized === true,
    'tls_transport_unverified',
  );
}

async function verifyTargetSession(client, target) {
  const row = oneRow(
    await client.query('select current_database() as database, current_user as role'),
  );

  requireCondition(
    row.database === target.database && row.role === target.role,
    'database_target_mismatch',
  );
}

async function readJournal(client) {
  const result = await client.query(
    'select hash, created_at from "drizzle"."__drizzle_migrations" order by created_at asc, id asc',
  );

  requireCondition(Array.isArray(result?.rows), 'database_state_unexpected');
  return result.rows.map((row) => row.hash);
}

async function readPreflightState(client, expectedMigrations) {
  const journalHashes = await readJournal(client);
  const expectedAppliedHashes = expectedMigrations.slice(0, 7).map((migration) => migration.hash);

  requireCondition(
    equalArrays(journalHashes, expectedAppliedHashes),
    'migration_journal_unexpected',
  );

  const row = oneRow(
    await client.query(`
      select
        (select count(*)::integer from "jarvis"."jobs") as jobs_count,
        (select count(*)::integer from "jarvis"."job_executions") as executions_count,
        (select count(*)::integer from "jarvis"."audit_events") as audit_count,
        (select count(*)::integer from "jarvis"."jobs"
          where lease_expires_at is not null and lease_expires_at > current_timestamp) as active_leases
    `),
  );

  const state = {
    jobsCount: asCount(row.jobs_count),
    executionsCount: asCount(row.executions_count),
    auditCount: asCount(row.audit_count),
    activeLeases: asCount(row.active_leases),
  };

  requireCondition(state.activeLeases === 0, 'active_leases_present');
  return state;
}

function assertColumn(columns, tableName, columnName, nullable, defaultValue) {
  const column = columns.find(
    (candidate) => candidate.table_name === tableName && candidate.column_name === columnName,
  );

  requireCondition(column !== undefined, 'postflight_schema_unexpected');
  requireCondition(column.is_nullable === nullable, 'postflight_schema_unexpected');
  requireCondition(column.column_default === defaultValue, 'postflight_schema_unexpected');
}

async function verifyPostflightState(client, expectedMigrations, preflightState) {
  const journalHashes = await readJournal(client);
  const expectedHashes = expectedMigrations.map((migration) => migration.hash);
  requireCondition(equalArrays(journalHashes, expectedHashes), 'postflight_journal_unexpected');

  const columns = (
    await client.query(`
      select table_name, column_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'jarvis'
        and table_name in ('jobs', 'job_executions')
        and column_name in ('dispatch_generation', 'execution_deadline')
    `)
  ).rows;

  assertColumn(columns, 'jobs', 'dispatch_generation', 'NO', '1');
  assertColumn(columns, 'jobs', 'execution_deadline', 'YES', null);
  assertColumn(columns, 'job_executions', 'dispatch_generation', 'NO', '1');

  const constraints = (
    await client.query(`
      select conname
      from pg_constraint
      where connamespace = 'jarvis'::regnamespace
        and conname in ('jobs_dispatch_generation_positive', 'job_executions_dispatch_generation_positive')
    `)
  ).rows.map((row) => row.conname);

  requireCondition(
    equalArrays([...constraints].sort(), [
      'job_executions_dispatch_generation_positive',
      'jobs_dispatch_generation_positive',
    ]),
    'postflight_schema_unexpected',
  );

  const indexes = (
    await client.query(`
      select indexname
      from pg_indexes
      where schemaname = 'jarvis'
        and indexname in ('jobs_lease_eligibility_index', 'job_executions_job_generation_attempt_unique')
    `)
  ).rows.map((row) => row.indexname);

  requireCondition(
    equalArrays([...indexes].sort(), [
      'job_executions_job_generation_attempt_unique',
      'jobs_lease_eligibility_index',
    ]),
    'postflight_schema_unexpected',
  );

  const row = oneRow(
    await client.query(`
      select
        (select count(*)::integer from "jarvis"."jobs") as jobs_count,
        (select count(*)::integer from "jarvis"."job_executions") as executions_count,
        (select count(*)::integer from "jarvis"."audit_events") as audit_count,
        (select count(*)::integer from "jarvis"."jobs"
          where dispatch_generation < 1) as invalid_generation_count,
        (select count(*)::integer from "jarvis"."jobs"
          where dispatch_generation = 1 and execution_deadline is null) as safe_existing_jobs,
        (select count(*)::integer from "jarvis"."job_executions"
          where dispatch_generation = 1) as safe_existing_executions
    `),
  );

  requireCondition(
    asCount(row.jobs_count) === preflightState.jobsCount,
    'postflight_data_unexpected',
  );
  requireCondition(
    asCount(row.executions_count) === preflightState.executionsCount,
    'postflight_data_unexpected',
  );
  requireCondition(
    asCount(row.audit_count) === preflightState.auditCount,
    'postflight_data_unexpected',
  );
  requireCondition(asCount(row.invalid_generation_count) === 0, 'postflight_data_unexpected');
  requireCondition(
    asCount(row.safe_existing_jobs) === preflightState.jobsCount,
    'postflight_data_unexpected',
  );
  requireCondition(
    asCount(row.safe_existing_executions) === preflightState.executionsCount,
    'postflight_data_unexpected',
  );
}

export async function createDefaultClient(applicationRoot, connectionString) {
  // `pg` is a declared dependency of the database workspace, not of the
  // repository root. The automation checkout is separate from the application
  // checkout, so resolution must begin at the installed database package.
  const databasePackageJsonUrl = pathToFileURL(
    resolve(applicationRoot, 'packages/database/package.json'),
  ).href;
  const requireFromDatabaseWorkspace = createRequire(databasePackageJsonUrl);
  const { Client } = requireFromDatabaseWorkspace('pg');
  return new Client({
    connectionString,
    connectionTimeoutMillis: 30_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
  });
}

async function withVerifiedClient(
  clientFactory,
  applicationRoot,
  connectionString,
  target,
  operation,
) {
  const client = await clientFactory(applicationRoot, connectionString);

  try {
    await client.connect();
    requireEncryptedTransport(client);
    await verifyTargetSession(client, target);
    return await operation(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function runPnpmMigration(
  applicationRoot,
  connectionString,
  { spawnProcess = spawn, parentEnvironment = process.env } = {},
) {
  const childEnvironment = createMigrationChildEnvironment(parentEnvironment, connectionString);

  return new Promise((resolveResult) => {
    let outputBytes = 0;
    let capturedDiagnosticBytes = 0;
    const diagnosticChunks = [];

    function captureDiagnostic(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      outputBytes += buffer.byteLength;

      if (capturedDiagnosticBytes >= MAX_CAPTURED_DIAGNOSTIC_BYTES) {
        return;
      }

      const remainingBytes = MAX_CAPTURED_DIAGNOSTIC_BYTES - capturedDiagnosticBytes;
      const capturedChunk = buffer.subarray(0, remainingBytes);
      diagnosticChunks.push(capturedChunk);
      capturedDiagnosticBytes += capturedChunk.byteLength;
    }

    function classifyDiagnostic() {
      const diagnostic = Buffer.concat(diagnosticChunks).toString('utf8');

      if (/password authentication failed|authentication failed/i.test(diagnostic)) {
        return 'database_authentication_failed';
      }
      if (/permission denied|insufficient privilege|must be owner/i.test(diagnostic)) {
        return 'database_role_denied';
      }
      if (
        /ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|connection (?:refused|reset|timed out)|could not connect/i.test(
          diagnostic,
        )
      ) {
        return 'database_unavailable_or_uncertain';
      }

      return 'migration_command_failed_or_uncertain';
    }

    function result(exitCode, signal) {
      return {
        exitCode,
        signal,
        outputBytes,
        diagnosticCategory: exitCode === 0 && signal === null ? null : classifyDiagnostic(),
      };
    }

    let child;
    try {
      child = spawnProcess('pnpm', ['db:migrate'], {
        cwd: applicationRoot,
        env: childEnvironment,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: MIGRATION_CHILD_TIMEOUT_MS,
        killSignal: 'SIGTERM',
      });
    } catch {
      resolveResult(result(null, null));
      return;
    }

    child.stdout?.on('data', (chunk) => {
      captureDiagnostic(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      captureDiagnostic(chunk);
    });
    child.once('error', () => {
      resolveResult(result(null, null));
    });
    child.once('close', (exitCode, signal) => {
      resolveResult(result(exitCode, signal));
    });
  });
}

export async function runMigrationRelease({
  applicationRoot = process.cwd(),
  connectionString,
  targetPolicy = STAGING_TARGET_POLICY,
  clientFactory = createDefaultClient,
  runMigration = runPnpmMigration,
} = {}) {
  validateMigrationConnectionStringForPolicy(connectionString, targetPolicy);
  const expectedMigrations = await readExpectedMigrations(applicationRoot);

  const preflightState = await withVerifiedClient(
    clientFactory,
    applicationRoot,
    connectionString,
    targetPolicy.target,
    (client) => readPreflightState(client, expectedMigrations),
  );

  const result = await runMigration(applicationRoot, connectionString);
  if (result.exitCode !== 0 || result.signal !== null) {
    throw new MigrationGateError(
      result.diagnosticCategory ?? 'migration_command_failed_or_uncertain',
      { migrationExitCode: result.exitCode },
    );
  }

  await withVerifiedClient(
    clientFactory,
    applicationRoot,
    connectionString,
    targetPolicy.target,
    (client) => verifyPostflightState(client, expectedMigrations, preflightState),
  );

  return {
    exitCode: result.exitCode,
    outputBytes: result.outputBytes,
  };
}

export async function runStagingMigration(input = {}) {
  return runMigrationRelease({ ...input, targetPolicy: STAGING_TARGET_POLICY });
}

export function migrationErrorCategory(error) {
  if (error instanceof MigrationGateError) {
    return error.category;
  }

  const code = error?.code;
  if (code === '28P01') {
    return 'database_authentication_failed';
  }
  if (code === '42501') {
    return 'database_role_denied';
  }
  if (
    [
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'ERR_TLS_CERT_ALTNAME_INVALID',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ].includes(code)
  ) {
    return 'tls_transport_unverified';
  }
  if (code === '57014') {
    return 'database_unavailable_or_uncertain';
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT'].includes(code)) {
    return 'database_unavailable_or_uncertain';
  }

  return 'migration_gate_unexpected_failure';
}

function migrationExitDescription(error) {
  if (!(error instanceof MigrationGateError) || error.migrationExitCode === undefined) {
    return '';
  }

  return Number.isInteger(error.migrationExitCode)
    ? `; migration_exit_code=${error.migrationExitCode}`
    : '; migration_exit_code=unavailable';
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== 'apply') {
    console.error('staging-migration: unsupported invocation');
    process.exitCode = 2;
    return;
  }

  try {
    const result = await runStagingMigration({
      applicationRoot: process.cwd(),
      connectionString: process.env.JARVIS_MIGRATIONS_DATABASE_URL,
    });
    console.log(`staging-migration: verified completion; migration_exit_code=${result.exitCode}`);
  } catch (error) {
    console.error(
      `staging-migration: ${migrationErrorCategory(error)}${migrationExitDescription(error)}`,
    );
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] === undefined ? null : resolve(process.argv[1]);
const modulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === modulePath) {
  await main();
}
