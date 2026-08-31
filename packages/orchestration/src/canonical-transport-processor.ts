import { createHash } from 'node:crypto';

import type { ConversationCurrentState, ConversationTurnService } from '@jarvis/brain';
import type { RuntimeEnvironment } from '@jarvis/config';
import {
  normalizedTransportEventSchema,
  type CanonicalEvent,
  type OutboundDeliveryIntent,
} from '@jarvis/contracts';
import type {
  CanonicalTransportConnectionPolicyRepository,
  PersistedTransportMessage,
  TransportStateRepository,
} from '@jarvis/database';
import { evaluateOwnerTransportDelivery } from '@jarvis/security';

export interface CanonicalDurableDeliveryOutbox {
  persistAndEnqueue(intent: OutboundDeliveryIntent): Promise<{
    readonly deliveryId: string;
    readonly duplicate: boolean;
  }>;
}

export interface CanonicalTransportProcessorOptions {
  readonly environment: RuntimeEnvironment;
  readonly repository: TransportStateRepository;
  readonly connectionPolicies: CanonicalTransportConnectionPolicyRepository;
  readonly brain: ConversationTurnService;
  readonly deliveryOutbox: CanonicalDurableDeliveryOutbox;
  readonly connectionId: string;
  /** An opaque local-derived digest; Vercel never needs an owner phone number or JID. */
  readonly configuredOwnerTargetReference: string;
  readonly now?: () => Date;
}

function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function isTextForBrain(event: ReturnType<typeof normalizedTransportEventSchema.parse>): boolean {
  return (
    event.kind === 'message.received' &&
    event.message?.messageType === 'text' &&
    Boolean(event.message.text?.trim())
  );
}

function currentState(environment: RuntimeEnvironment): ConversationCurrentState {
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

function ownerDeliveryIntent(input: {
  readonly event: CanonicalEvent;
  readonly message: PersistedTransportMessage;
  readonly responseMessageId: string;
  readonly brainRequestId: string;
  readonly responseText: string;
  readonly connectionId: string;
  readonly targetReference: string;
  readonly now: string;
}): OutboundDeliveryIntent {
  const operationKey = `transport:owner-response:${input.connectionId}:${input.responseMessageId}`;
  return {
    id: deterministicUuid(operationKey),
    ownerId: input.event.ownerId,
    messageId: input.responseMessageId,
    conversationId: input.message.conversationId,
    connectionId: input.connectionId,
    transport: 'evolution_whatsapp',
    targetReference: input.targetReference,
    operationKey,
    contentType: 'text',
    content: input.responseText,
    mediaObjectReference: null,
    sourceEventId: input.event.id,
    brainRequestId: input.brainRequestId,
    reminderId: null,
    critical: false,
    correlationId: input.event.correlationId,
    causationId: input.event.causationId ?? null,
    createdAt: input.now,
  };
}

/**
 * Serverless-safe, provider-free transport event half. It rehydrates a canonical event from
 * Neon, creates an outbox delivery transaction, and returns only its ID to the scheduler. It
 * does not construct an Evolution client, retain a session, or hold a local provider credential.
 */
export class CanonicalTransportEventProcessor {
  private readonly now: () => Date;

  public constructor(private readonly options: CanonicalTransportProcessorOptions) {
    this.now = options.now ?? (() => new Date());
  }

  public async process(
    event: CanonicalEvent,
  ): Promise<{ readonly outboundDeliveryId: string | null }> {
    const transportEvent = normalizedTransportEventSchema.parse(event.payload);
    if (transportEvent.kind === 'delivery.updated' && transportEvent.delivery) {
      await this.options.repository.applyDeliveryUpdate({
        ownerId: event.ownerId,
        connectionId: this.options.connectionId,
        update: transportEvent.delivery,
      });
      return { outboundDeliveryId: null };
    }
    if (transportEvent.kind === 'connection.updated' && transportEvent.connection) {
      await this.options.repository.recordConnectionState({
        ownerId: event.ownerId,
        connectionId: this.options.connectionId,
        state: transportEvent.connection.state,
        occurredAt: transportEvent.connection.occurredAt,
        correlationId: event.correlationId,
        sourceEventId: event.id,
        safeErrorCategory: transportEvent.connection.errorCategory,
      });
      return { outboundDeliveryId: null };
    }
    if (!transportEvent.message) {
      throw new Error('validation: a transport event requiring message handling has no message.');
    }

    const persisted = await this.options.repository.persistInboundMessage({
      ownerId: event.ownerId,
      sourceEventId: event.id,
      correlationId: event.correlationId,
      messageId: deterministicUuid(`transport-message:${event.id}`),
      message: transportEvent.message,
    });
    if (!isTextForBrain(transportEvent) || !transportEvent.message.text) {
      return { outboundDeliveryId: null };
    }

    const response = await this.options.brain.process({
      ownerId: event.ownerId,
      conversationId: persisted.conversationId,
      message: transportEvent.message.text,
      timestamp: transportEvent.message.occurredAt,
      idempotencyKey: `transport-brain:${event.id}`,
      correlationId: event.correlationId,
      causationId: event.causationId ?? null,
      sourceEventId: event.id,
      messageId: persisted.id,
      channel: 'whatsapp',
      channelMetadata: {
        transport: transportEvent.transport,
        messageType: transportEvent.message.messageType,
        hasQuotedMessage: transportEvent.message.replyTo !== null,
        hasMedia: transportEvent.message.media !== null,
      },
      currentState: currentState(this.options.environment),
    });
    if (
      (response.status !== 'completed' && response.status !== 'duplicate') ||
      !response.conversationResponse ||
      !response.responseMessageId
    ) {
      return { outboundDeliveryId: null };
    }

    const intent = ownerDeliveryIntent({
      event,
      message: persisted,
      responseMessageId: response.responseMessageId,
      brainRequestId: response.requestId,
      responseText: response.conversationResponse.message,
      connectionId: this.options.connectionId,
      targetReference: this.options.configuredOwnerTargetReference,
      now: this.now().toISOString(),
    });
    const connection = await this.options.connectionPolicies.loadCanonicalTransportConnectionPolicy(
      {
        ownerId: event.ownerId,
        connectionId: this.options.connectionId,
      },
    );
    const policy = evaluateOwnerTransportDelivery({
      intent,
      configuredOwnerTargetReference: this.options.configuredOwnerTargetReference,
      outboundKillSwitchActive: !connection?.outboundEnabled,
      transportConnected: connection?.state === 'connected',
      versionVerified: connection?.versionVerified ?? false,
      ownerConversationVerified: true,
      quietModeActive: false,
    });
    // A disconnected but otherwise permitted bridge creates a durable intent. It will be checked
    // again at lease time; other policy failures are deliberately suppressed before any signal.
    const waitingForConnection =
      !policy.allowed && policy.matchedRules.includes('transport.connection.required');
    if (!policy.allowed && !waitingForConnection) {
      return { outboundDeliveryId: null };
    }
    const outbox = await this.options.deliveryOutbox.persistAndEnqueue(intent);
    return { outboundDeliveryId: outbox.deliveryId };
  }
}
