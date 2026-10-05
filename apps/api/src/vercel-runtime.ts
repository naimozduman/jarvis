import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { PersonalSystemClient, PersonalAppError } from '@jarvis/integrations';
import { PersonalSystemReadAccess } from '@jarvis/database';
import type { DurableJob } from '@jarvis/contracts';

import type { RuntimeEnvironment } from '@jarvis/config';
import { isVerifiedZeroCostGatewayRoute, loadApiEnvironment } from '@jarvis/config';
import {
  CanonicalOnlyDurableJobTransport,
  createDatabaseRuntime,
  DrizzleCanonicalEventRepository,
  DrizzleDurableDeliveryOutbox,
  DrizzleRequestedReminderFireRepository,
  DrizzleDurableJobLifecycleProjection,
  DrizzleProductionSmokeFixtureRepository,
  DrizzleRuntimeConversationRepository,
  DrizzleStagingC7FixtureGuard,
  DrizzleStagingLunaQualityFixtureRepository,
  DrizzleTransportConnectionRegistry,
  DrizzleTransportStateRepository,
  DrizzleTransactionalEventStore,
  DrizzleWhatsAppCloudIngressRepository,
  DrizzleTelegramBotIngressRepository,
  DrizzleTelegramParticipantEnrollmentRepository,
  DrizzleTelegramBotParticipantRegistry,
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
  createSyntheticQualityPolicyEvaluator,
  SyntheticProtectedAnchorOverlapGateway,
  StatelessCanonicalJobExecutor,
  CanonicalWhatsAppCloudIngestProcessor,
  CanonicalWhatsAppCloudOwnerConversationProcessor,
  CanonicalTelegramBotIngestProcessor,
  CanonicalTelegramBotOwnerConversationProcessor,
  syntheticCasualChatCase,
} from '@jarvis/orchestration';
import {
  createConfiguredModelGateway,
  FakeModelGateway,
  hasVercelAiGatewayOidcToken,
  type ModelGateway,
  type ModelGatewayRequest,
  type ModelGatewayResult,
  VercelAiGatewayModelGateway,
} from '@jarvis/brain';
import { createSafeLogRecord } from '@jarvis/observability';

import { buildApi } from './http-app.js';
import { recoverPhase3d1ExistingJob } from './phase-3-6d1-job-recovery.js';
import { runStagingC7Harness, StagingC7HarnessError } from './staging-c7-harness.js';
import { WhatsAppCloudBridgeSignalPublisher } from './whatsapp-cloud-bridge-signal.js';
import { TelegramBotClient } from './telegram-bot-client.js';
import { TelegramBotDeliveryExecutor } from './telegram-bot-delivery.js';
import { TelegramTypingUx, sendInitialTelegramTyping } from './telegram-typing-ux.js';
import { isTelegramTimingActive, recordTelegramTiming } from './telegram-timing.js';
import { waitUntil } from '@vercel/functions';
import {
  fastChatBenchmarkCandidates,
  loadFastChatBenchmarkProfile,
} from './casual-chat-benchmark-profile.js';

function telegramBotReference(token: string): string {
  return `telegram-bot:${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

/** Captures only the authoritative run receipt for one isolated benchmark invocation. */
class BenchmarkRecordingGateway implements ModelGateway {
  public lastResult: ModelGatewayResult | null = null;
  public constructor(private readonly delegate: ModelGateway) {}

  public async preflight(
    request: ModelGatewayRequest,
    limits: { readonly dynamicContextBudgetTokens: number },
  ) {
    if (!this.delegate.preflight) {
      throw new Error('The benchmark requires the canonical provider admission boundary.');
    }
    return this.delegate.preflight(request, limits);
  }

  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const result = await this.delegate.decide(request);
    this.lastResult = result;
    return result;
  }
}

function withStandardReasoning(environment: RuntimeEnvironment, reasoningEffort: 'medium' | 'low') {
  return {
    ...environment,
    model: {
      ...environment.model,
      standard: { ...environment.model.standard, reasoningEffort },
    },
  } satisfies RuntimeEnvironment;
}

/**
 * Vercel does not require an application-level API_URL and therefore the shared configuration
 * deliberately defaults it to localhost for local development. A Telegram webhook is external
 * and must instead use Vercel's authenticated deployment host whenever the runtime provides it.
 */
function deployedPublicApiUrl(
  environment: RuntimeEnvironment,
  source: Readonly<Record<string, string | undefined>>,
): string {
  const configured = source.VERCEL_PROJECT_PRODUCTION_URL ?? source.VERCEL_URL;
  if (!configured) return environment.apiUrl.replace(/\/$/, '');
  const url = configured.startsWith('https://') ? configured : `https://${configured}`;
  return new URL(url).origin;
}

