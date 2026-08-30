import type { Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { createWorkerRuntime, resolveWorkerHealthRouteAsync } from '@jarvis/worker';
import type {
  ClaimedDurableJob,
  DatabaseRuntime,
  JarvisDatabase,
  PgBossDurableJobTransport,
} from '@jarvis/database';

class FakeDatabase {
  public closeCalls = 0;
  public verifyCalls = 0;
  public schemaCalls = 0;

  public readonly runtime: DatabaseRuntime = {
    db: {
      select: () => {
        throw new Error('simulated canonical event repository failure');
      },
    } as unknown as JarvisDatabase,
    pool: {} as DatabaseRuntime['pool'],
    verifyConnection: async () => {
      this.verifyCalls += 1;
    },
    verifySchemaCompatibility: async () => {
      this.schemaCalls += 1;
    },
    close: async () => {
      this.closeCalls += 1;
    },
  };
}

class FakeJobs {
  public startCalls = 0;
  public stopCalls = 0;
  public readonly handlers: {
    readonly name: string;
    readonly handler: (job: ClaimedDurableJob) => Promise<void>;
  }[] = [];

  public async start(): Promise<void> {
    this.startCalls += 1;
  }

  public async stop(): Promise<void> {
    this.stopCalls += 1;
  }

  public async registerWorker(
    name: string,
    handler: (job: ClaimedDurableJob) => Promise<void>,
  ): Promise<string> {
    this.handlers.push({ name, handler });
    return name;
  }
}

function stagingEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: 'staging',
    DATABASE_URL: 'postgresql://staging.invalid/jarvis',
    ...overrides,
  };
}

describe('worker runtime composition', () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it('starts pg-boss before registering durable event work and rejects malformed job scope', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    const runtime = await createWorkerRuntime({
      environment: stagingEnvironment(),
      factories: {
        createDatabase: () => database.runtime,
        createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
      },
      log: () => undefined,
    });
    stop = () => runtime.stop();

    const eventHandler = jobs.handlers.find(
      (candidate) => candidate.name === 'jarvis.event.process',
    );
    expect(runtime.services).toBeDefined();
    expect(database.schemaCalls).toBe(1);
    expect(jobs.startCalls).toBe(1);
    expect(eventHandler).toBeDefined();

    await expect(
      eventHandler!.handler({
        id: '00000000-0000-4000-8000-000000000011',
        name: 'jarvis.event.process',
        data: {},
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('validation');
  });

  it('honors Railway PORT, reports durable readiness, and shuts down only once', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    let listenedPort: number | undefined;
    const runtime = await createWorkerRuntime({
      environment: stagingEnvironment({ PORT: '4312' }),
      factories: {
        createDatabase: () => database.runtime,
        createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
      },
      listen: async (_server: Server, port) => {
        listenedPort = port;
      },
      log: () => undefined,
    });

    await runtime.start();
    const readiness = await resolveWorkerHealthRouteAsync('/health/ready', {
      environment: stagingEnvironment(),
      readiness: {
        databaseVerified: true,
        queueStarted: true,
        workerHeartbeatVerified: true,
        modelConfigured: false,
      },
    });
    await runtime.stop();
    await runtime.stop();

    expect(listenedPort).toBe(4312);
    expect(readiness.statusCode).toBe(200);
    expect(readiness.body).toMatchObject({
      checks: { database: 'pass', queue: 'pass', model: 'not_configured' },
    });
    expect(jobs.stopCalls).toBe(1);
    expect(database.closeCalls).toBe(1);
  });

  it('surfaces an unexpected event handler failure to pg-boss for lifecycle classification', async () => {
    const database = new FakeDatabase();
    const jobs = new FakeJobs();
    const runtime = await createWorkerRuntime({
      environment: stagingEnvironment(),
      factories: {
        createDatabase: () => database.runtime,
        createJobTransport: () => jobs as unknown as PgBossDurableJobTransport,
      },
      log: () => undefined,
    });
    stop = () => runtime.stop();

    const eventHandler = jobs.handlers.find(
      (candidate) => candidate.name === 'jarvis.event.process',
    );

    await expect(
      eventHandler!.handler({
        id: '00000000-0000-4000-8000-000000000012',
        name: 'jarvis.event.process',
        data: {
          eventId: '00000000-0000-4000-8000-000000000013',
          ownerId: '00000000-0000-4000-8000-000000000001',
        },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('simulated canonical event repository failure');
  });
});
