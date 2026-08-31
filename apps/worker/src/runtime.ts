import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import {
  ContextAssembler,
  ConversationTurnService,
  createConfiguredModelGateway,
  InterventionService,
  ModelBudgetGuard,
  PromptAssembler,
} from '@jarvis/brain';
import { loadWorkerEnvironment } from '@jarvis/config';
import type { EnvironmentSource, RuntimeEnvironment } from '@jarvis/config';
import type { CanonicalEvent, DurableJobInput, ProposedAction } from '@jarvis/contracts';
import {
  createDatabaseRuntime,
  DrizzleBrainRepository,
  DrizzleCanonicalEventRepository,
  DrizzleDurableDeliveryOutbox,
  DrizzleDurableJobLifecycleProjection,
  DrizzleInterventionRepository,
  DrizzleRuntimeConversationRepository,
  DrizzleTransactionalEventStore,
  DrizzleTransportConnectionRegistry,
  DrizzleTransportStateRepository,
  PgBossDurableJobTransport,
  type ClaimedDurableJob,
  type DatabaseRuntime,
  type JarvisDatabase,
} from '@jarvis/database';
import { createDeterministicPhaseOneHandlers, processCanonicalEvent } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';
import {
  EvolutionClient,
  EvolutionMessagingTransport,
  opaqueEvolutionReference,
  ownerTargetReference,
  verifyEvolutionVersionGate,
} from '@jarvis/integrations-evolution';
import { createSafeLogRecord } from '@jarvis/observability';
import { evaluateOwnerTransportDelivery, evaluatePolicy } from '@jarvis/security';

import { createWorkerHealthServer } from './app.js';
import {
  handleTransportOutboundJob,
  type OwnerDeliveryPolicyPort,
  TransportEventProcessor,
  TransportOutboundWorker,
} from './transport-workflows.js';

function parseSyntheticConversationEvent(value: unknown): { readonly message: string } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== 'kind' && key !== 'message') ||
    record.kind !== 'synthetic_conversation_turn' ||
    typeof record.message !== 'string'
  ) {
    return undefined;
  }
  const message = record.message.trim();
  return message.length > 0 && message.length <= 4_000 ? { message } : undefined;
}

export interface WorkerRuntimeServices {
  readonly database: DatabaseRuntime;
  readonly jobs: PgBossDurableJobTransport;
  readonly pipeline: EventPipelineDependencies;
  readonly brain: ConversationTurnService;
  readonly eventRepository: DrizzleCanonicalEventRepository;
  readonly conversationRepository: DrizzleRuntimeConversationRepository;
  readonly transportRepository: DrizzleTransportStateRepository;
  readonly jobLifecycle: DrizzleDurableJobLifecycleProjection;
  readonly evolution: WorkerEvolutionRuntime | undefined;
}

export interface WorkerEvolutionRuntime {
  readonly connectionId: string;
  readonly transport: EvolutionMessagingTransport;
}

export interface WorkerRuntime {
  readonly environment: RuntimeEnvironment;
  readonly healthServer: Server;
  readonly services: WorkerRuntimeServices | undefined;
  /** Starts a long-lived Railway-style health process after durable workers are registered. */
  start(): Promise<void>;
  /** Stops HTTP intake, pg-boss claims, and database connections in that order. */
  stop(): Promise<void>;
}

export interface WorkerRuntimeFactories {
  readonly createDatabase?: (input: {
    readonly connectionString: string;
    readonly maxConnections: number;
  }) => DatabaseRuntime;
  readonly createJobTransport?: (input: {
    readonly connectionString: string;
    readonly applicationName: string;
  }) => PgBossDurableJobTransport;
}

export interface CreateWorkerRuntimeOptions {
  readonly environment?: EnvironmentSource;
  readonly factories?: WorkerRuntimeFactories;
  readonly listen?: (server: Server, port: number) => Promise<void>;
  readonly log?: (record: ReturnType<typeof createSafeLogRecord>) => void;
}

interface ReadinessState {
  databaseVerified: boolean;
  queueStarted: boolean;
  workerHandlersRegistered: boolean;
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
      return evaluatePolicy(action, { ownerAuthorized: true });
    },
  };
}

function composeBrain(input: {
  readonly environment: RuntimeEnvironment;
  readonly database: JarvisDatabase;
  readonly pipeline: Pick<EventPipelineDependencies, 'store' | 'policy'>;
}): ConversationTurnService {
  return new ConversationTurnService({
    repository: new DrizzleBrainRepository(input.database),
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
  });
}

