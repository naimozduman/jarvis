import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema/index.js';

export type JarvisDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseRuntime {
  readonly db: JarvisDatabase;
  readonly pool: Pool;
  close(): Promise<void>;
  verifyConnection(): Promise<void>;
}

export interface DatabaseRuntimeOptions {
  readonly connectionString: string;
  readonly maxConnections?: number;
}

/**
 * Creates lazy PostgreSQL resources. No connection is opened on import or construction; callers
 * choose when to verify readiness or begin serving durable work.
 */
export function createDatabaseRuntime(options: DatabaseRuntimeOptions): DatabaseRuntime {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 10,
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
  };
}

export interface DatabaseReadinessInput {
  readonly appEnvironment: 'development' | 'test' | 'production';
  readonly databaseUrl: string | undefined;
  readonly verified: boolean | undefined;
}

export interface DatabaseFoundationStatus {
  readonly status: 'pass' | 'fail' | 'not_initialized';
  readonly detail: string;
}

/**
 * Production remains fail-closed until a database probe succeeded. Development and test can run
 * provider-free unit tests without a database, but report that durable persistence is deferred.
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

  if (input.appEnvironment === 'production') {
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
