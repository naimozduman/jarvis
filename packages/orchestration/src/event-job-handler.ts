import {
  ContextAssembler,
  ConversationTurnService,
  createConfiguredModelGateway,
  InterventionService,
  ModelBudgetGuard,
  PromptAssembler,
} from '@jarvis/brain';
import type {
  ConversationCurrentState,
  ModelGateway,
  ModelGatewayRequest,
  ModelGatewayResult,
} from '@jarvis/brain';
import type { RuntimeEnvironment } from '@jarvis/config';
import { initialJobDispatchGeneration } from '@jarvis/contracts';
import type {
  CanonicalEvent,
  DurableJob,
  DurableJobInput,
  ProductionSmokeCaseId,
  ProposedAction,
  SyntheticBrainQualityCaseId,
} from '@jarvis/contracts';
import { isProductionSmokeCaseId, isSyntheticBrainQualityCaseId } from '@jarvis/contracts';
import {
  DrizzleBrainRepository,
  DrizzleInterventionRepository,
  type JarvisDatabase,
} from '@jarvis/database';
import type {
  DrizzleCanonicalEventRepository,
  DrizzleRuntimeConversationRepository,
} from '@jarvis/database';
import { createDeterministicPhaseOneHandlers, processCanonicalEvent } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';
import { evaluatePolicy } from '@jarvis/security';

import type { StatelessJobHandler } from './canonical-job-executor.js';
import type { CanonicalWhatsAppCloudIngestProcessor } from './whatsapp-cloud-ingest-processor.js';
import type { CanonicalWhatsAppCloudOwnerConversationProcessor } from './whatsapp-cloud-owner-conversation-processor.js';
import type {
  CanonicalTelegramBotIngestProcessor,
  CanonicalTelegramBotOwnerConversationProcessor,
} from './telegram-bot-processors.js';
import { productionSmokeCase, syntheticBrainQualityCase } from './synthetic-brain-quality-cases.js';

function jobString(payload: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** A fixed strict-schema overlap fixture; it never calls a provider or chooses an action policy. */
export class SyntheticProtectedAnchorOverlapGateway implements ModelGateway {
  public async decide(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const commitment = request.context.records.find((record) => record.recordType === 'commitment');
    const dayPlan = request.context.records.find((record) => record.recordType === 'day_plan');
    const createdAt = new Date().toISOString();
    const run = {
      id: crypto.randomUUID(),
      ownerId: request.request.ownerId,
      brainRequestId: request.request.id,
      provider: 'fake' as const,
      route: request.route,
      configuredModelId: 'synthetic-protected-anchor-overlap',
      actualModelId: 'synthetic-protected-anchor-overlap',
      reasoningEffort: null,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      estimatedCostUsd: 0,
      createdAt,
    };
    if (!commitment || !dayPlan) {
      return {
        status: 'configuration_error',
        safeError: 'The synthetic protected-anchor fixture is missing canonical context.',
        run: { ...run, status: 'configuration_error', errorCategory: 'synthetic_fixture_missing' },
      };
    }
    return {
      status: 'completed',
      decision: {
        decisionType: 'replan',
        conversationResponse: {
          message: 'Scheduled the synthetic admin task.',
          nextAction: 'The plan is updated.',
          tone: 'neutral',
        },
        reasoningSummary: {
          decisionSummary: 'Fixed production-smoke protected-anchor overlap control.',
          importantEvidenceIds: [commitment.recordId, dayPlan.recordId],
          materialTradeoffs: [],
          confidenceBasisPoints: 10_000,
          missingInformation: [],
        },
        evidence: [
          { recordId: commitment.recordId, informationState: 'known' },
          { recordId: dayPlan.recordId, informationState: 'known' },
        ],
        clarification: null,
        proposedActions: [],
        memoryCandidates: [],
        planProposal: {
          dayPlanId: dayPlan.recordId,
          trigger: 'conflict',
          operations: [
            {
              operation: 'schedule_existing_commitment',
              commitmentId: commitment.recordId,
              startsAt: '2099-04-07T16:30:00.000Z',
              endsAt: '2099-04-07T17:00:00.000Z',
            },
          ],
          newFlexibleBlocks: [],
          tradeoffs: [],
        },
        reminderProposal: null,
        interventionProposal: null,
      },
      run: { ...run, status: 'completed', errorCategory: null },
    };
  }
}

type SyntheticConversationEvent =
  | { readonly kind: 'generic'; readonly message: string }
  | { readonly kind: 'quality'; readonly caseId: SyntheticBrainQualityCaseId }
  | {
      readonly kind: 'production_smoke';
      readonly runId: string;
      readonly caseId: ProductionSmokeCaseId;
    };

function parseSyntheticConversationEvent(value: unknown): SyntheticConversationEvent | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === 'synthetic_conversation_turn') {
    if (
      Object.keys(record).some((key) => key !== 'kind' && key !== 'message') ||
      typeof record.message !== 'string'
    ) {
      return undefined;
    }
    const message = record.message.trim();
    return message.length > 0 && message.length <= 4_000 ? { kind: 'generic', message } : undefined;
  }
  if (record.kind === 'synthetic_brain_quality_case') {
    if (
      Object.keys(record).some((key) => key !== 'kind' && key !== 'caseId') ||
      !isSyntheticBrainQualityCaseId(record.caseId)
    ) {
      return undefined;
    }
    return { kind: 'quality', caseId: record.caseId };
  }
  if (record.kind === 'production_smoke_case') {
    if (
      Object.keys(record).some((key) => key !== 'kind' && key !== 'runId' && key !== 'caseId') ||
      typeof record.runId !== 'string' ||
      !isProductionSmokeCaseId(record.caseId)
    ) {
      return undefined;
    }
    return { kind: 'production_smoke', runId: record.runId, caseId: record.caseId };
  }
  return undefined;
}