async function composeEvolution(input: {
  readonly environment: RuntimeEnvironment;
  readonly database: JarvisDatabase;
}): Promise<WorkerEvolutionRuntime | undefined> {
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
    !evolution.providerBuildId ||
    !evolution.baileysVersion ||
    !evolution.imageDigest
  ) {
    throw new Error('Evolution worker composition requires the validated enabled configuration.');
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
    throw new Error('Evolution worker composition refused an unverified provider build.');
  }
  const connectionId = await new DrizzleTransportConnectionRegistry(
    input.database,
  ).ensureEvolutionConnection({
    ownerId: evolution.ownerId,
    instanceReference: opaqueEvolutionReference('instance', evolution.whatsappInstance),
    providerBuildId: evolution.providerBuildId,
    baileysVersion: evolution.baileysVersion,
    imageDigest: evolution.imageDigest,
    versionVerified: true,
  });
  return {
    connectionId,
    transport: new EvolutionMessagingTransport({
      client: new EvolutionClient({ baseUrl: evolution.baseUrl, apiKey: evolution.apiKey }),
      instanceName: evolution.whatsappInstance,
      ownerPhone: evolution.ownerPhone,
      connectionId,
      versionEvidence,
    }),
  };
}

function jobString(data: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function currentState(environment: RuntimeEnvironment) {
  return {
    contextRecords: [],
    hardOverrideIds: [],
    availableData: [],
    existingPlanBlocks: [],
    availableDayPlanIds: [],
    hasConflict: false,
    highConsequence: false,
    remainingDeepCalls: environment.brain.dailyDeepCallLimit,
    maximumModelCalls: environment.brain.maxModelCallsPerCycle,
    callsAlreadyMade: 0,
    dailyModelSpendEstimateUsd: 0,
    dailyDeepCallsUsed: 0,
  } as const;
}

function safeConversationSummary(status: string): string {
  return status === 'not_configured'
    ? 'The canonical conversation completed with the model gateway explicitly not configured.'
    : 'The canonical synthetic conversation was processed through the configured Brain boundary.';
}

async function processEventJob(input: {
  readonly job: ClaimedDurableJob;
  readonly environment: RuntimeEnvironment;
  readonly pipeline: EventPipelineDependencies;
  readonly repository: DrizzleCanonicalEventRepository;
  readonly conversations: DrizzleRuntimeConversationRepository;
  readonly brain: ConversationTurnService;
  readonly transportProcessor: TransportEventProcessor | undefined;
}): Promise<void> {
  const eventId = jobString(input.job.data, 'eventId');
  const ownerId = jobString(input.job.data, 'ownerId');
  if (!eventId || !ownerId) {
    throw new Error('validation: an event-processing job lacks its canonical owner/event scope.');
  }
  const event = await input.repository.load({ ownerId, eventId });
  if (!event || event.processingStatus === 'processed' || event.processingStatus === 'ignored') {
    return;
  }

  try {
    if (event.eventType === 'internal.conversation.received.v1') {
      await processSyntheticConversationEvent({
        event,
        environment: input.environment,
        repository: input.repository,
        conversations: input.conversations,
        brain: input.brain,
      });
      return;
    }
    if (event.eventType.startsWith('whatsapp.')) {
      if (!input.transportProcessor) {
        await input.repository.markIgnored({
          event,
          summary: 'The Evolution transport is disabled; no provider event was processed.',
        });
        return;
      }
      await input.repository.markProcessing({
        event,
        summary: 'A durable transport event worker started processing canonical state.',
      });
      const result = await input.transportProcessor.process(event);
      await input.repository.markProcessed({
        event,
        summary: `The durable transport event worker completed with disposition ${result.disposition}.`,
      });
      return;
    }

    await processCanonicalEvent(input.pipeline, event);
  } catch (error) {
    await input.repository
      .markFailed({
        event,
        summary:
          'Durable event processing failed; the job lifecycle retains only a classified error.',
      })
      .catch(() => undefined);
    throw error;
  }
}

async function processSyntheticConversationEvent(input: {
  readonly event: CanonicalEvent;
  readonly environment: RuntimeEnvironment;
  readonly repository: DrizzleCanonicalEventRepository;
  readonly conversations: DrizzleRuntimeConversationRepository;
  readonly brain: ConversationTurnService;
}): Promise<void> {
  const payload = parseSyntheticConversationEvent(input.event.payload);
  if (!payload) {
    throw new Error('validation: the synthetic conversation event payload is malformed.');
  }
  await input.repository.markProcessing({
    event: input.event,
    summary: 'A durable worker started the canonical synthetic conversation.',
  });
  const conversationId = await input.conversations.ensureSyntheticConversation({
    ownerId: input.event.ownerId,
  });
  const response = await input.brain.process({
    ownerId: input.event.ownerId,
    conversationId,
    message: payload.message,
    timestamp: input.event.occurredAt,
    idempotencyKey: `event-brain:${input.event.id}`,
    correlationId: input.event.correlationId,
    causationId: input.event.causationId ?? null,
    sourceEventId: input.event.id,
    channel: 'internal',
    channelMetadata: { source: 'staging_runtime_synthetic' },
    currentState: currentState(input.environment),
  });
  await input.repository.markProcessed({
    event: input.event,
    summary: safeConversationSummary(response.status),
  });
}

function defaultLog(record: ReturnType<typeof createSafeLogRecord>): void {
  console.info(JSON.stringify(record));
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

/**
 * Explicit long-lived worker composition. It starts pg-boss before registering consumers and
 * gives every handler the same canonical database, policy, Brain, and optional transport ports.
 * No process-local timer is used as a durable scheduler or source of truth.
 */
export async function createWorkerRuntime(
  options: CreateWorkerRuntimeOptions = {},
): Promise<WorkerRuntime> {
  const environment = loadWorkerEnvironment(options.environment ?? process.env);
  const readiness: ReadinessState = {
    databaseVerified: false,
    queueStarted: false,
    workerHandlersRegistered: false,
  };
  const log = options.log ?? defaultLog;
  let database: DatabaseRuntime | undefined;
  let jobs: PgBossDurableJobTransport | undefined;
  let healthServer: Server | undefined;
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
    let services: WorkerRuntimeServices | undefined;
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
          applicationName: 'jarvis-worker',
        }) ??
        new PgBossDurableJobTransport({
          connectionString: environment.databaseUrl,
          applicationName: 'jarvis-worker',
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
      const evolution = await composeEvolution({ environment, database: database.db });
      const brain = composeBrain({ environment, database: database.db, pipeline });
      const eventRepository = new DrizzleCanonicalEventRepository(database.db);
      const conversationRepository = new DrizzleRuntimeConversationRepository(database.db);
      const jobLifecycle = new DrizzleDurableJobLifecycleProjection(database.db);
      let transportProcessor: TransportEventProcessor | undefined;

      if (evolution && environment.evolution.ownerPhone) {
        const configuredOwnerTargetReference = ownerTargetReference(
          environment.evolution.ownerPhone,
        );
        const ownerDeliveryPolicy: OwnerDeliveryPolicyPort = {
          evaluate: ({ intent, connectionStatus }) =>
            evaluateOwnerTransportDelivery({
              intent,
              configuredOwnerTargetReference,
              outboundKillSwitchActive: false,
              transportConnected: connectionStatus.state === 'connected',
              versionVerified: evolution.transport.versionGate.verified,
              ownerConversationVerified: true,
              quietModeActive: false,
            }),
        };
        const outbox = new DrizzleDurableDeliveryOutbox(database.db, jobs);
        transportProcessor = new TransportEventProcessor({
          repository: transportRepository,
          brain,
          currentState: {
            async load() {
              return currentState(environment);
            },
          },
          deliveryOutbox: outbox,
          ownerDeliveryPolicy,
          connectionStatus: evolution.transport,
          connectionId: evolution.connectionId,
          configuredOwnerTargetReference,
        });
        const outboundWorker = new TransportOutboundWorker({
          repository: transportRepository,
          transport: evolution.transport,
          ownerDeliveryPolicy,
        });
        await jobs.registerWorker(
          'jarvis.transport.outbound.send',
          async (job) =>
            handleTransportOutboundJob({
              job,
              loader: {
                load: (input) => transportRepository.loadOutboundDeliveryIntent(input),
              },
              worker: outboundWorker,
            }),
          jobLifecycle,
        );
      }

      await jobs.registerWorker(
        'jarvis.event.process',
        async (job) =>
          processEventJob({
            job,
            environment,
            pipeline,
            repository: eventRepository,
            conversations: conversationRepository,
            brain,
            transportProcessor,
          }),
        jobLifecycle,
      );
      readiness.workerHandlersRegistered = true;
      services = {
        database,
        jobs,
        pipeline,
        brain,
        eventRepository,
        conversationRepository,
        transportRepository,
        jobLifecycle,
        evolution,
      };
    }

    healthServer = createWorkerHealthServer({
      environment: options.environment ?? process.env,
      readiness: () => ({
        databaseVerified: readiness.databaseVerified,
        queueStarted: readiness.queueStarted,
        workerHeartbeatVerified: readiness.workerHandlersRegistered,
        modelConfigured:
          environment.model.provider === 'vercel-ai-gateway'
            ? Boolean(environment.model.oidcToken)
            : Boolean(environment.model.apiKey),
      }),
      readinessProbe: probeDatabase,
    });
    log(
      createSafeLogRecord('worker.runtime.composed', {
        appEnvironment: environment.appEnvironment,
        databaseConfigured: Boolean(environment.databaseUrl),
        modelConfigured: Boolean(environment.openAi.apiKey),
        evolutionEnabled: environment.evolution.enabled,
      }),
    );

    return {
      environment,
      healthServer,
      services,
      async start(): Promise<void> {
        if (listening) {
          return;
        }
        if (options.listen) {
          await options.listen(healthServer!, environment.workerHealthPort);
        } else {
          await listen(healthServer!, environment.workerHealthPort);
        }
        listening = true;
      },
      async stop(): Promise<void> {
        if (stopped) {
          return;
        }
        stopped = true;
        readiness.queueStarted = false;
        if (listening) {
          await close(healthServer!);
          listening = false;
        }
        await jobs?.stop().catch(() => undefined);
        readiness.workerHandlersRegistered = false;
        await database?.close().catch(() => undefined);
        readiness.databaseVerified = false;
      },
    };
  } catch (error) {
    readiness.queueStarted = false;
    await jobs?.stop().catch(() => undefined);
    await database?.close().catch(() => undefined);
    healthServer?.close();
    log(
      createSafeLogRecord('worker.runtime.composition_failed', { category: 'startup_dependency' }),
    );
    throw error;
  }
}
