import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import {
  ContextAssembler,
  ConversationTurnService,
  createConfiguredModelGateway,
  InterventionService,
  ModelBudgetGuard,
  PromptAssembler,
} from '@jarvis/brain';
import { loadApiEnvironment } from '@jarvis/config';
import type { EnvironmentSource, RuntimeEnvironment } from '@jarvis/config';
import type { DurableJobInput, ProposedAction } from '@jarvis/contracts';
import {
  createDatabaseRuntime,
  DrizzleBrainRepository,
  DrizzleCanonicalEventRepository,
  DrizzleDurableJobLifecycleProjection,
  DrizzleInterventionRepository,
  DrizzleRuntimeConversationRepository,
  DrizzleTransactionalEventStore,
  DrizzleTransportConnectionRegistry,
  DrizzleTransportStateRepository,
  PgBossDurableJobTransport,
  type DatabaseRuntime,
  type JarvisDatabase,
} from '@jarvis/database';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';
import {
  EvolutionClient,
  EvolutionHealthCheck,
  EvolutionMessageMapper,
  EvolutionMessagingTransport,
  EvolutionOwnerIdentityResolver,
  EvolutionWebhookParser,
  EvolutionWebhookVerifier,
  opaqueEvolutionReference,
  verifyEvolutionVersionGate,
} from '@jarvis/integrations-evolution';
import { createSafeLogRecord } from '@jarvis/observability';
import { evaluatePolicy } from '@jarvis/security';

import { buildApi } from './app.js';
import type { EvolutionWebhookIngressDependencies } from './evolution-webhook.js';

export interface ApiRuntimeServices {
  readonly database: DatabaseRuntime;
  readonly jobs: PgBossDurableJobTransport;
  readonly pipeline: EventPipelineDependencies;
  readonly brain: ConversationTurnService;
  readonly eventRepository: DrizzleCanonicalEventRepository;
  readonly conversationRepository: DrizzleRuntimeConversationRepository;
  readonly transportRepository: DrizzleTransportStateRepository;
  readonly jobLifecycle: DrizzleDurableJobLifecycleProjection;
  readonly evolution: ApiEvolutionRuntime | undefined;
}

export interface ApiEvolutionRuntime {
  readonly connectionId: string;
  readonly transport: EvolutionMessagingTransport;
  readonly health: EvolutionHealthCheck;
  readonly webhook: EvolutionWebhookIngressDependencies;
}

export interface ApiRuntime {
  readonly environment: RuntimeEnvironment;
  readonly app: FastifyInstance;
  readonly services: ApiRuntimeServices | undefined;
  /** Binds the already composed, verified process to Railway's supplied port. */
  start(): Promise<void>;
  /** Stops HTTP intake first, then pg-boss, then the PostgreSQL pool. Safe to call repeatedly. */
  stop(): Promise<void>;
}

export interface ApiRuntimeFactories {
  readonly createDatabase?: (input: {
    readonly connectionString: string;
    readonly maxConnections: number;
  }) => DatabaseRuntime;
  readonly createJobTransport?: (input: {
    readonly connectionString: string;
    readonly applicationName: string;
  }) => PgBossDurableJobTransport;
}

export interface CreateApiRuntimeOptions {
  readonly environment?: EnvironmentSource;
  readonly factories?: ApiRuntimeFactories;
  /** Tests inject a no-op listener; production uses Fastify's real listener. */
  readonly listen?: (app: FastifyInstance, port: number) => Promise<void>;
  readonly log?: (record: ReturnType<typeof createSafeLogRecord>) => void;
}

interface ReadinessState {
  databaseVerified: boolean;
  queueStarted: boolean;
}

function createEventProcessingJob(event: {
  readonly id: string;
  readonly ownerId: string;
  readonly receivedAt: string;
  readonly correlationId: string;
}): DurableJobInput {
  return {
    id: randomUUID(),
    ownerId: event.ownerId,
    jobType: 'jarvis.event.process',
    // The worker rehydrates the event through an owner-scoped repository; no body/prompt/provider
    // payload is copied into the queue message.
    payload: { eventId: event.id, ownerId: event.ownerId },
    priority: 0,
    scheduledFor: event.receivedAt,
    availableAfter: event.receivedAt,
    maximumAttempts: 5,
    correlationId: event.correlationId,
    sourceEventId: event.id,
    idempotencyKey: `event-process:${event.id}`,
  };
}

function createPolicyEvaluator(): EventPipelineDependencies['policy'] {
  return {
    evaluate(action: ProposedAction) {
      // The only public ingress route derives owner scope from verified server configuration. A
      // model is still not trusted: all of its action intents use this same policy boundary.
      return evaluatePolicy(action, { ownerAuthorized: true });
    },
  };
}

