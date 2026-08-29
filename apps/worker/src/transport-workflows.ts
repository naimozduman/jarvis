import { createHash } from 'node:crypto';

import type { ConversationCurrentState, ConversationTurnService } from '@jarvis/brain';
import type { BrainResponse } from '@jarvis/contracts';
import {
  normalizedTransportEventSchema,
  type CanonicalEvent,
  type MessagingConnectionStatus,
  type MessagingSendResult,
  type MessagingTransport,
  type OutboundDeliveryIntent,
  type ProactiveDeliveryIntent,
} from '@jarvis/contracts';
import type {
  ClaimedDurableJob,
  PersistedTransportMessage,
  TransportStateRepository,
} from '@jarvis/database';

export interface TransportAuditSink {
  record(input: {
    readonly ownerId: string;
    readonly action: string;
    readonly targetId: string;
    readonly correlationId: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

export interface OwnerDeliveryPolicyPort {
  evaluate(input: {
    readonly intent: OutboundDeliveryIntent;
    readonly connectionStatus: MessagingConnectionStatus;
  }): {
    readonly allowed: boolean;
    readonly reason: string;
    readonly matchedRules: readonly string[];
  };
}

/** The concrete implementation persists the outbox row and pg-boss job in one DB transaction. */
export interface DurableDeliveryOutbox {
  persistAndEnqueue(intent: OutboundDeliveryIntent): Promise<{
    readonly deliveryId: string;
    readonly duplicate: boolean;
  }>;
}

export interface ConversationCurrentStateProvider {
  load(input: {
    readonly ownerId: string;
    readonly conversationId: string;
    readonly sourceEventId: string;
  }): Promise<ConversationCurrentState>;
}

/**
 * A deliberately narrow Brain port. Keeping this structural rather than importing an adapter or
 * concrete model lets a worker compose the existing ConversationTurnService without granting a
 * transport any model, database, or provider authority.
 */
export interface ConversationTurnPort {
  process(input: Parameters<ConversationTurnService['process']>[0]): Promise<BrainResponse>;
}

export interface TransportConnectionStatusProvider {
  getConnectionStatus(input: { readonly connectionId: string }): Promise<MessagingConnectionStatus>;
}

export interface ProactiveMessagePersistence {
  persist(input: {
    readonly ownerId: string;
    readonly message: string;
    readonly correlationId: string;
    readonly reminderId: string;
    readonly createdAt: string;
  }): Promise<{ readonly messageId: string; readonly conversationId: string }>;
}

/**
 * The queue stores only a delivery identifier. This loader rehydrates the pre-persisted,
 * server-derived intent from canonical JARVIS state; it must never deserialize a provider payload
 * or model-selected recipient from a pg-boss job body.
 */
export interface TransportDeliveryIntentLoader {
  load(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
  }): Promise<OutboundDeliveryIntent | undefined>;
}

export interface TransportEventProcessorOptions {
  readonly repository: TransportStateRepository;
  readonly brain: ConversationTurnPort;
  readonly currentState: ConversationCurrentStateProvider;
  readonly deliveryOutbox: DurableDeliveryOutbox;
  readonly ownerDeliveryPolicy: OwnerDeliveryPolicyPort;
  readonly connectionStatus?: TransportConnectionStatusProvider;
  readonly connectionId: string;
  readonly configuredOwnerTargetReference: string;
  readonly audit?: TransportAuditSink;
  readonly now?: () => Date;
}

export interface TransportEventProcessingResult {
  readonly disposition:
    | 'brain_enqueued_delivery'
    | 'message_persisted_no_brain'
    | 'delivery_updated'
    | 'connection_updated'
    | 'delivery_suppressed';
  readonly brainRequestId: string | null;
  readonly outboundDeliveryId: string | null;
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

/** A disconnected transport is a durable waiting condition, not a reason to discard an intent. */
function isConnectionWaitPolicy(input: {
  readonly allowed: boolean;
  readonly matchedRules: readonly string[];
}): boolean {
  return !input.allowed && input.matchedRules.includes('transport.connection.required');
}

/**
 * Canonical-event worker half of inbound transport handling. It validates a normalized event,
 * persists the message first, then optionally calls the provider-neutral Brain. No webhook code
 * invokes this service, and no model receives provider credentials/JIDs/raw payloads.
 */
export class TransportEventProcessor {
  private readonly now: () => Date;

  public constructor(private readonly options: TransportEventProcessorOptions) {
    this.now = options.now ?? (() => new Date());
  }

  public async process(event: CanonicalEvent): Promise<TransportEventProcessingResult> {
    const transportEvent = normalizedTransportEventSchema.parse(event.payload);
    if (transportEvent.kind === 'delivery.updated' && transportEvent.delivery) {
      await this.options.repository.applyDeliveryUpdate({
        ownerId: event.ownerId,
        connectionId: this.options.connectionId,
        update: transportEvent.delivery,
      });
      await this.audit(event, 'transport.delivery.updated', {
        state: transportEvent.delivery.state,
        providerMessageReference: transportEvent.delivery.providerMessageReference,
      });
      return { disposition: 'delivery_updated', brainRequestId: null, outboundDeliveryId: null };
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
      await this.audit(event, 'transport.connection.updated', {
        state: transportEvent.connection.state,
        errorCategory: transportEvent.connection.errorCategory,
      });
      return { disposition: 'connection_updated', brainRequestId: null, outboundDeliveryId: null };
    }
    if (!transportEvent.message) {
      throw new Error('A transport event requiring message handling has no normalized message.');
    }

    const persisted = await this.options.repository.persistInboundMessage({
      ownerId: event.ownerId,
      sourceEventId: event.id,
      correlationId: event.correlationId,
      messageId: deterministicUuid(`transport-message:${event.id}`),
      message: transportEvent.message,
    });
    if (!isTextForBrain(transportEvent) || !transportEvent.message.text) {
      await this.audit(event, 'transport.message.persisted_without_brain', {
        messageType: transportEvent.message.messageType,
        providerMessageReference: transportEvent.message.providerMessageReference,
      });
      return {
        disposition: 'message_persisted_no_brain',
        brainRequestId: null,
        outboundDeliveryId: null,
      };
    }

    const currentState = await this.options.currentState.load({
      ownerId: event.ownerId,
      conversationId: persisted.conversationId,
      sourceEventId: event.id,
    });
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
      currentState,
    });
    if (
      (response.status !== 'completed' && response.status !== 'duplicate') ||
      !response.conversationResponse ||
      !response.responseMessageId
    ) {
      await this.audit(event, 'transport.brain.response_not_deliverable', {
        brainStatus: response.status,
        hasSafeError: response.safeError !== null,
      });
      return {
        disposition: 'message_persisted_no_brain',
        brainRequestId: response.requestId,
        outboundDeliveryId: null,
      };
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
    const status = await this.connectionStatus(intent);
    const policy = this.options.ownerDeliveryPolicy.evaluate({ intent, connectionStatus: status });
    if (!policy.allowed && !isConnectionWaitPolicy(policy)) {
      await this.audit(event, 'transport.delivery.suppressed', {
        policyRules: [...policy.matchedRules],
        reasonCategory: 'owner_delivery_policy',
      });
      return {
        disposition: 'delivery_suppressed',
        brainRequestId: response.requestId,
        outboundDeliveryId: null,
      };
    }
    const outbox = await this.options.deliveryOutbox.persistAndEnqueue(intent);
    await this.audit(event, 'transport.delivery.queued', {
      deliveryId: outbox.deliveryId,
      duplicate: outbox.duplicate,
      transport: intent.transport,
      waitingForConnection: isConnectionWaitPolicy(policy),
    });
    return {
      disposition: 'brain_enqueued_delivery',
      brainRequestId: response.requestId,
      outboundDeliveryId: outbox.deliveryId,
    };
  }

  /** Converts the existing generic reminder product intent into the same outbox path. */
  public async processProactiveReminder(input: {
    readonly intent: ProactiveDeliveryIntent;
    readonly messagePersistence: ProactiveMessagePersistence;
  }): Promise<{ readonly deliveryId: string | null; readonly suppressed: boolean }> {
    const persisted = await input.messagePersistence.persist({
      ownerId: input.intent.ownerId,
      message: input.intent.message,
      correlationId: input.intent.correlationId,
      reminderId: input.intent.reminderId,
      createdAt: input.intent.createdAt,
    });
    const operationKey = `transport:owner-reminder:${this.options.connectionId}:${input.intent.reminderId}:${input.intent.id}`;
    const outbound: OutboundDeliveryIntent = {
      id: deterministicUuid(operationKey),
      ownerId: input.intent.ownerId,
      messageId: persisted.messageId,
      conversationId: persisted.conversationId,
      connectionId: this.options.connectionId,
      transport: 'evolution_whatsapp',
      targetReference: this.options.configuredOwnerTargetReference,
      operationKey,
      contentType: 'text',
      content: input.intent.message,
      mediaObjectReference: null,
      sourceEventId: null,
      brainRequestId: null,
      reminderId: input.intent.reminderId,
      critical: input.intent.critical,
      correlationId: input.intent.correlationId,
      causationId: input.intent.causationId,
      createdAt: input.intent.createdAt,
    };
    const policy = this.options.ownerDeliveryPolicy.evaluate({
      intent: outbound,
      connectionStatus: await this.connectionStatus(outbound),
    });
    if (!policy.allowed && !isConnectionWaitPolicy(policy)) {
      return { deliveryId: null, suppressed: true };
    }
    const persistedOutbox = await this.options.deliveryOutbox.persistAndEnqueue(outbound);
    return { deliveryId: persistedOutbox.deliveryId, suppressed: false };
  }

  private async connectionStatus(
    intent: OutboundDeliveryIntent,
  ): Promise<MessagingConnectionStatus> {
    // A lightweight status lookup is still provider bounded and cannot become a model action.
    // The outbound worker rechecks it immediately before a side effect. Missing composition must
    // fail closed as an unavailable connection—not pretend that WhatsApp is connected—while the
    // durable intent waits for a correctly composed worker to retry it.
    return (
      (await this.options.connectionStatus?.getConnectionStatus({
        connectionId: intent.connectionId,
      })) ?? {
        transport: intent.transport,
        connectionId: intent.connectionId,
        state: 'unknown',
        readiness: 'not_configured',
        checkedAt: this.now().toISOString(),
        safeErrorCategory: 'connection_status_unavailable',
      }
    );
  }

  private async audit(
    event: CanonicalEvent,
    action: string,
    metadata: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.options.audit?.record({
      ownerId: event.ownerId,
      action,
      targetId: event.id,
      correlationId: event.correlationId,
      metadata,
    });
  }
}

export interface TransportOutboundWorkerOptions {
  readonly repository: TransportStateRepository;
  readonly transport: MessagingTransport;
  readonly ownerDeliveryPolicy: OwnerDeliveryPolicyPort;
  readonly audit?: TransportAuditSink;
  readonly now?: () => Date;
}

export interface OutboundDispatchResult {
  readonly disposition:
    'sent' | 'wait_for_connection' | 'retry_scheduled' | 'terminal_failure' | 'already_handled';
  readonly requiresReconciliation: boolean;
}

/**
 * Executes only leased delivery rows. A timeout is recorded as reconciliation-required and never
 * blindly resent; a duplicate job cannot obtain a second lease and therefore cannot send twice.
 */
export class TransportOutboundWorker {
  private readonly now: () => Date;

  public constructor(private readonly options: TransportOutboundWorkerOptions) {
    this.now = options.now ?? (() => new Date());
  }

  public async dispatch(intent: OutboundDeliveryIntent): Promise<OutboundDispatchResult> {
    const leased = await this.options.repository.leaseOutboundDelivery({
      ownerId: intent.ownerId,
      deliveryId: intent.id,
      leaseExpiresAt: new Date(this.now().getTime() + 300_000).toISOString(),
    });
    if (!leased) {
      return { disposition: 'already_handled', requiresReconciliation: false };
    }
    const connection = await this.options.transport.getConnectionStatus({
      connectionId: intent.connectionId,
    });
    const policy = this.options.ownerDeliveryPolicy.evaluate({
      intent,
      connectionStatus: connection,
    });
    if (!policy.allowed && !isConnectionWaitPolicy(policy)) {
      const result: MessagingSendResult = {
        disposition: 'terminal_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: 'policy_denied',
        requiresReconciliation: false,
      };
      await this.options.repository.recordSendResult({
        ownerId: intent.ownerId,
        deliveryId: intent.id,
        result,
        occurredAt: this.now().toISOString(),
      });
      return { disposition: 'terminal_failure', requiresReconciliation: false };
    }
    if (connection.state !== 'connected') {
      const result: MessagingSendResult = {
        disposition: 'retryable_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: connection.safeErrorCategory ?? 'connection_closed',
        requiresReconciliation: false,
      };
      await this.options.repository.recordSendResult({
        ownerId: intent.ownerId,
        deliveryId: intent.id,
        result,
        occurredAt: this.now().toISOString(),
      });
      return { disposition: 'wait_for_connection', requiresReconciliation: false };
    }
    const result = await this.send(intent);
    await this.options.repository.recordSendResult({
      ownerId: intent.ownerId,
      deliveryId: intent.id,
      result,
      occurredAt: this.now().toISOString(),
    });
    await this.options.audit?.record({
      ownerId: intent.ownerId,
      action: 'transport.delivery.attempted',
      targetId: intent.id,
      correlationId: intent.correlationId,
      metadata: {
        transport: intent.transport,
        outcome: result.disposition,
        errorCategory: result.errorCategory,
        requiresReconciliation: result.requiresReconciliation,
      },
    });
    if (result.disposition === 'accepted') {
      return { disposition: 'sent', requiresReconciliation: false };
    }
    if (result.disposition === 'retryable_failure') {
      return {
        disposition: 'retry_scheduled',
        requiresReconciliation: result.requiresReconciliation,
      };
    }
    return {
      disposition: 'terminal_failure',
      requiresReconciliation: result.requiresReconciliation,
    };
  }

  private async send(intent: OutboundDeliveryIntent): Promise<MessagingSendResult> {
    if (intent.contentType === 'text' && intent.content) {
      return this.options.transport.sendText({
        deliveryId: intent.id,
        ownerId: intent.ownerId,
        connectionId: intent.connectionId,
        targetReference: intent.targetReference,
        operationKey: intent.operationKey,
        text: intent.content,
        correlationId: intent.correlationId,
        causationId: intent.causationId,
      });
    }
    if (!intent.mediaObjectReference) {
      return {
        disposition: 'terminal_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: 'missing_media_reference',
        requiresReconciliation: false,
      };
    }
    const media = {
      deliveryId: intent.id,
      ownerId: intent.ownerId,
      connectionId: intent.connectionId,
      targetReference: intent.targetReference,
      operationKey: intent.operationKey,
      objectReference: intent.mediaObjectReference,
      mimeType: 'application/octet-stream',
      fileName: null,
      caption: intent.content,
      correlationId: intent.correlationId,
      causationId: intent.causationId,
    } as const;
    switch (intent.contentType) {
      case 'image':
        return this.options.transport.sendImage(media);
      case 'audio':
        return this.options.transport.sendAudio(media);
      case 'document':
        return this.options.transport.sendDocument(media);
      case 'text':
        throw new Error('A text outbound intent was missing required text content.');
    }
  }
}

/** A bounded signal for pg-boss; callers never retry a reconciliation-required timeout blindly. */
export class TransportRetryableJobError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TransportRetryableJobError';
  }
}

