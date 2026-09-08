import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema/index.js';

export type JarvisDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseRuntime {
  readonly db: JarvisDatabase;
  readonly pool: Pool;
  close(): Promise<void>;
  verifyConnection(): Promise<void>;
  /** Checks the minimum canonical tables without applying, generating, or mutating migrations. */
  verifySchemaCompatibility(): Promise<void>;
}

export interface DatabaseRuntimeOptions {
  readonly connectionString: string;
  readonly maxConnections?: number;
  /** Optional bounded initial-connect window for request-scoped serverless runtimes. */
  readonly connectionTimeoutMillis?: number;
}

/**
 * Creates lazy PostgreSQL resources. No connection is opened on import or construction; callers
 * choose when to verify readiness or begin serving durable work.
 */
export function createDatabaseRuntime(options: DatabaseRuntimeOptions): DatabaseRuntime {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 10,
    ...(options.connectionTimeoutMillis === undefined
      ? {}
      : { connectionTimeoutMillis: options.connectionTimeoutMillis }),
  });

  return {
    db: drizzle({ client: pool, schema }),
    pool,
    async close(): Promise<void> {
      await pool.end();
    },
    async verifyConnection(): Promise<void> {
      await pool.query('select 1');
    },
    async verifySchemaCompatibility(): Promise<void> {
      const result = await pool.query<{
        canonicalEvents: string | null;
        durableJobs: string | null;
      }>(
        'select to_regclass(\'jarvis.events\') as "canonicalEvents", to_regclass(\'jarvis.jobs\') as "durableJobs"',
      );
      const row = result.rows[0];
      if (!row?.canonicalEvents || !row.durableJobs) {
        throw new Error('The required canonical JARVIS schema is not available.');
      }
    },
  };
}

export interface DatabaseReadinessInput {
  readonly appEnvironment: 'development' | 'test' | 'staging' | 'production';
  readonly databaseUrl: string | undefined;
  readonly verified: boolean | undefined;
}

export interface DatabaseFoundationStatus {
  readonly status: 'pass' | 'fail' | 'not_initialized';
  readonly detail: string;
}

/**
 * Server environments remain fail-closed until a database probe succeeds. Development and test
 * can run provider-free unit tests without a database, but report that durable persistence is
 * deferred rather than pretending a transient in-memory store is canonical.
 */
export function getDatabaseFoundationStatus(
  input: DatabaseReadinessInput,
): DatabaseFoundationStatus {
  if (input.verified) {
    return {
      status: 'pass',
      detail: 'The PostgreSQL connection was verified by the service runtime.',
    };
  }

  if (input.appEnvironment === 'staging' || input.appEnvironment === 'production') {
    return {
      status: 'fail',
      detail: input.databaseUrl
        ? 'The required PostgreSQL connection has not been verified.'
        : 'The required PostgreSQL connection is not configured.',
    };
  }

  return {
    status: 'not_initialized',
    detail: input.databaseUrl
      ? 'A PostgreSQL URL is configured but has not been initialized in this process.'
      : 'PostgreSQL is intentionally uninitialized for provider-free development or test.',
  };
}