export function createCanonicalEventProcessingJob(event: {
  readonly id: string;
  readonly ownerId: string;
  readonly receivedAt: string;
  readonly correlationId: string;
}): DurableJobInput {
  return {
    id: crypto.randomUUID(),
    ownerId: event.ownerId,
    jobType: 'jarvis.event.process',
    payload: { eventId: event.id, ownerId: event.ownerId },
    priority: 0,
    scheduledFor: event.receivedAt,
    availableAfter: event.receivedAt,
    executionDeadline: null,
    dispatchGeneration: initialJobDispatchGeneration,
    maximumAttempts: 5,
    correlationId: event.correlationId,
    sourceEventId: event.id,
    idempotencyKey: `event-process:${event.id}`,
  };
}

export function createCanonicalPolicyEvaluator(): EventPipelineDependencies['policy'] {
  return {
    evaluate(action: ProposedAction) {
      return evaluatePolicy(action, { ownerAuthorized: true });
    },
  };
}

/**
 * The fixed staging quality suite ordinarily retains otherwise-allowed internal mutations as
 * approval evidence. Its one exception is the server-materialized canonical plan action: the
 * synthetic Case 3 fixture must prove the normal policy/executor/verification path against its
 * fixed, source-tagged records. This does not grant any new authority because it returns the
 * unmodified canonical policy evaluation for that action.
 */
export function createSyntheticQualityPolicyEvaluator(): EventPipelineDependencies['policy'] {
  return {
    evaluate(action: ProposedAction) {
      const evaluation = evaluatePolicy(action, { ownerAuthorized: true });
      if (!evaluation.allowed) {
        return evaluation;
      }
      if (action.actionType === 'internal.plan.update') {
        return evaluation;
      }
      return {
        allowed: false,
        requiresApproval: true,
        denied: false,
        reason:
          'Synthetic Luna quality evaluation inhibits action execution; explicit approval is retained as test evidence only.',
        policyVersion: `${evaluation.policyVersion}+staging-quality-guard`,
        matchedRules: [...evaluation.matchedRules, 'staging-quality.execution-inhibited'],
      };
    },
  };
}