function jobString(data: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/**
 * Converts a claimed durable job into exactly one lease-protected dispatch. This remains an
 * explicit composition hook because the Phase 3 default runtime is provider-free; neither the
 * health server nor app startup initializes Evolution on its own.
 */
export async function handleTransportOutboundJob(input: {
  readonly job: ClaimedDurableJob;
  readonly loader: TransportDeliveryIntentLoader;
  readonly worker: TransportOutboundWorker;
}): Promise<void> {
  if (input.job.name !== 'jarvis.transport.outbound.send') {
    throw new Error('A transport worker received an unexpected durable job type.');
  }
  const deliveryId = jobString(input.job.data, 'deliveryId');
  if (!deliveryId) {
    throw new Error('A transport outbound job is missing its canonical delivery identifier.');
  }
  const ownerId = jobString(input.job.data, 'ownerId');
  if (!ownerId) {
    // The canonical job ledger carries owner scope, but pg-boss payloads intentionally do not
    // duplicate it. A deployment composition may attach it from the ledger before this handler.
    throw new Error(
      'A transport outbound job lacks its owner scope from the canonical job ledger.',
    );
  }
  const intent = await input.loader.load({ ownerId, deliveryId });
  if (!intent) {
    // A cancelled/purged outbox entry is terminally handled: there is nothing safe to send.
    return;
  }
  const result = await input.worker.dispatch(intent);
  if (result.disposition === 'retry_scheduled' && !result.requiresReconciliation) {
    throw new TransportRetryableJobError(
      'Transport delivery needs a retry after a transient provider failure.',
    );
  }
  if (result.disposition === 'wait_for_connection') {
    throw new TransportRetryableJobError(
      'Transport connection is unavailable; retain the canonical delivery and retry later.',
    );
  }
}
