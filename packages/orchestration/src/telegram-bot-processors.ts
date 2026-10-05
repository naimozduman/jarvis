import { createHash } from 'node:crypto';

import type { ConversationCurrentState, ConversationTurnService } from '@jarvis/brain';
import type { RuntimeEnvironment } from '@jarvis/config';
import {
  telegramBotCanonicalPayloadSchema,
  type CanonicalEvent,
  type OutboundDeliveryIntent,
} from '@jarvis/contracts';
import type {
  CanonicalTransportConnectionPolicyRepository,
  PersistedTelegramBotInboundMessage,
  TelegramBotIngressRepository,
  TelegramParticipantEnrollmentRepository,
} from '@jarvis/database';
import { evaluateOwnerTransportDelivery } from '@jarvis/security';
import type { CanonicalDurableDeliveryOutbox } from './canonical-transport-processor.js';

function deterministicUuid(seed: string): string {
  const h = createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((Number.parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}
function state(environment: RuntimeEnvironment): ConversationCurrentState {
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

export class CanonicalTelegramBotIngestProcessor {
  public constructor(private readonly repository: TelegramBotIngressRepository) {}
  public async process(event: CanonicalEvent): Promise<PersistedTelegramBotInboundMessage> {
    if (
      event.eventType !== 'telegram.bot.message.observed.v1' ||
      event.source !== 'telegram' ||
      !event.sourceEventId
    )
      throw new Error('validation: incorrect Telegram canonical event.');
    const payload = telegramBotCanonicalPayloadSchema.safeParse(event.payload);
    if (!payload.success) throw new Error('validation: malformed Telegram canonical payload.');
    return this.repository.persistInboundMessage({
      ownerId: event.ownerId,
      sourceEventId: event.sourceEventId,
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
      receivedAt: event.receivedAt,
      message: payload.data,
    });
  }
}

export interface TelegramBotTurnUx {
  begin(input: { readonly targetReference: string; readonly operationKey: string }): Promise<void>;
  end?(input: { readonly targetReference: string; readonly operationKey: string }): Promise<void>;
}
export interface CanonicalTelegramBotOwnerConversationProcessorOptions {
  readonly environment: RuntimeEnvironment;
  readonly brain: ConversationTurnService;
  readonly deliveryOutbox: CanonicalDurableDeliveryOutbox;
  readonly connectionPolicies: CanonicalTransportConnectionPolicyRepository;
  readonly enrollment: TelegramParticipantEnrollmentRepository;
  readonly connectionId: string;
  readonly ux?: TelegramBotTurnUx;
  readonly timing?: (
    stage: 'brain_dispatch' | 'response_persisted',
    fields: {
      readonly eventId: string;
      readonly requestId?: string;
      readonly queueLatencyMs?: number;
      readonly status?: string;
    },
  ) => void;
  readonly now?: () => Date;
}
export type TelegramBotOwnerConversationResult = {
  readonly disposition:
    | 'owner_not_enrolled'
    | 'brain_not_ready'
    | 'delivery_policy_blocked'
    | 'brain_enqueued_delivery';
  readonly outboundDeliveryId: string | null;
};

/** Telegram only projects a persisted canonical response into the shared outbox; it owns no authority. */
export class CanonicalTelegramBotOwnerConversationProcessor {
  private readonly now: () => Date;
  public constructor(
    private readonly options: CanonicalTelegramBotOwnerConversationProcessorOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }
  public async process(input: {
    readonly event: CanonicalEvent;
    readonly message: PersistedTelegramBotInboundMessage;
  }): Promise<TelegramBotOwnerConversationResult> {
    const payload = telegramBotCanonicalPayloadSchema.parse(input.event.payload);
    if (
      !(await this.options.enrollment.isEnrolled({
        ownerId: input.event.ownerId,
        connectionId: this.options.connectionId,
        participantReference: payload.participantReference,
      }))
    )
      return { disposition: 'owner_not_enrolled', outboundDeliveryId: null };
    // UX calls are intentionally detached from the authoritative Brain/persistence turn.
    void this.options.ux
      ?.begin({
        targetReference: payload.deliveryTargetReference,
        operationKey: `telegram:turn:${input.event.id}`,
      })
      .catch(() => undefined);
    let response: Awaited<ReturnType<ConversationTurnService['process']>>;
    try {
      this.recordTiming('brain_dispatch', {
        eventId: input.event.id,
        queueLatencyMs: Math.max(
          0,
          this.now().getTime() - new Date(input.event.receivedAt).getTime(),
        ),
      });
      response = await this.options.brain.process({
        ownerId: input.event.ownerId,
        conversationId: input.message.conversationId,
        message: payload.text,
        timestamp: input.event.occurredAt,
        idempotencyKey: `telegram-brain:${input.event.id}`,
        correlationId: input.event.correlationId,
        causationId: input.event.causationId ?? null,
        sourceEventId: input.event.id,
        messageId: input.message.id,
        inboundAlreadyPersisted: true,
        channel: 'telegram',
        channelMetadata: {
          transport: 'telegram_bot',
          conversationType: 'direct',
          ownerVerified: true,
        },
        currentState: state(this.options.environment),
      });
    } finally {
      void this.options.ux
        ?.end?.({
          targetReference: payload.deliveryTargetReference,
          operationKey: `telegram:turn:${input.event.id}`,
        })
        .catch(() => undefined);
    }
    if (
      (response.status !== 'completed' && response.status !== 'duplicate') ||
      !response.conversationResponse ||
      !response.responseMessageId
    )
      return { disposition: 'brain_not_ready', outboundDeliveryId: null };
    this.recordTiming('response_persisted', {
      eventId: input.event.id,
      requestId: response.requestId,
      status: response.status,
    });
    const operationKey = `transport:owner-response:${this.options.connectionId}:${response.responseMessageId}`;
    const intent: OutboundDeliveryIntent = {
      id: deterministicUuid(operationKey),
      ownerId: input.event.ownerId,
      messageId: response.responseMessageId,
      conversationId: input.message.conversationId,
      connectionId: this.options.connectionId,
      transport: 'telegram_bot',
      targetReference: payload.deliveryTargetReference,
      operationKey,
      contentType: 'text',
      content: response.conversationResponse.message,
      mediaObjectReference: null,
      sourceEventId: input.event.id,
      brainRequestId: response.requestId,
      reminderId: null,
      critical: false,
      correlationId: input.event.correlationId,
      causationId: input.event.causationId ?? null,
      createdAt: this.now().toISOString(),
    };
    const connection = await this.options.connectionPolicies.loadCanonicalTransportConnectionPolicy(
      { ownerId: input.event.ownerId, connectionId: this.options.connectionId },
    );
    const policy = evaluateOwnerTransportDelivery({
      intent,
      configuredOwnerTargetReference: payload.deliveryTargetReference,
      outboundKillSwitchActive: !connection?.outboundEnabled,
      transportConnected: connection?.state === 'connected',
      versionVerified: connection?.versionVerified ?? false,
      ownerConversationVerified: true,
      quietModeActive: false,
    });
    if (!policy.allowed)
      return { disposition: 'delivery_policy_blocked', outboundDeliveryId: null };
    const outbox = await this.options.deliveryOutbox.persistAndEnqueue(intent);
    return { disposition: 'brain_enqueued_delivery', outboundDeliveryId: outbox.deliveryId };
  }

  private recordTiming(
    stage: 'brain_dispatch' | 'response_persisted',
    fields: Parameters<
      NonNullable<CanonicalTelegramBotOwnerConversationProcessorOptions['timing']>
    >[1],
  ): void {
    try {
      this.options.timing?.(stage, fields);
    } catch {
      /* Observability is never execution authority. */
    }
  }
}
