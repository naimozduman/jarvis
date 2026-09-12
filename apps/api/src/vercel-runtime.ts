import type { FastifyInstance } from 'fastify';

import type { RuntimeEnvironment } from '@jarvis/config';
import { isVerifiedZeroCostGatewayRoute, loadApiEnvironment } from '@jarvis/config';
import {
  CanonicalOnlyDurableJobTransport,
  createDatabaseRuntime,
  DrizzleCanonicalEventRepository,
  DrizzleDurableDeliveryOutbox,
  DrizzleDurableJobLifecycleProjection,
  DrizzleRuntimeConversationRepository,
  DrizzleStagingC7FixtureGuard,
  DrizzleTransportStateRepository,
  DrizzleTransactionalEventStore,
  type DatabaseRuntime,
} from '@jarvis/database';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';
import {
  CanonicalEventJobHandler,
  CanonicalTransportEventProcessor,
  canonicalJobSignal,
  ConvexHttpOrchestrationPublisher,
  createCanonicalBrain,
  createCanonicalEventProcessingJob,
  createCanonicalPolicyEvaluator,
  StatelessCanonicalJobExecutor,
} from '@jarvis/orchestration';
import { createSafeLogRecord } from '@jarvis/observability';

import { buildApi } from './http-app.js';
import { runStagingC7Harness, StagingC7HarnessError } from './staging-c7-harness.js';