function composeBrain(input: {
  readonly environment: RuntimeEnvironment;
  readonly database: JarvisDatabase;
  readonly pipeline: Pick<EventPipelineDependencies, 'store' | 'policy'>;
}): ConversationTurnService {
  const repository = new DrizzleBrainRepository(input.database);
  return new ConversationTurnService({
    repository,
    gateway: createConfiguredModelGateway(input.environment.model),
    contextAssembler: new ContextAssembler({
      maxContextRecords: input.environment.brain.maxContextRecords,
      maxRecentMessages: input.environment.brain.maxRecentMessages,
      maxApproxPromptTokens: input.environment.brain.maxApproxPromptTokens,
    }),
    promptAssembler: new PromptAssembler(),
    actionPipeline: input.pipeline,
    deepEscalationEnabled: input.environment.brain.deepEscalationEnabled,
    maxRecentMessages: input.environment.brain.maxRecentMessages,
    interventionService: new InterventionService(new DrizzleInterventionRepository(input.database)),
    modelBudgetGuard: new ModelBudgetGuard(input.environment.model, input.environment.brain),
    zeroCostCreditAccounting: repository,
  });
}

async function composeEvolution(input: {
  readonly environment: RuntimeEnvironment;
  readonly database: JarvisDatabase;
  readonly pipeline: EventPipelineDependencies;
  readonly transportRepository: DrizzleTransportStateRepository;
}): Promise<ApiEvolutionRuntime | undefined> {
  if (!input.environment.evolution.enabled) {
    return undefined;
  }

  const evolution = input.environment.evolution;
  if (
    !evolution.ownerId ||
    !evolution.whatsappInstance ||
    !evolution.ownerPhone ||
    !evolution.baseUrl ||
    !evolution.apiKey ||
    !evolution.webhookSecret ||
    !evolution.providerBuildId ||
    !evolution.baileysVersion ||
    !evolution.imageDigest
  ) {
    throw new Error('Evolution runtime composition requires the validated enabled configuration.');
  }

  const versionEvidence = {
    providerBuildId: evolution.providerBuildId,
    baileysVersion: evolution.baileysVersion,
    imageDigest: evolution.imageDigest,
    unstableSourceBuildAllowed: evolution.unstableSourceBuildAllowed,
    appEnvironment: input.environment.appEnvironment,
  } as const;
  const versionGate = verifyEvolutionVersionGate(versionEvidence);
  if (!versionGate.verified) {
    throw new Error('Evolution runtime composition refused an unverified provider build.');
  }

  const instanceReference = opaqueEvolutionReference('instance', evolution.whatsappInstance);
  const connectionId = await new DrizzleTransportConnectionRegistry(
    input.database,
  ).ensureEvolutionConnection({
    ownerId: evolution.ownerId,
    instanceReference,
    providerBuildId: evolution.providerBuildId,
    baileysVersion: evolution.baileysVersion,
    imageDigest: evolution.imageDigest,
    versionVerified: true,
  });
  const client = new EvolutionClient({ baseUrl: evolution.baseUrl, apiKey: evolution.apiKey });
  const transport = new EvolutionMessagingTransport({
    client,
    instanceName: evolution.whatsappInstance,
    ownerPhone: evolution.ownerPhone,
    connectionId,
    versionEvidence,
  });
  const health = new EvolutionHealthCheck(transport, connectionId, true);

  // Construct webhook dependencies here, not in a domain package. `buildApi` receives them via
  // the explicit container below, so disabled runtimes never instantiate an Evolution client.
  const webhook: EvolutionWebhookIngressDependencies = {
    enabled: true,
    ownerId: evolution.ownerId,
    expectedInstanceName: evolution.whatsappInstance,
    pipeline: input.pipeline,
    verifier: new EvolutionWebhookVerifier({ secret: evolution.webhookSecret }),
    parser: new EvolutionWebhookParser(),
    mapper: new EvolutionMessageMapper(
      new EvolutionOwnerIdentityResolver(evolution.ownerPhone, {
        ...(evolution.ownerWhatsAppLid ? { trustedOwnerLids: [evolution.ownerWhatsAppLid] } : {}),
      }),
    ),
    rejectionRecorder: {
      record: async (rejected) =>
        input.transportRepository.recordRejectedTransportEvent({
          ownerId: rejected.ownerId,
          transport: 'evolution_whatsapp',
          instanceReference: rejected.instanceReference,
          providerEventReference: rejected.providerEventReference,
          senderReference: rejected.senderReference,
          eventType: rejected.eventType,
          reason: rejected.reason,
          receivedAt: rejected.receivedAt,
          metadata: { disposition: 'rejected_before_canonical_ingress' },
        }),
    },
    bodyLimitBytes: evolution.webhookMaxBodyBytes,
  };

  return { connectionId, transport, health, webhook };
}

function defaultLog(record: ReturnType<typeof createSafeLogRecord>): void {
  console.info(JSON.stringify(record));
}

/**
 * Explicit process-owned API composition. Imports construct ports only; it establishes the real
 * database and pg-boss lifecycle before callers can bind an HTTP listener. In development/test a
 * missing database leaves only the documented provider-free health foundation—never an in-memory
 * canonical-state fallback. `APP_ENV=staging` cannot take that path because configuration rejects
 * a missing DATABASE_URL first.
 */