export function createCanonicalBrain(input: {
  readonly environment: RuntimeEnvironment;
  readonly database: JarvisDatabase;
  readonly pipeline: Pick<EventPipelineDependencies, 'store' | 'policy'>;
  readonly gateway?: ModelGateway;
  readonly casualChatRoutingEnabled?: boolean;
  readonly routingTelemetry?: ConstructorParameters<
    typeof ConversationTurnService
  >[0]['routingTelemetry'];
}): ConversationTurnService {
  const repository = new DrizzleBrainRepository(input.database);
  return new ConversationTurnService({
    repository,
    casualChatRoutingEnabled:
      input.casualChatRoutingEnabled ??
      (input.environment.model.provider === 'vercel-ai-gateway' &&
        input.environment.model.standard.model === 'openai/gpt-6-luna' &&
        input.environment.model.standard.reasoningEffort === 'medium'),
    ...(input.routingTelemetry ? { routingTelemetry: input.routingTelemetry } : {}),
    gateway: input.gateway ?? createConfiguredModelGateway(input.environment.model),
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

export function currentCanonicalConversationState(
  environment: RuntimeEnvironment,
): ConversationCurrentState {
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
  };
}

function safeConversationSummary(status: string): string {
  return status === 'not_configured'
    ? 'The canonical conversation completed with the model gateway explicitly not configured.'
    : 'The canonical synthetic conversation was processed through the configured Brain boundary.';
}

export interface CanonicalTransportProcessor {
  process(event: CanonicalEvent): Promise<{
    readonly outboundDeliveryId: string | null;
  }>;
}

export interface CanonicalEventJobHandlerOptions {
  readonly environment: RuntimeEnvironment;
  readonly pipeline: EventPipelineDependencies;
  readonly events: DrizzleCanonicalEventRepository;
  readonly conversations: DrizzleRuntimeConversationRepository;
  readonly brain: ConversationTurnService;
  /** Separate Brain composition for fixed quality fixtures: same model/persistence, execution-inhibited policy. */
  readonly syntheticQualityBrain?: ConversationTurnService;
  /** Deterministic failing model boundary used solely by the fixed production-smoke failure case. */
  readonly syntheticFailureBrain?: ConversationTurnService;
  /** Deterministic strict-schema protected-anchor overlap control. */
  readonly syntheticOverlapBrain?: ConversationTurnService;
  /** Optional because cloud Vercel composition never talks to Evolution directly. */
  readonly transportProcessor?: CanonicalTransportProcessor;
  /** Official Cloud API input stays separate from the legacy Evolution transport processor. */
  readonly whatsappCloudIngestProcessor?: CanonicalWhatsAppCloudIngestProcessor;
  /** Optional direct-owner conversation adapter; it reuses the canonical Brain and delivery outbox. */
  readonly whatsappCloudOwnerConversationProcessor?: CanonicalWhatsAppCloudOwnerConversationProcessor;
  readonly telegramBotIngestProcessor?: CanonicalTelegramBotIngestProcessor;
  readonly telegramBotOwnerConversationProcessor?: CanonicalTelegramBotOwnerConversationProcessor;
  readonly processRequestedReminder?: (
    job: DurableJob,
  ) => Promise<{ readonly deliveryId: string | null }>;
  readonly publishReminderJobsForEvent?: (ownerId: string, eventId: string) => Promise<void>;
  /** Schedules only an opaque outbox job ID after its canonical transaction committed. */
  readonly scheduleOutboundJob?: (input: {
    readonly deliveryId: string;
    readonly correlationId: string;
    readonly createdAt: string;
  }) => Promise<void>;
  /** The delivery job itself publishes an opaque wake-up for the local bridge. */
  readonly publishTransportSignal?: (input: {
    readonly deliveryId: string;
    readonly createdAt: string;
  }) => Promise<void>;
  /** Direct opaque wake-up for the separately deployed official Cloud bridge. */
  readonly publishWhatsAppCloudBridgeSignal?: (input: {
    readonly deliveryId: string;
    readonly createdAt: string;
  }) => Promise<void>;
  readonly publishTelegramBotDelivery?: (input: {
    readonly deliveryId: string;
    readonly createdAt: string;
    readonly job: DurableJob;
  }) => Promise<void>;
}

/**
 * Shared stateless handlers used by both the serverless callback and the retained local pg-boss
 * runtime. It rehydrates canonical event data from Neon; no job callback carries conversation
 * text, a provider payload, an owner decision, or a model instruction.
 */
export class CanonicalEventJobHandler implements StatelessJobHandler {
  public constructor(private readonly options: CanonicalEventJobHandlerOptions) {}

  public async execute(job: DurableJob): Promise<void> {
    if (job.jobType === 'jarvis.reminder.fire') {
      if (!this.options.processRequestedReminder)
        throw new Error('configuration: requested reminder handler is unavailable.');
      const result = await this.options.processRequestedReminder(job);
      if (result.deliveryId) {
        if (!this.options.scheduleOutboundJob)
          throw new Error('configuration: reminder delivery publisher is unavailable.');
        await this.options.scheduleOutboundJob({
          deliveryId: result.deliveryId,
          correlationId: job.correlationId,
          createdAt: new Date().toISOString(),
        });
      }
      return;
    }
    if (job.jobType === 'jarvis.transport.outbound.send') {
      const createdAt = new Date().toISOString();
      if (jobString(job.payload, 'transport') === 'whatsapp_cloud') {
        if (!this.options.publishWhatsAppCloudBridgeSignal) {
          throw new Error(
            'configuration: the official Cloud bridge delivery boundary is unavailable.',
          );
        }
        await this.options.publishWhatsAppCloudBridgeSignal({
          deliveryId: job.id,
          createdAt,
        });
        return;
      }
      if (jobString(job.payload, 'transport') === 'telegram_bot') {
        if (!this.options.publishTelegramBotDelivery)
          throw new Error('configuration: Telegram Bot delivery is unavailable.');
        await this.options.publishTelegramBotDelivery({ deliveryId: job.id, createdAt, job });
        return;
      }
      await this.options.publishTransportSignal?.({
        deliveryId: job.id,
        createdAt,
      });
      return;
    }
    if (job.jobType !== 'jarvis.event.process') {
      throw new Error('validation: no serverless handler is registered for this canonical job.');
    }
    const eventId = jobString(job.payload, 'eventId');
    const ownerId = jobString(job.payload, 'ownerId');
    if (!eventId || !ownerId || ownerId !== job.ownerId) {
      throw new Error('validation: an event-processing job lacks canonical owner/event scope.');
    }
    const event = await this.options.events.load({ ownerId, eventId });
    if (!event) return;
    if (event.processingStatus === 'processed' || event.processingStatus === 'ignored') {
      await this.options.publishReminderJobsForEvent?.(ownerId, eventId);
      return;
    }
    try {
      if (event.eventType === 'internal.conversation.received.v1') {
        await this.processSyntheticConversationEvent(event);
        await this.options.publishReminderJobsForEvent?.(ownerId, eventId);
        return;
      }
      if (event.eventType === 'whatsapp.cloud.message.observed.v1') {
        if (!this.options.whatsappCloudIngestProcessor) {
          throw new Error(
            'configuration: the official Cloud API ingress processor is unavailable.',
          );
        }
        await this.options.events.markProcessing({
          event,
          summary: 'A privacy-filtered WhatsApp Cloud message is being recorded canonically.',
        });
        const persisted = await this.options.whatsappCloudIngestProcessor.process(event);
        const conversation = this.options.whatsappCloudOwnerConversationProcessor
          ? await this.options.whatsappCloudOwnerConversationProcessor.process({
              event,
              message: persisted,
            })
          : undefined;
        if (conversation?.outboundDeliveryId) {
          await this.options.scheduleOutboundJob?.({
            deliveryId: conversation.outboundDeliveryId,
            correlationId: event.correlationId,
            createdAt: new Date().toISOString(),
          });
        }
        await this.options.publishReminderJobsForEvent?.(ownerId, eventId);
        await this.options.events.markProcessed({
          event,
          summary: conversation
            ? `The privacy-filtered WhatsApp Cloud message was recorded and handled as a canonical owner conversation (${conversation.disposition}).`
            : 'The privacy-filtered WhatsApp Cloud message was recorded without owner conversation handling.',
        });
        return;
      }
      if (event.eventType === 'telegram.bot.message.observed.v1') {
        if (!this.options.telegramBotIngestProcessor)
          throw new Error('configuration: Telegram ingress processor unavailable.');
        await this.options.events.markProcessing({
          event,
          summary: 'An authenticated Telegram private message is being evaluated canonically.',
        });
        const enrolled = this.options.telegramBotOwnerConversationProcessor;
        if (!enrolled) {
          await this.options.events.markProcessed({
            event,
            summary:
              'The Telegram message was retained as an unenrolled observation; no owner conversation was started.',
          });
          return;
        }
        const persisted = await this.options.telegramBotIngestProcessor.process(event);
        const result = await enrolled.process({ event, message: persisted });
        if (result.outboundDeliveryId)
          await this.options.scheduleOutboundJob?.({
            deliveryId: result.outboundDeliveryId,
            correlationId: event.correlationId,
            createdAt: new Date().toISOString(),
          });
        await this.options.publishReminderJobsForEvent?.(ownerId, eventId);
        await this.options.events.markProcessed({
          event,
          summary: `The authenticated Telegram direct message completed (${result.disposition}).`,
        });
        return;
      }
      if (event.eventType.startsWith('whatsapp.')) {
        if (!this.options.transportProcessor) {
          await this.options.events.markIgnored({
            event,
            summary: 'The local WhatsApp bridge is not connected; no provider event was processed.',
          });
          return;
        }
        await this.options.events.markProcessing({
          event,
          summary: 'A canonical transport event is being processed through the transport boundary.',
        });
        const result = await this.options.transportProcessor.process(event);
        if (result.outboundDeliveryId) {
          await this.options.scheduleOutboundJob?.({
            deliveryId: result.outboundDeliveryId,
            correlationId: event.correlationId,
            createdAt: new Date().toISOString(),
          });
        }
        await this.options.events.markProcessed({
          event,
          summary: 'The canonical transport event finished through its deterministic policy path.',
        });
        return;
      }
      await processCanonicalEvent(this.options.pipeline, event);
      await this.options.publishReminderJobsForEvent?.(ownerId, eventId);
    } catch (error) {
      await this.options.events
        .markFailed({
          event,
          summary: 'Durable event processing failed; the job lifecycle retains a classified error.',
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private async processSyntheticConversationEvent(event: CanonicalEvent): Promise<void> {
    const payload = parseSyntheticConversationEvent(event.payload);
    if (!payload) {
      throw new Error('validation: the synthetic conversation event payload is malformed.');
    }
    await this.options.events.markProcessing({
      event,
      summary: 'A stateless durable handler started the canonical synthetic conversation.',
    });
    const qualityCase =
      payload.kind === 'quality'
        ? syntheticBrainQualityCase({ caseId: payload.caseId, ownerId: event.ownerId })
        : payload.kind === 'production_smoke'
          ? productionSmokeCase({
              runId: payload.runId,
              caseId: payload.caseId,
              ownerId: event.ownerId,
            })
          : undefined;
    if (qualityCase && !this.options.syntheticQualityBrain) {
      throw new Error('configuration: the staging synthetic quality Brain is unavailable.');
    }
    const useFailureBrain =
      payload.kind === 'production_smoke' && payload.caseId === 'simulated_provider_failure';
    const useOverlapBrain =
      payload.kind === 'production_smoke' &&
      payload.caseId === 'protected_anchor_overlap_rejection';
    if (useFailureBrain && !this.options.syntheticFailureBrain) {
      throw new Error('configuration: the production-smoke failing Brain is unavailable.');
    }
    if (useOverlapBrain && !this.options.syntheticOverlapBrain) {
      throw new Error('configuration: the production-smoke overlap Brain is unavailable.');
    }
    const conversationId = await this.options.conversations.ensureSyntheticConversation({
      ownerId: event.ownerId,
      ...(payload.kind === 'production_smoke'
        ? { scope: `production-smoke:${payload.runId}:${payload.caseId}` }
        : qualityCase
          ? { scope: qualityCase.caseId }
          : {}),
    });
    const message = payload.kind === 'generic' ? payload.message : qualityCase!.message;
    const response = await (
      useFailureBrain
        ? this.options.syntheticFailureBrain!
        : useOverlapBrain
          ? this.options.syntheticOverlapBrain!
          : qualityCase
            ? this.options.syntheticQualityBrain!
            : this.options.brain
    ).process({
      ownerId: event.ownerId,
      conversationId,
      message,
      timestamp: event.occurredAt,
      idempotencyKey: `event-brain:${event.id}`,
      correlationId: event.correlationId,
      causationId: event.causationId ?? null,
      sourceEventId: event.id,
      channel: 'internal',
      channelMetadata: {
        source: qualityCase ? 'staging_runtime_synthetic_quality' : 'staging_runtime_synthetic',
        ...(payload.kind === 'production_smoke'
          ? {
              suite: 'production_smoke_2026_09_29',
              smokeRunId: payload.runId,
              caseId: payload.caseId,
            }
          : qualityCase
            ? { suite: 'luna_quality_2026_09_29', caseId: qualityCase.caseId }
            : {}),
      },
      ...(qualityCase ? { purpose: qualityCase.purpose } : {}),
      currentState:
        qualityCase?.currentState ?? currentCanonicalConversationState(this.options.environment),
    });
    await this.options.events.markProcessed({
      event,
      summary: safeConversationSummary(response.status),
    });
  }
}

export { createDeterministicPhaseOneHandlers };