export interface VercelApiRuntime {
  readonly environment: RuntimeEnvironment;
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

/** Identity resolved by Vercel's official helper for one Function invocation only. */
export interface VercelInvocationIdentity {
  readonly oidcToken?: string;
}

/**
 * Builds an invocation-local configuration view without mutating `process.env`. An ambient
 * `VERCEL_OIDC_TOKEN` is deliberately ignored: only identity explicitly obtained for this
 * invocation may enable the Gateway adapter.
 */
export function environmentSourceForVercelInvocation(
  identity: VercelInvocationIdentity,
  source: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  return { ...source, VERCEL_OIDC_TOKEN: identity.oidcToken };
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


async function modelConfigured(environment: RuntimeEnvironment): Promise<boolean> {
  if (environment.model.provider !== 'vercel-ai-gateway') {
    return Boolean(environment.model.apiKey);
  }
  if (!(await hasVercelAiGatewayOidcToken(environment.model))) return false;
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
  identity: VercelInvocationIdentity = {},
  source: Readonly<Record<string, string | undefined>> = process.env,
): Promise<VercelApiRuntime> {
  const invocationSource = environmentSourceForVercelInvocation(identity, source);
  const environment = loadApiEnvironment(invocationSource);
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
    // Same repository, context assembler, prompt modules, model gateway, and budget guard as the
    // canonical Brain. The staging-only policy composition prevents a quality fixture from
    // executing even a normally allowed low-risk internal action.
    const syntheticQualityPipeline: Pick<EventPipelineDependencies, 'store' | 'policy'> = {
      store: pipeline.store,
      policy: createSyntheticQualityPolicyEvaluator(),
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
    const brain = createCanonicalBrain({
      environment,
      database: database.db,
      pipeline,
      routingTelemetry: (record) => {
        console.info(JSON.stringify(createSafeLogRecord('brain.routing', { ...record })));
        if (record.phase === 'model_completed' && isTelegramTimingActive())
          recordTelegramTiming('model_complete', {
            requestId: record.requestId,
            latencyMs: record.latencyMs,
          });
      },
    });
    const syntheticQualityBrain = createCanonicalBrain({
      environment,
      database: database.db,
      pipeline: syntheticQualityPipeline,
    });
    const syntheticQualityFixtures = new DrizzleStagingLunaQualityFixtureRepository(database.db);
    const productionSmokeFixtures = new DrizzleProductionSmokeFixtureRepository(database.db);
    const productionSmokeFailureBrain = createCanonicalBrain({
      environment,
      database: database.db,
      pipeline: syntheticQualityPipeline,
      gateway: new FakeModelGateway([
        {
          kind: 'failure',
          status: 'unavailable',
          safeError: 'Synthetic production-smoke provider failure. No fallback was attempted.',
        },
      ]),
    });
    const productionSmokeOverlapBrain = createCanonicalBrain({
      environment,
      database: database.db,
      pipeline: syntheticQualityPipeline,
      gateway: new SyntheticProtectedAnchorOverlapGateway(),
    });
    const localBridgeConfigured = environment.orchestration.localBridgeEnabled;
    const whatsappCloudIngestConfigured = environment.whatsappCloudIngest.enabled;
    const whatsappCloudOwnerDirectConfigured =
      whatsappCloudIngestConfigured && environment.whatsappCloudIngest.ownerDirectMessagingEnabled;
    // The authenticated webhook may be registered and retain observations while reply gates are
    // disabled. No Telegram event reaches Brain until both explicit gates are true.
    const telegramBotConfigured = Boolean(
      environment.ownerId && environment.telegramBot.token && environment.telegramBot.webhookSecret,
    );
    const telegramOwnerDirectConfigured =
      telegramBotConfigured &&
      environment.telegramBot.enabled &&
      environment.telegramBot.ownerDirectMessagingEnabled;
    const deliveryOutbox = new DrizzleDurableDeliveryOutbox(database.db, jobTransport);
    const transportProcessor = localBridgeConfigured
      ? new CanonicalTransportEventProcessor({
          environment,
          repository: transportRepository,
          connectionPolicies: transportRepository,
          brain,
          deliveryOutbox,
          connectionId: environment.orchestration.localBridgeConnectionId!,
          configuredOwnerTargetReference:
            environment.orchestration.localBridgeOwnerTargetReference!,
        })
      : undefined;
    const whatsappCloudIngestProcessor = whatsappCloudIngestConfigured
      ? new CanonicalWhatsAppCloudIngestProcessor(
          new DrizzleWhatsAppCloudIngressRepository(database.db),
        )
      : undefined;
    const whatsappCloudConnectionId = whatsappCloudOwnerDirectConfigured
      ? await new DrizzleTransportConnectionRegistry(database.db).ensureWhatsAppCloudConnection({
          ownerId: environment.ownerId!,
          bridgeReference: environment.whatsappCloudIngest.deliveryBridgeId!,
          outboundEnabled: true,
        })
      : undefined;
    const telegramConnectionId = telegramBotConfigured
      ? await new DrizzleTransportConnectionRegistry(database.db).ensureTelegramBotConnection({
          ownerId: environment.ownerId!,
          botReference: telegramBotReference(environment.telegramBot.token!),
          outboundEnabled: telegramOwnerDirectConfigured,
        })
      : undefined;
    const telegramParticipants = telegramBotConfigured
      ? new DrizzleTelegramBotParticipantRegistry(database.db)
      : undefined;
    const telegramEnrollment = telegramBotConfigured
      ? new DrizzleTelegramParticipantEnrollmentRepository(database.db)
      : undefined;
    const telegramClient = telegramBotConfigured
      ? new TelegramBotClient(environment.telegramBot.token!)
      : undefined;
    const telegramBotIngestProcessor = telegramOwnerDirectConfigured
      ? new CanonicalTelegramBotIngestProcessor(
          new DrizzleTelegramBotIngressRepository(database.db),
        )
      : undefined;
    const telegramBotOwnerConversationProcessor =
      telegramOwnerDirectConfigured && telegramConnectionId && telegramEnrollment && telegramClient
        ? new CanonicalTelegramBotOwnerConversationProcessor({
            environment,
            brain,
            deliveryOutbox,
            connectionPolicies: transportRepository,
            enrollment: telegramEnrollment,
            connectionId: telegramConnectionId,
            timing: recordTelegramTiming,
            ux: new TelegramTypingUx({
              client: telegramClient,
              refreshOnly: true,
              resolveChatId: async (targetReference) => {
                return (
                  (await telegramParticipants!.loadProviderChatId({
                    ownerId: environment.ownerId!,
                    connectionId: telegramConnectionId,
                    conversationReference: targetReference,
                  })) ?? null
                );
              },
            }),
          })
        : undefined;
    const telegramDeliveryExecutor =
      telegramBotConfigured && telegramConnectionId && telegramParticipants && telegramClient
        ? new TelegramBotDeliveryExecutor({
            ownerId: environment.ownerId!,
            connectionId: telegramConnectionId,
            repository: transportRepository,
            deliveryEnabled: telegramOwnerDirectConfigured,
            client: telegramClient,
          })
        : undefined;
    const whatsappCloudOwnerConversationProcessor =
      whatsappCloudOwnerDirectConfigured && whatsappCloudConnectionId
        ? new CanonicalWhatsAppCloudOwnerConversationProcessor({
            environment,
            brain,
            deliveryOutbox,
            connectionPolicies: transportRepository,
            connectionId: whatsappCloudConnectionId,
          })
        : undefined;
    const whatsappCloudBridgeSignal = whatsappCloudOwnerDirectConfigured
      ? new WhatsAppCloudBridgeSignalPublisher({
          baseUrl: environment.whatsappCloudIngest.deliveryBridgeUrl,
          accessToken: environment.whatsappCloudIngest.deliveryToken,
        })
      : undefined;
    const requestedReminders = new DrizzleRequestedReminderFireRepository(
      database.db,
      deliveryOutbox,
      telegramConnectionId ?? null,
      telegramOwnerDirectConfigured,
    );
    const handler = new CanonicalEventJobHandler({
      processRequestedReminder: (job) => requestedReminders.prepare(job),
      publishReminderJobsForEvent: async (ownerId, eventId) => {
        for (const jobId of await requestedReminders.queuedJobsForEvent(ownerId, eventId)) {
          const canonicalJob = await jobs.load({ jobId });
          if (
            !canonicalJob ||
            canonicalJob.ownerId !== ownerId ||
            canonicalJob.jobType !== 'jarvis.reminder.fire'
          )
            throw new Error('validation: committed reminder job is unavailable.');
          await orchestration.scheduleJob(canonicalJobSignal(canonicalJob));
        }
      },
      environment,
      pipeline,
      events: eventRepository,
      conversations,
      brain,
      syntheticQualityBrain,
      syntheticFailureBrain: productionSmokeFailureBrain,
      syntheticOverlapBrain: productionSmokeOverlapBrain,
      ...(transportProcessor ? { transportProcessor } : {}),
      ...(whatsappCloudIngestProcessor ? { whatsappCloudIngestProcessor } : {}),
      ...(whatsappCloudOwnerConversationProcessor
        ? { whatsappCloudOwnerConversationProcessor }
        : {}),
      ...(telegramBotIngestProcessor ? { telegramBotIngestProcessor } : {}),
      ...(telegramBotOwnerConversationProcessor ? { telegramBotOwnerConversationProcessor } : {}),
      scheduleOutboundJob: async (input) => {
        const canonicalJob = await jobs.load({ jobId: input.deliveryId });
        if (!canonicalJob) {
          throw new Error('The committed outbound delivery is missing its canonical job record.');
        }
        await orchestration.scheduleJob(canonicalJobSignal(canonicalJob));
      },
      publishTransportSignal: async (input) => orchestration.publishTransportSignal(input),
      ...(whatsappCloudBridgeSignal
        ? {
            publishWhatsAppCloudBridgeSignal: async (input: {
              readonly deliveryId: string;
              readonly createdAt: string;
            }) => whatsappCloudBridgeSignal.publish(input),
          }
        : {}),
      ...(telegramDeliveryExecutor
        ? {
            publishTelegramBotDelivery: async (input: { readonly job: DurableJob }) =>
              telegramDeliveryExecutor.execute(input.job),
          }
        : {}),
    });
    const executor = new StatelessCanonicalJobExecutor({
      lifecycle: jobs,
      handler,
      workerId: 'vercel-orchestration',
    });
    const stagingC7Harness =
      environment.appEnvironment === 'staging' &&
      environment.ownerId &&
      environment.stagingRuntimeTestToken
        ? {
            appEnvironment: environment.appEnvironment,
            ownerId: environment.ownerId,
            accessToken: environment.stagingRuntimeTestToken,
            runSuite: () =>
              withStagingC7Lock(database!, () =>
                runStagingC7Harness({
                  ownerId: environment.ownerId!,
                  pipeline,
                  lifecycle: jobs,
                  events: eventRepository,
                  canonicalHandler: handler,
                  assertFixtureReady: () =>
                    stagingC7FixtureGuard.isReady({ ownerId: environment.ownerId! }),
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

    const personalClient = new PersonalSystemClient(environment.personalApps);
    const personalAccess =
      environment.personalSystemRead.token && environment.ownerId
        ? new PersonalSystemReadAccess(database.db, environment.ownerId)
        : undefined;
    app = buildApi({
      ...(personalAccess && environment.personalSystemRead.token
        ? {
            personalSystem: {
              readToken: environment.personalSystemRead.token,
              ...(environment.personalSystemRead.nextToken
                ? { nextReadToken: environment.personalSystemRead.nextToken }
                : {}),
              today: (query) => personalClient.today(query),
              status: () =>
                Promise.all(
                  (['ourhours', 'growth', 'iron'] as const).map(async (sourceApp) => {
                    try {
                      return {
                        sourceApp,
                        response: await personalClient.read(sourceApp, 'status'),
                      };
                    } catch (error) {
                      return {
                        sourceApp,
                        error: error instanceof PersonalAppError ? error.code : 'unavailable',
                      };
                    }
                  }),
                ),
              admit: (resource, credential) => personalAccess.admit(resource, credential),
              logRejection: (reason) =>
                console.info(
                  JSON.stringify(createSafeLogRecord('personal_system.read.rejected', { reason })),
                ),
            },
          }
        : {}),
      environment: invocationSource,
      readiness: async () => ({
        databaseVerified,
        // The existing health contract calls this queue readiness. In serverless mode it means a
        // configured durable orchestration handoff, never an in-process pg-boss claim loop.
        queueStarted: orchestrationConfigured,
        modelConfigured: await modelConfigured(environment),
      }),
      readinessProbe,
      ...(environment.appEnvironment === 'staging'
        ? {
            stagingRuntime: {
              appEnvironment: environment.appEnvironment,
              ownerId: environment.ownerId,
              accessToken: environment.stagingRuntimeTestToken,
              pipeline,
              prepareQualityCase: async ({ caseId }) =>
                syntheticQualityFixtures.ensure({ ownerId: environment.ownerId!, caseId }),
              prepareProductionSmokeCase: async ({ runId, caseId }) =>
                productionSmokeFixtures.ensure({ runId, caseId }),
              cleanupProductionSmokeRun: async ({ runId }) =>
                productionSmokeFixtures.cleanup({ runId }),
              signalCanonicalJob: async (job) => orchestration.scheduleJob(canonicalJobSignal(job)),
              loadCanonicalJobForEvent: async (eventId) =>
                jobs.loadForSourceEvent({ sourceEventId: eventId }),
            },
          }
        : {}),
      ...(stagingC7Harness ? { stagingC7Harness } : {}),
      ...(environment.appEnvironment === 'staging' && environment.stagingPhase3d1RecoveryToken
        ? {
            phase3d1JobRecovery: {
              accessToken: environment.stagingPhase3d1RecoveryToken,
              recover: () => recoverPhase3d1ExistingJob({ jobs, orchestration }),
            },
          }
        : {}),
      ...(environment.stagingRuntimeTestToken
        ? {
            casualChatBenchmark: {
              accessToken: environment.stagingRuntimeTestToken,
              cleanupProductionSmokeRun: async ({ runId }) =>
                productionSmokeFixtures.cleanup({ runId }),
              runCasualChatBenchmark: async ({ runId, caseId, reasoning, candidate }) => {
                // Reuse the existing disposable production-smoke owner lifecycle, never the real
                // owner. The normal fixture gives every frozen chat case the same schedule/report
                // context while the synthetic policy inhibits execution of any accidental intent.
                const prepared = await productionSmokeFixtures.ensure({
                  runId,
                  caseId: 'grounded_context_question',
                });
                const conversationId = await conversations.ensureSyntheticConversation({
                  ownerId: prepared.ownerId,
                  scope: `casual-chat-benchmark:${runId}:${candidate ?? reasoning}:${caseId}`,
                });
                const baseEnvironment = withStandardReasoning(environment, reasoning);
                const selectedEnvironment = candidate
                  ? {
                      ...baseEnvironment,
                      model: {
                        ...baseEnvironment.model,
                        standard: {
                          ...baseEnvironment.model.standard,
                          ...fastChatBenchmarkCandidates[candidate],
                        },
                      },
                    }
                  : baseEnvironment;
                const gateway = new BenchmarkRecordingGateway(
                  candidate && candidate !== 'luna_low'
                    ? new VercelAiGatewayModelGateway(
                        selectedEnvironment.model,
                        undefined,
                        undefined,
                        loadFastChatBenchmarkProfile,
                      )
                    : createConfiguredModelGateway(selectedEnvironment.model),
                );
                const benchmarkBrain = createCanonicalBrain({
                  environment: selectedEnvironment,
                  database: database!.db,
                  pipeline: syntheticQualityPipeline,
                  gateway,
                  casualChatRoutingEnabled: false,
                });
                const fixture = syntheticCasualChatCase({
                  runId,
                  caseId,
                  ownerId: prepared.ownerId,
                });
                const startedAt = Date.now();
                const response = await benchmarkBrain.process({
                  ownerId: prepared.ownerId,
                  conversationId,
                  message: fixture.message,
                  timestamp: '2099-04-05T12:00:00.000Z',
                  idempotencyKey: `casual-chat-benchmark:${runId}:${candidate ?? reasoning}:${caseId}`,
                  correlationId: randomUUID(),
                  causationId: null,
                  sourceEventId: null,
                  purpose: fixture.purpose,
                  channel: 'telegram',
                  channelMetadata: {
                    transport: 'telegram_bot',
                    conversationType: 'direct',
                    ownerVerified: true,
                    synthetic: true,
                  },
                  currentState: fixture.currentState,
                });
                const capturedModelRun = gateway.lastResult?.run ?? null;
                // A benchmark replay must not pay for a second model call. Recover the already
                // committed, synthetic-only receipt by its canonical request ID instead.
                const persistedModelRun = capturedModelRun
                  ? null
                  : ((
                      await database!.pool.query<{
                        readonly provider: string;
                        readonly actual_model_id: string | null;
                        readonly configured_model_id: string;
                        readonly reasoning_effort: string | null;
                        readonly input_tokens: number | null;
                        readonly output_tokens: number | null;
                        readonly reasoning_tokens: number | null;
                        readonly exact_gateway_cost_usd: string | null;
                        readonly latency_ms: number | null;
                      }>(
                        `select provider, actual_model_id, configured_model_id, reasoning_effort,
                                input_tokens, output_tokens, reasoning_tokens,
                                exact_gateway_cost_usd, latency_ms
                           from jarvis.model_runs
                          where owner_id = $1::uuid and brain_request_id = $2::uuid
                          order by created_at desc limit 1`,
                        [prepared.ownerId, response.requestId],
                      )
                    ).rows[0] ?? null);
                return {
                  responseStatus: response.status,
                  responseMessage: response.conversationResponse?.message ?? null,
                  strictSchemaSuccess: Boolean(
                    response.conversationResponse &&
                    (response.status === 'completed' || response.status === 'duplicate'),
                  ),
                  errorCategory: capturedModelRun?.errorCategory ?? null,
                  model: {
                    provider: capturedModelRun?.provider ?? persistedModelRun?.provider ?? null,
                    modelId:
                      capturedModelRun?.actualModelId ??
                      capturedModelRun?.configuredModelId ??
                      persistedModelRun?.actual_model_id ??
                      persistedModelRun?.configured_model_id ??
                      null,
                    reasoningEffort:
                      capturedModelRun?.reasoningEffort ??
                      persistedModelRun?.reasoning_effort ??
                      null,
                    inputTokens:
                      capturedModelRun?.inputTokens ?? persistedModelRun?.input_tokens ?? null,
                    outputTokens:
                      capturedModelRun?.outputTokens ?? persistedModelRun?.output_tokens ?? null,
                    reasoningTokens:
                      capturedModelRun?.reasoningTokens ??
                      persistedModelRun?.reasoning_tokens ??
                      null,
                    exactGatewayCostUsd:
                      capturedModelRun?.estimatedCostUsd ??
                      (persistedModelRun?.exact_gateway_cost_usd === null ||
                      persistedModelRun?.exact_gateway_cost_usd === undefined
                        ? null
                        : Number(persistedModelRun.exact_gateway_cost_usd)),
                    modelLatencyMs:
                      capturedModelRun?.latencyMs ?? persistedModelRun?.latency_ms ?? null,
                  },
                  brainProcessingLatencyMs: Date.now() - startedAt,
                };
              },
            },
          }
        : {}),
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
      ...(whatsappCloudIngestConfigured
        ? {
            whatsappCloudIngest: {
              accessToken: environment.whatsappCloudIngest.accessToken,
              ownerId: environment.ownerId,
              expectedInstanceId: environment.whatsappCloudIngest.expectedInstanceId,
              pipeline,
              orchestration,
              loadCanonicalJobForEvent: async (eventId) =>
                jobs.loadForSourceEvent({ sourceEventId: eventId }),
            },
          }
        : {}),
      ...(whatsappCloudOwnerDirectConfigured && whatsappCloudConnectionId
        ? {
            whatsappCloudBridge: {
              accessToken: environment.whatsappCloudIngest.deliveryToken,
              ownerId: environment.ownerId,
              connectionId: whatsappCloudConnectionId,
              bridgeId: environment.whatsappCloudIngest.deliveryBridgeId,
              deliveries: transportRepository,
              orchestration,
            },
          }
        : {}),
      ...(telegramBotConfigured && telegramConnectionId && telegramParticipants
        ? {
            telegramBot: {
              webhookSecret: environment.telegramBot.webhookSecret,
              ownerId: environment.ownerId,
              pipeline,
              orchestration,
              ownerDirectMessagingEnabled: telegramOwnerDirectConfigured,
              inbound: new DrizzleTelegramBotIngressRepository(database.db),
              isEnrolledOwner: (participantReference: string) =>
                telegramEnrollment!.isEnrolled({
                  ownerId: environment.ownerId!,
                  connectionId: telegramConnectionId,
                  participantReference,
                }),
              launchTyping: (input: {
                readonly providerChatId: string;
                readonly sourceEventId: string;
                readonly eventId: string;
              }) => {
                // No database lookup after launch: the authenticated direct recipient was just
                // persisted and exactly enrolled. waitUntil retains only the best-effort network
                // operation after the webhook response; neither Brain nor queue waits for it.
                waitUntil(sendInitialTelegramTyping({ client: telegramClient!, ...input }));
              },
              recordObservedParticipant: async (input: {
                readonly participantReference: string;
                readonly conversationReference: string;
                readonly providerChatId: string;
                readonly occurredAt: Date;
              }) =>
                telegramParticipants.recordObserved({
                  ownerId: environment.ownerId!,
                  connectionId: telegramConnectionId,
                  ...input,
                }),
              loadCanonicalJobForEvent: async (eventId: string) =>
                jobs.loadForSourceEvent({ sourceEventId: eventId }),
            },
            telegramBotOperator: {
              operatorToken: environment.telegramBot.operatorToken,
              ownerId: environment.ownerId,
              webhookUrl: `${deployedPublicApiUrl(environment, source)}/api/webhooks/telegram`,
              webhookSecret: environment.telegramBot.webhookSecret,
              client: telegramClient,
              events: eventRepository,
              enrollment: telegramEnrollment,
              connectionId: telegramConnectionId,
              databaseRoleFingerprint: async () => {
                const result = await database!.pool.query<{ readonly role: string }>(
                  'select current_user as role',
                );
                const role = result.rows[0]?.role;
                return role ? createHash('sha256').update(role, 'utf8').digest('hex') : undefined;
              },
            },
          }
        : {}),
    });

    // Readiness and composition observe the same invocation-local identity resolved by the
    // entrypoint. This check neither calls a provider nor asks for another platform credential.
    const compositionModelConfigured = await modelConfigured(environment);
    console.info(
      JSON.stringify(
        createSafeLogRecord('api.vercel_runtime.composed', {
          appEnvironment: environment.appEnvironment,
          databaseConfigured: true,
          orchestrationConfigured,
          modelProvider: environment.model.provider,
          modelConfigured: compositionModelConfigured,
          evolutionEnabled: false,
          whatsappCloudIngestEnabled: whatsappCloudIngestConfigured,
          whatsappCloudOwnerDirectMessagingEnabled: whatsappCloudOwnerDirectConfigured,
          telegramBotEnabled: environment.telegramBot.enabled,
          telegramOwnerDirectMessagingEnabled: telegramOwnerDirectConfigured,
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