export async function createApiRuntime(options: CreateApiRuntimeOptions = {}): Promise<ApiRuntime> {
  const environment = loadApiEnvironment(options.environment ?? process.env);
  const readiness: ReadinessState = {
    databaseVerified: false,
    queueStarted: false,
  };
  const log = options.log ?? defaultLog;
  let database: DatabaseRuntime | undefined;
  let jobs: PgBossDurableJobTransport | undefined;
  let app: FastifyInstance | undefined;
  let stopped = false;
  let listening = false;

  const probeDatabase = async (): Promise<void> => {
    if (!database) {
      return;
    }
    try {
      await database.verifyConnection();
      readiness.databaseVerified = true;
    } catch {
      readiness.databaseVerified = false;
    }
  };

  try {
    let services: ApiRuntimeServices | undefined;
    if (environment.databaseUrl) {
      database =
        options.factories?.createDatabase?.({
          connectionString: environment.databaseUrl,
          maxConnections: 10,
        }) ??
        createDatabaseRuntime({ connectionString: environment.databaseUrl, maxConnections: 10 });
      await database.verifyConnection();
      await database.verifySchemaCompatibility();
      readiness.databaseVerified = true;

      jobs =
        options.factories?.createJobTransport?.({
          connectionString: environment.databaseUrl,
          applicationName: 'jarvis-api',
        }) ??
        new PgBossDurableJobTransport({
          connectionString: environment.databaseUrl,
          applicationName: 'jarvis-api',
        });
      await jobs.start();
      readiness.queueStarted = true;

      const eventStore = new DrizzleTransactionalEventStore(database.db, jobs);
      const pipeline: EventPipelineDependencies = {
        store: eventStore,
        handlers: createDeterministicPhaseOneHandlers(),
        policy: createPolicyEvaluator(),
        createJob: createEventProcessingJob,
      };
      const transportRepository = new DrizzleTransportStateRepository(database.db);
      const evolution = await composeEvolution({
        environment,
        database: database.db,
        pipeline,
        transportRepository,
      });
      services = {
        database,
        jobs,
        pipeline,
        brain: composeBrain({ environment, database: database.db, pipeline }),
        eventRepository: new DrizzleCanonicalEventRepository(database.db),
        conversationRepository: new DrizzleRuntimeConversationRepository(database.db),
        transportRepository,
        jobLifecycle: new DrizzleDurableJobLifecycleProjection(database.db),
        evolution,
      };
    }

    app = buildApi({
      environment: options.environment ?? process.env,
      readiness: () => ({
        databaseVerified: readiness.databaseVerified,
        queueStarted: readiness.queueStarted,
        modelConfigured:
          environment.model.provider === 'vercel-ai-gateway'
            ? Boolean(environment.model.oidcToken)
            : Boolean(environment.model.apiKey),
      }),
      readinessProbe: probeDatabase,
      ...(services?.evolution
        ? {
            evolutionTransportHealth: () => services.evolution!.health.check(),
            evolutionWebhook: services.evolution.webhook,
          }
        : {}),
      ...(services && environment.appEnvironment === 'staging'
        ? {
            stagingRuntime: {
              appEnvironment: environment.appEnvironment,
              ownerId: environment.evolution.ownerId,
              accessToken: environment.stagingRuntimeTestToken,
              pipeline: services.pipeline,
            },
          }
        : {}),
    });

    log(
      createSafeLogRecord('api.runtime.composed', {
        appEnvironment: environment.appEnvironment,
        databaseConfigured: Boolean(environment.databaseUrl),
        modelConfigured:
          environment.model.provider === 'vercel-ai-gateway'
            ? Boolean(environment.model.oidcToken)
            : Boolean(environment.model.apiKey),
        evolutionEnabled: environment.evolution.enabled,
      }),
    );

    return {
      environment,
      app,
      services,
      async start(): Promise<void> {
        if (listening) {
          return;
        }
        if (options.listen) {
          await options.listen(app!, environment.apiPort);
        } else {
          await app!.listen({ host: '0.0.0.0', port: environment.apiPort });
        }
        listening = true;
      },
      async stop(): Promise<void> {
        if (stopped) {
          return;
        }
        stopped = true;
        readiness.queueStarted = false;
        await app!.close().catch(() => undefined);
        await jobs?.stop().catch(() => undefined);
        await database?.close().catch(() => undefined);
        readiness.databaseVerified = false;
      },
    };
  } catch (error) {
    readiness.queueStarted = false;
    await jobs?.stop().catch(() => undefined);
    await database?.close().catch(() => undefined);
    await app?.close().catch(() => undefined);
    // Do not log raw provider/database exception text: connection URLs and headers can be echoed
    // by lower-level clients. The server entry point records only this safe category.
    log(createSafeLogRecord('api.runtime.composition_failed', { category: 'startup_dependency' }));
    throw error;
  }
}