export interface VercelApiRuntime {
  readonly environment: RuntimeEnvironment;
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

const stagingC7AdvisoryLock = 3_600_007;

/** A session-level PostgreSQL lock prevents two serverless invocations from overlapping fixtures. */
async function withStagingC7Lock<T>(
  database: DatabaseRuntime,
  operation: () => Promise<T>,
): Promise<T> {
  const client = await database.pool.connect();
  let acquired = false;
  try {
    const result = await client.query<{ readonly acquired: boolean }>(
      'select pg_try_advisory_lock($1) as acquired',
      [stagingC7AdvisoryLock],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      throw new StagingC7HarnessError('fixture_not_ready');
    }
    return await operation();
  } finally {
    if (acquired) {
      await client
        .query('select pg_advisory_unlock($1)', [stagingC7AdvisoryLock])
        .catch(() => undefined);
    }
    client.release();
  }
}

function modelConfigured(environment: RuntimeEnvironment): boolean {
  if (environment.model.provider !== 'vercel-ai-gateway') {
    return Boolean(environment.model.apiKey);
  }
  if (!environment.model.oidcToken) return false;
  const freeTierCreditGuard = environment.model.freeTierCreditGuard;
  const snapshotAt = freeTierCreditGuard.reportedMonthlyUsageAsOf;
  const snapshotDate = snapshotAt ? new Date(snapshotAt) : undefined;
  const snapshotIsCurrentMonth =
    freeTierCreditGuard.reportedMonthlyUsageUsd !== undefined &&
    snapshotDate !== undefined &&
    !Number.isNaN(snapshotDate.getTime()) &&
    snapshotDate.getTime() <= Date.now() &&
    snapshotDate.getUTCFullYear() === new Date().getUTCFullYear() &&
    snapshotDate.getUTCMonth() === new Date().getUTCMonth();
  const hasCompleteRateCard = (route: 'fast' | 'standard' | 'deep') => {
    const rateCard = environment.model[route].rateCard;
    return rateCard.inputCostPerMillionUsd !== null && rateCard.outputCostPerMillionUsd !== null;
  };
  return (
    !environment.model.zeroCostMode ||
    (isVerifiedZeroCostGatewayRoute(environment.model, 'fast') &&
      isVerifiedZeroCostGatewayRoute(environment.model, 'standard') &&
      isVerifiedZeroCostGatewayRoute(environment.model, 'deep') &&
      hasCompleteRateCard('fast') &&
      hasCompleteRateCard('standard') &&
      hasCompleteRateCard('deep') &&
      snapshotIsCurrentMonth)
  );
}

/**
 * Explicit disposable Vercel composition. It opens only Neon-backed repositories and never
 * starts a listener, pg-boss loop, timer, or Evolution client. Convex is an external wake-up
 * coordinator; all actual job leasing and state mutation remain in the canonical database.
 */
export async function createVercelApiRuntime(
  source: Readonly<Record<string, string | undefined>> = process.env,
): Promise<VercelApiRuntime> {
  const environment = loadApiEnvironment(source);
  if (!environment.databaseUrl) {
    throw new Error('Vercel runtime requires canonical DATABASE_URL.');
  }
  if (environment.evolution.enabled) {
    throw new Error('Vercel runtime refuses direct Evolution composition; use the local bridge.');
  }

  let database: DatabaseRuntime | undefined;
  let app: FastifyInstance | undefined;
  try {
    database = createDatabaseRuntime({
      connectionString: environment.databaseUrl,
      maxConnections: 4,
      // A serverless invocation must fail closed promptly when Neon is unavailable instead of
      // consuming the Function's full duration while an initial TCP connection is pending.
      connectionTimeoutMillis: 5_000,
    });
    await database.verifyConnection();
    await database.verifySchemaCompatibility();

    const jobTransport = new CanonicalOnlyDurableJobTransport();
    const pipeline: EventPipelineDependencies = {
      store: new DrizzleTransactionalEventStore(database.db, jobTransport),
      handlers: createDeterministicPhaseOneHandlers(),
      policy: createCanonicalPolicyEvaluator(),
      createJob: createCanonicalEventProcessingJob,
    };
    const jobs = new DrizzleDurableJobLifecycleProjection(database.db);
    const eventRepository = new DrizzleCanonicalEventRepository(database.db);
    const stagingC7FixtureGuard = new DrizzleStagingC7FixtureGuard(database.db);
    const conversations = new DrizzleRuntimeConversationRepository(database.db);
    const transportRepository = new DrizzleTransportStateRepository(database.db);
    const orchestration = new ConvexHttpOrchestrationPublisher({
      baseUrl: environment.orchestration.convexUrl,
      secret: environment.orchestration.vercelToConvexSecret,
    });
    const brain = createCanonicalBrain({ environment, database: database.db, pipeline });
    const localBridgeConfigured = environment.orchestration.localBridgeEnabled;
    const transportProcessor = localBridgeConfigured
      ? new CanonicalTransportEventProcessor({
          environment,
          repository: transportRepository,
          connectionPolicies: transportRepository,
          brain,
          deliveryOutbox: new DrizzleDurableDeliveryOutbox(database.db, jobTransport),
          connectionId: environment.orchestration.localBridgeConnectionId!,
          configuredOwnerTargetReference:
            environment.orchestration.localBridgeOwnerTargetReference!,
        })
      : undefined;
    const handler = new CanonicalEventJobHandler({
      environment,
      pipeline,
      events: eventRepository,
      conversations,
      brain,
      ...(transportProcessor ? { transportProcessor } : {}),
      scheduleOutboundJob: async (input) => {
        const canonicalJob = await jobs.load({ jobId: input.deliveryId });
        if (!canonicalJob) {
          throw new Error('The committed outbound delivery is missing its canonical job record.');
        }
        await orchestration.scheduleJob(canonicalJobSignal(canonicalJob));
      },
      publishTransportSignal: async (input) => orchestration.publishTransportSignal(input),
    });
    const executor = new StatelessCanonicalJobExecutor({
      lifecycle: jobs,
      handler,
      workerId: 'vercel-orchestration',
    });
    const stagingC7Harness =
      environment.appEnvironment === 'staging' &&
      environment.evolution.ownerId &&
      environment.stagingRuntimeTestToken
        ? {
            appEnvironment: environment.appEnvironment,
            ownerId: environment.evolution.ownerId,
            accessToken: environment.stagingRuntimeTestToken,
            runSuite: () =>
              withStagingC7Lock(database!, () =>
                runStagingC7Harness({
                  ownerId: environment.evolution.ownerId!,
                  pipeline,
                  lifecycle: jobs,
                  events: eventRepository,
                  canonicalHandler: handler,
                  assertFixtureReady: () =>
                    stagingC7FixtureGuard.isReady({ ownerId: environment.evolution.ownerId! }),
                }),
              ),
          }
        : undefined;
    let databaseVerified = true;
    const orchestrationConfigured = Boolean(
      environment.orchestration.convexUrl && environment.orchestration.vercelToConvexSecret,
    );
    const readinessProbe = async (): Promise<void> => {
      try {
        await database!.verifyConnection();
        databaseVerified = true;
      } catch {
        databaseVerified = false;
      }
    };

    app = buildApi({
      environment: source,
      readiness: () => ({
        databaseVerified,
        // The existing health contract calls this queue readiness. In serverless mode it means a
        // configured durable orchestration handoff, never an in-process pg-boss claim loop.
        queueStarted: orchestrationConfigured,
        modelConfigured: modelConfigured(environment),
      }),
      readinessProbe,
      ...(environment.appEnvironment === 'staging'
        ? {
            stagingRuntime: {
              appEnvironment: environment.appEnvironment,
              ownerId: environment.evolution.ownerId,
              accessToken: environment.stagingRuntimeTestToken,
              pipeline,
              signalCanonicalJob: async (job) => orchestration.scheduleJob(canonicalJobSignal(job)),
              loadCanonicalJobForEvent: async (eventId) =>
                jobs.loadForSourceEvent({ sourceEventId: eventId }),
            },
          }
        : {}),
      ...(stagingC7Harness ? { stagingC7Harness } : {}),
      orchestration: {
        callbackSecret: environment.orchestration.convexToVercelSecret,
        executor,
      },
      ...(localBridgeConfigured
        ? {
            localBridge: {
              accessToken: environment.orchestration.localBridgeToken,
              ownerId: environment.orchestration.localBridgeOwnerId,
              connectionId: environment.orchestration.localBridgeConnectionId,
              deliveries: transportRepository,
              connections: transportRepository,
              pipeline,
              orchestration,
              loadCanonicalJobForEvent: async (eventId) =>
                jobs.loadForSourceEvent({ sourceEventId: eventId }),
            },
          }
        : {}),
    });

    console.info(
      JSON.stringify(
        createSafeLogRecord('api.vercel_runtime.composed', {
          appEnvironment: environment.appEnvironment,
          databaseConfigured: true,
          orchestrationConfigured,
          modelProvider: environment.model.provider,
          modelConfigured: modelConfigured(environment),
          evolutionEnabled: false,
        }),
      ),
    );
    return {
      environment,
      app,
      async stop(): Promise<void> {
        await app?.close().catch(() => undefined);
        await database?.close().catch(() => undefined);
        databaseVerified = false;
      },
    };
  } catch {
    await app?.close().catch(() => undefined);
    await database?.close().catch(() => undefined);
    console.info(
      JSON.stringify(
        createSafeLogRecord('api.vercel_runtime.composition_failed', {
          category: 'startup_dependency',
        }),
      ),
    );
    throw new Error('Vercel API runtime composition failed.');
  }
}
