import { createHash } from 'node:crypto';

import type { ConversationCurrentState, ConversationTurnService } from '@jarvis/brain';
import type { RuntimeEnvironment } from '@jarvis/config';
import {
  whatsappCloudCanonicalPayloadSchema,
  type CanonicalEvent,
  type OutboundDeliveryIntent,
} from '@jarvis/contracts';
import type {
  CanonicalTransportConnectionPolicyRepository,
  PersistedWhatsAppCloudInboundMessage,
} from '@jarvis/database';
import { evaluateOwnerTransportDelivery } from '@jarvis/security';

import type { CanonicalDurableDeliveryOutbox } from './canonical-transport-processor.js';

export interface CanonicalWhatsAppCloudOwnerConversationProcessorOptions {
  readonly environment: RuntimeEnvironment;
  readonly brain: ConversationTurnService;
  readonly deliveryOutbox: CanonicalDurableDeliveryOutbox;
  readonly connectionPolicies: CanonicalTransportConnectionPolicyRepository;
  /** Canonical control-plane row, not a Meta account, number, or token. */
  readonly connectionId: string;
  readonly now?: () => Date;
}

export interface WhatsAppCloudOwnerConversationResult {
  readonly disposition:
    | 'owner_not_enrolled'
    | 'not_replyable'
    | 'brain_not_ready'
    | 'delivery_policy_blocked'
    | 'brain_enqueued_delivery';
  readonly outboundDeliveryId: string | null;
}

function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
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

/**
 * Constructs the one transport-neutral Cloud owner-delivery intent shape. Reactive conversation
 * responses and a future approved canonical accountability/reminder producer use this same
 * function only after their message/decision is persisted. It grants no policy authority.
 */
export function createWhatsAppCloudOwnerDeliveryIntent(input: {
  readonly ownerId: string;
  readonly messageId: string;
  readonly conversationId: string;
  readonly connectionId: string;
  readonly targetReference: string;
  readonly operationKey: string;
  readonly content: string;
  readonly sourceEventId: string | null;
  readonly brainRequestId: string | null;
  readonly reminderId: string | null;
  readonly critical: boolean;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly createdAt: string;
}): OutboundDeliveryIntent {
  return {
    id: deterministicUuid(input.operationKey),
    ownerId: input.ownerId,
    messageId: input.messageId,
    conversationId: input.conversationId,
    connectionId: input.connectionId,
    transport: 'whatsapp_cloud',
    targetReference: input.targetReference,
    operationKey: input.operationKey,
    contentType: 'text',
    content: input.content,
    mediaObjectReference: null,
    sourceEventId: input.sourceEventId,
    brainRequestId: input.brainRequestId,
    reminderId: input.reminderId,
    critical: input.critical,
    correlationId: input.correlationId,
    causationId: input.causationId,
    createdAt: input.createdAt,
  };
}

/**
 * This is a conversation adapter, not a WhatsApp bot. It first consumes the already persisted
 * privacy-filtered message, then invokes the normal ConversationTurnService and projects only an
 * already-persisted canonical response into the same durable delivery outbox used by future
 * proactive accountability messages. It owns no model prompt, tool, action, or provider client.
 */
export class CanonicalWhatsAppCloudOwnerConversationProcessor {
  private readonly now: () => Date;

  public constructor(
    private readonly options: CanonicalWhatsAppCloudOwnerConversationProcessorOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  public async process(input: {
    readonly event: CanonicalEvent;
    readonly message: PersistedWhatsAppCloudInboundMessage;
  }): Promise<WhatsAppCloudOwnerConversationResult> {
    const payload = whatsappCloudCanonicalPayloadSchema.parse(input.event.payload);
    // The event itself remains durable evidence, but neither unlinked participants nor display
    // names may obtain a conversation turn or a delivery capability.
    if (!payload.ownerVerified) {
      return { disposition: 'owner_not_enrolled', outboundDeliveryId: null };
    }
    if (
      payload.messageType !== 'text' ||
      !payload.text?.trim() ||
      !payload.deliveryTargetReference
    ) {
      return { disposition: 'not_replyable', outboundDeliveryId: null };
    }

    const response = await this.options.brain.process({
      ownerId: input.event.ownerId,
      conversationId: input.message.conversationId,
      message: payload.text,
      timestamp: input.event.occurredAt,
      idempotencyKey: `whatsapp-cloud-brain:${input.event.id}`,
      correlationId: input.event.correlationId,
      causationId: input.event.causationId ?? null,
      sourceEventId: input.event.id,
      messageId: input.message.id,
      inboundAlreadyPersisted: true,
      channel: 'whatsapp',
      channelMetadata: {
        transport: payload.transport,
        conversationType: payload.conversationType,
        // This is a narrow, post-enrollment presentation selector only. It cannot grant any
        // action authority: ownerVerified was already checked above by canonical identity.
        ownerVerified: true,
        category: payload.category,
        messageType: payload.messageType,
        hasMedia: payload.media.length > 0,
      },
      currentState: currentState(this.options.environment),
    });
    if (
      (response.status !== 'completed' && response.status !== 'duplicate') ||
      !response.conversationResponse ||
      !response.responseMessageId
    ) {
      return { disposition: 'brain_not_ready', outboundDeliveryId: null };
    }

    const intent = createWhatsAppCloudOwnerDeliveryIntent({
      ownerId: input.event.ownerId,
      messageId: response.responseMessageId,
      conversationId: input.message.conversationId,
      connectionId: this.options.connectionId,
      targetReference: payload.deliveryTargetReference,
      operationKey: `transport:owner-response:${this.options.connectionId}:${response.responseMessageId}`,
      content: response.conversationResponse.message,
      sourceEventId: input.event.id,
      brainRequestId: response.requestId,
      reminderId: null,
      critical: false,
      correlationId: input.event.correlationId,
      causationId: input.event.causationId ?? null,
      createdAt: this.now().toISOString(),
    });
    const connection = await this.options.connectionPolicies.loadCanonicalTransportConnectionPolicy(
      {
        ownerId: input.event.ownerId,
        connectionId: this.options.connectionId,
      },
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
    if (!policy.allowed) {
      return { disposition: 'delivery_policy_blocked', outboundDeliveryId: null };
    }

    const outbox = await this.options.deliveryOutbox.persistAndEnqueue(intent);
    return { disposition: 'brain_enqueued_delivery', outboundDeliveryId: outbox.deliveryId };
  }
}
