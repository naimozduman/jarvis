import {
  ContextAssembler,
  ConversationTurnService,
  createConfiguredModelGateway,
  InterventionService,
  ModelBudgetGuard,
  PromptAssembler,
} from '@jarvis/brain';
import type { ConversationCurrentState } from '@jarvis/brain';
import type { RuntimeEnvironment } from '@jarvis/config';
import type {
  CanonicalEvent,
  DurableJob,
  DurableJobInput,
  ProposedAction,
} from '@jarvis/contracts';
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

function jobString(payload: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

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

export function createCanonicalBrain(input: {
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
  /** Optional because cloud Vercel composition never talks to Evolution directly. */
  readonly transportProcessor?: CanonicalTransportProcessor;
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
}

/**
 * Shared stateless handlers used by both the serverless callback and the retained local pg-boss
 * runtime. It rehydrates canonical event data from Neon; no job callback carries conversation
 * text, a provider payload, an owner decision, or a model instruction.
 */
export class CanonicalEventJobHandler implements StatelessJobHandler {
  public constructor(private readonly options: CanonicalEventJobHandlerOptions) {}

  public async execute(job: DurableJob): Promise<void> {
    if (job.jobType === 'jarvis.transport.outbound.send') {
      await this.options.publishTransportSignal?.({
        deliveryId: job.id,
        createdAt: new Date().toISOString(),
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
    if (!event || event.processingStatus === 'processed' || event.processingStatus === 'ignored') {
      return;
    }
    try {
      if (event.eventType === 'internal.conversation.received.v1') {
        await this.processSyntheticConversationEvent(event);
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
    const conversationId = await this.options.conversations.ensureSyntheticConversation({
      ownerId: event.ownerId,
    });
    const response = await this.options.brain.process({
      ownerId: event.ownerId,
      conversationId,
      message: payload.message,
      timestamp: event.occurredAt,
      idempotencyKey: `event-brain:${event.id}`,
      correlationId: event.correlationId,
      causationId: event.causationId ?? null,
      sourceEventId: event.id,
      channel: 'internal',
      channelMetadata: { source: 'staging_runtime_synthetic' },
      currentState: currentCanonicalConversationState(this.options.environment),
    });
    await this.options.events.markProcessed({
      event,
      summary: safeConversationSummary(response.status),
    });
  }
}

export { createDeterministicPhaseOneHandlers };
