import { afterEach, describe, expect, it } from 'vitest';

import { createApiRuntime } from '@jarvis/api';
import type { DatabaseRuntime, JarvisDatabase, PgBossDurableJobTransport } from '@jarvis/database';

class FakeDatabase {
  public available = true;
  public verifyCalls = 0;
  public schemaCalls = 0;
  public closeCalls = 0;

  public readonly runtime: DatabaseRuntime = {
    db: {} as JarvisDatabase,
    pool: {} as DatabaseRuntime['pool'],
    verifyConnection: async () => {
      this.verifyCalls += 1;
      if (!this.available) {
        throw new Error('database temporarily unavailable');
      }
    },
    verifySchemaCompatibility: async () => {
      this.schemaCalls += 1;
      if (!this.available) {
        throw new Error('schema unavailable');
      }
    },
    close: async () => {
      this.closeCalls += 1;
    },
  };
}

class FakeJobs {
  public startCalls = 0;
  public stopCalls = 0;

  public async start(): Promise<void> {
    this.startCalls += 1;
  }

  public async stop(): Promise<void> {
    this.stopCalls += 1;
  }
}

function stagingEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: 'staging',
    DATABASE_URL: 'postgresql://staging.invalid/jarvis',
    ...overrides,
  };
}

describe('API runtime composition', () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it('composes a real database/job boundary and reports a missing model honestly', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    const runtime = await createApiRuntime({
      environment: stagingEnvironment(),
      factories: {
        createDatabase: () => database.runtime,
        createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
      },
      log: () => undefined,
    });
    stop = () => runtime.stop();

    const ready = await runtime.app.inject({ method: 'GET', url: '/health/ready' });
    const transport = await runtime.app.inject({
      method: 'GET',
      url: '/health/transport/evolution',
    });

    expect(runtime.services).toBeDefined();
    expect(database.verifyCalls).toBeGreaterThanOrEqual(2);
    expect(database.schemaCalls).toBe(1);
    expect(jobs.startCalls).toBe(1);
    expect(ready.statusCode).toBe(200);
    expect(JSON.parse(ready.payload).checks).toMatchObject({
      database: 'pass',
      queue: 'pass',
      model: 'not_configured',
    });
    expect(JSON.parse(transport.payload)).toMatchObject({
      configured: false,
      state: 'disabled',
    });
  });

  it('fails closed at staging boot when the canonical database cannot be verified', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    const logEvents: string[] = [];
    database.available = false;

    await expect(
      createApiRuntime({
        environment: stagingEnvironment(),
        factories: {
          createDatabase: () => database.runtime,
          createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
        },
        log: (record) => logEvents.push(record.event),
      }),
    ).rejects.toThrow('database temporarily unavailable');

    expect(database.verifyCalls).toBe(1);
    expect(database.schemaCalls).toBe(0);
    expect(database.closeCalls).toBe(1);
    expect(jobs.startCalls).toBe(0);
    expect(logEvents).toEqual(['api.runtime.composition_failed']);
  });

  it('changes readiness on a later database outage without making transport state core readiness', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    const runtime = await createApiRuntime({
      environment: stagingEnvironment(),
      factories: {
        createDatabase: () => database.runtime,
        createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
      },
      log: () => undefined,
    });
    stop = () => runtime.stop();

    database.available = false;
    const ready = await runtime.app.inject({ method: 'GET', url: '/health/ready' });

    expect(ready.statusCode).toBe(503);
    expect(JSON.parse(ready.payload)).toMatchObject({
      status: 'not_ready',
      checks: { database: 'fail', queue: 'pass', model: 'not_configured' },
    });
  });

  it('honors Railway PORT and stops queue/database resources exactly once', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    let listenedPort: number | undefined;
    const runtime = await createApiRuntime({
      environment: stagingEnvironment({ PORT: '4311' }),
      factories: {
        createDatabase: () => database.runtime,
        createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
      },
      listen: async (_app, port) => {
        listenedPort = port;
      },
      log: () => undefined,
    });

    await runtime.start();
    await runtime.stop();
    await runtime.stop();

    expect(listenedPort).toBe(4311);
    expect(jobs.stopCalls).toBe(1);
    expect(database.closeCalls).toBe(1);
  });
});
