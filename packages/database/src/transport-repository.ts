import { randomUUID } from 'node:crypto';

import { and, eq, or, sql } from 'drizzle-orm';

import type {
  MessagingConnectionState,
  MessagingDeliveryState,
  MessagingSendResult,
  NormalizedDeliveryUpdate,
  NormalizedInboundMessage,
  OutboundDeliveryIntent,
} from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import { createOutboundDeliveryJob, type TransactionalJobTransport } from './jobs.js';
import {
  auditEvents,
  conversations,
  jobs,
  mediaFetchRequests,
  messages,
  messagingConnectionStateEvents,
  messagingTransportConnections,
  messagingTransportRejections,
  outboundMessageDeliveries,
} from './schema/index.js';
import { createSafeAuditEvent } from '@jarvis/security';

export interface PersistedTransportMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly duplicate: boolean;
}

export interface PersistedOutboundDelivery {
  readonly id: string;
  readonly ownerId: string;
  readonly messageId: string;
  readonly connectionId: string;
  readonly transport: string;
  readonly targetReference: string;
  readonly operationKey: string;
  readonly state: MessagingDeliveryState;
  readonly providerMessageReference: string | null;
  readonly attemptCount: number;
  readonly requiresReconciliation: boolean;
  readonly correlationId: string;
}

export interface TransportStateRepository {
  persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly messageId: string;
    readonly message: NormalizedInboundMessage;
  }): Promise<PersistedTransportMessage>;
  createOrLoadOutboundDelivery(input: OutboundDeliveryIntent): Promise<{
    readonly delivery: PersistedOutboundDelivery;
    readonly duplicate: boolean;
  }>;
  /** Rehydrates a persisted intent for a worker; no provider payload or credential is stored here. */
  loadOutboundDeliveryIntent(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
  }): Promise<OutboundDeliveryIntent | undefined>;
  leaseOutboundDelivery(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly leaseExpiresAt: string;
  }): Promise<PersistedOutboundDelivery | undefined>;
  recordSendResult(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly result: MessagingSendResult;
    readonly occurredAt: string;
  }): Promise<PersistedOutboundDelivery>;
  applyDeliveryUpdate(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly update: NormalizedDeliveryUpdate;
  }): Promise<PersistedOutboundDelivery | undefined>;
  recordRejectedTransportEvent(input: {
    readonly ownerId: string;
    readonly transport: string;
    readonly instanceReference: string;
    readonly providerEventReference: string | null;
    readonly senderReference: string | null;
    readonly eventType: string;
    readonly reason: string;
    readonly receivedAt: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  recordConnectionState(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly state: MessagingConnectionState;
    readonly occurredAt: string;
    readonly correlationId: string;
    readonly sourceEventId: string | null;
    readonly safeErrorCategory: string | null;
  }): Promise<void>;
}

function asDelivery(row: typeof outboundMessageDeliveries.$inferSelect): PersistedOutboundDelivery {
  return {
    id: row.id,
    ownerId: row.ownerId,
    messageId: row.messageId,
    connectionId: row.connectionId,
    transport: row.transport,
    targetReference: row.targetReference,
    operationKey: row.operationKey,
    state: row.state,
    providerMessageReference: row.providerMessageReference,
    attemptCount: row.attemptCount,
    requiresReconciliation: row.requiresReconciliation,
    correlationId: row.correlationId,
  };
}

function deliveryStateRank(state: MessagingDeliveryState): number {
  switch (state) {
    case 'pending':
      return 0;
    case 'leased':
      return 1;
    case 'sent':
      return 2;
    case 'delivered':
      return 3;
    case 'read':
      return 4;
    case 'failed_retryable':
    case 'failed_terminal':
      return -1;
  }
}

function contentType(message: NormalizedInboundMessage): string {
  switch (message.messageType) {
    case 'text':
      return 'text/plain';
    case 'image':
      return message.media?.mimeType ?? 'image/*';
    case 'audio':
      return message.media?.mimeType ?? 'audio/*';
    case 'document':
      return message.media?.mimeType ?? 'application/octet-stream';
    default:
      return `application/x-jarvis-${message.messageType}`;
  }
}

function outboundContentType(value: unknown): OutboundDeliveryIntent['contentType'] | undefined {
  return value === 'text' || value === 'image' || value === 'audio' || value === 'document'
    ? value
    : undefined;
}

function booleanMetadata(value: Record<string, unknown>, key: string): boolean {
  return value[key] === true;
}

/**
 * Drizzle implementation of the canonical transport/outbox state. It never calls a provider and
 * stores only normalized content plus opaque transport references.
 */
export class DrizzleTransportStateRepository implements TransportStateRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly messageId: string;
    readonly message: NormalizedInboundMessage;
  }): Promise<PersistedTransportMessage> {
    return this.database.transaction(async (transaction) => {
      const [createdConversation] = await transaction
        .insert(conversations)
        .values({
          id: randomUUID(),
          ownerId: input.ownerId,
          channel: 'whatsapp',
          externalConversationId: input.message.conversationReference,
          state: 'active',
          lastMessageAt: new Date(input.message.occurredAt),
          metadata: {
            transport: input.message.transport,
            instanceReference: input.message.instanceReference,
          },
        })
        .onConflictDoNothing()
        .returning({ id: conversations.id });
      const conversationId =
        createdConversation?.id ??
        (
          await transaction
            .select({ id: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.ownerId, input.ownerId),
                eq(conversations.channel, 'whatsapp'),
                eq(conversations.externalConversationId, input.message.conversationReference),
              ),
            )
            .limit(1)
        )[0]?.id;
      if (!conversationId) {
        throw new Error('Transport conversation creation conflicted without a canonical record.');
      }

      const [createdMessage] = await transaction
        .insert(messages)
        .values({
          id: input.messageId,
          ownerId: input.ownerId,
          conversationId,
          channel: 'whatsapp',
          direction: 'inbound',
          externalMessageId: input.message.providerMessageReference,
          senderReference: input.message.sender.reference,
          contentType: contentType(input.message),
          content: input.message.text,
          deliveryState: input.message.deliveryState ?? 'received',
          occurredAt: new Date(input.message.occurredAt),
          receivedAt: new Date(),
          correlationId: input.correlationId,
          sourceEventId: input.sourceEventId,
          metadata: {
            messageType: input.message.messageType,
            replyToProviderMessageReference:
              input.message.replyTo?.providerMessageReference ?? null,
            media: input.message.media
              ? {
                  mediaType: input.message.media.mediaType,
                  mimeType: input.message.media.mimeType,
                  byteLength: input.message.media.byteLength,
                  fileName: input.message.media.fileName,
                  providerMediaReference: input.message.media.providerMediaReference,
                }
              : null,
            ...input.message.metadata,
          },
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });

      const messageId =
        createdMessage?.id ??
        (
          await transaction
            .select({ id: messages.id })
            .from(messages)
            .where(
              and(
                eq(messages.ownerId, input.ownerId),
                eq(messages.channel, 'whatsapp'),
                eq(messages.externalMessageId, input.message.providerMessageReference),
              ),
            )
            .limit(1)
        )[0]?.id;
      if (!messageId) {
        throw new Error('Transport message creation conflicted without a canonical record.');
      }

      if (input.message.media?.providerMediaReference) {
        await transaction
          .insert(mediaFetchRequests)
          .values({
            ownerId: input.ownerId,
            messageId,
            providerMediaReference: input.message.media.providerMediaReference,
            state: 'metadata_only',
            mimeType: input.message.media.mimeType,
            byteLength: input.message.media.byteLength,
            metadata: { mediaType: input.message.media.mediaType },
          })
          .onConflictDoNothing();
      }

      await transaction
        .update(conversations)
        .set({ lastMessageAt: new Date(input.message.occurredAt), updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, input.ownerId)));

      return { id: messageId, conversationId, duplicate: !createdMessage };
    });
  }

  public async createOrLoadOutboundDelivery(input: OutboundDeliveryIntent): Promise<{
    readonly delivery: PersistedOutboundDelivery;
    readonly duplicate: boolean;
  }> {
    const [created] = await this.database
      .insert(outboundMessageDeliveries)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        messageId: input.messageId,
        connectionId: input.connectionId,
        transport: input.transport,
        targetReference: input.targetReference,
        operationKey: input.operationKey,
        mediaObjectReference: input.mediaObjectReference ?? undefined,
        sourceEventId: input.sourceEventId ?? undefined,
        brainRequestId: input.brainRequestId ?? undefined,
        reminderId: input.reminderId ?? undefined,
        state: 'pending',
        correlationId: input.correlationId,
        causationId: input.causationId ?? undefined,
        metadata: { contentType: input.contentType, critical: input.critical },
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      return { delivery: asDelivery(created), duplicate: false };
    }
    const [existing] = await this.database
      .select()
      .from(outboundMessageDeliveries)
      .where(
        and(
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          eq(outboundMessageDeliveries.operationKey, input.operationKey),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error('Outbound delivery creation conflicted without a canonical outbox record.');
    }
    return { delivery: asDelivery(existing), duplicate: true };
  }

  public async loadOutboundDeliveryIntent(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
  }): Promise<OutboundDeliveryIntent | undefined> {
    const [row] = await this.database
      .select({
        delivery: outboundMessageDeliveries,
        content: messages.content,
        conversationId: messages.conversationId,
      })
      .from(outboundMessageDeliveries)
      .innerJoin(messages, eq(messages.id, outboundMessageDeliveries.messageId))
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          eq(messages.ownerId, input.ownerId),
        ),
      )
      .limit(1);
    if (!row) {
      return undefined;
    }
    const contentKind = outboundContentType(row.delivery.metadata['contentType']);
    if (!contentKind) {
      throw new Error('A canonical outbound delivery lacks a valid content type.');
    }
    const content = row.content ?? null;
    if (contentKind === 'text' && !content) {
      throw new Error('A canonical text delivery lacks persisted message content.');
    }
    if (row.delivery.transport !== 'evolution_whatsapp') {
      throw new Error('A canonical outbound delivery references an unsupported transport.');
    }
    if (!row.conversationId) {
      throw new Error('A canonical outbound message lacks a conversation.');
    }
    return {
      id: row.delivery.id,
      ownerId: row.delivery.ownerId,
      messageId: row.delivery.messageId,
      conversationId: row.conversationId,
      connectionId: row.delivery.connectionId,
      transport: 'evolution_whatsapp',
      targetReference: row.delivery.targetReference,
      operationKey: row.delivery.operationKey,
      contentType: contentKind,
      content,
      mediaObjectReference: row.delivery.mediaObjectReference ?? null,
      sourceEventId: row.delivery.sourceEventId ?? null,
      brainRequestId: row.delivery.brainRequestId ?? null,
      reminderId: row.delivery.reminderId ?? null,
      critical: booleanMetadata(row.delivery.metadata, 'critical'),
      correlationId: row.delivery.correlationId,
      causationId: row.delivery.causationId ?? null,
      createdAt: row.delivery.createdAt.toISOString(),
    };
  }

  public async leaseOutboundDelivery(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly leaseExpiresAt: string;
  }): Promise<PersistedOutboundDelivery | undefined> {
    const [leased] = await this.database
      .update(outboundMessageDeliveries)
      .set({
        state: 'leased',
        attemptCount: sql`${outboundMessageDeliveries.attemptCount} + 1`,
        leaseExpiresAt: new Date(input.leaseExpiresAt),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          or(
            eq(outboundMessageDeliveries.state, 'pending'),
            and(
              eq(outboundMessageDeliveries.state, 'failed_retryable'),
              eq(outboundMessageDeliveries.requiresReconciliation, false),
            ),
          ),
        ),
      )
      .returning();
    return leased ? asDelivery(leased) : undefined;
  }

  public async recordSendResult(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly result: MessagingSendResult;
    readonly occurredAt: string;
  }): Promise<PersistedOutboundDelivery> {
    const state: MessagingDeliveryState =
      input.result.disposition === 'accepted'
        ? 'sent'
        : input.result.disposition === 'retryable_failure'
          ? 'failed_retryable'
          : 'failed_terminal';
    const [updated] = await this.database
      .update(outboundMessageDeliveries)
      .set({
        state,
        providerMessageReference: input.result.providerMessageReference ?? null,
        requiresReconciliation: input.result.requiresReconciliation,
        acceptedAt: input.result.acceptedAt ? new Date(input.result.acceptedAt) : null,
        failedAt: state.startsWith('failed') ? new Date(input.occurredAt) : null,
        lastErrorCategory: input.result.errorCategory ?? null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          eq(outboundMessageDeliveries.state, 'leased'),
        ),
      )
      .returning();
    if (!updated) {
      throw new Error('Outbound delivery result targeted an unleased or foreign delivery.');
    }
    return asDelivery(updated);
  }

  public async applyDeliveryUpdate(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly update: NormalizedDeliveryUpdate;
  }): Promise<PersistedOutboundDelivery | undefined> {
    const [current] = await this.database
      .select()
      .from(outboundMessageDeliveries)
      .where(
        and(
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          eq(outboundMessageDeliveries.connectionId, input.connectionId),
          eq(
            outboundMessageDeliveries.providerMessageReference,
            input.update.providerMessageReference,
          ),
        ),
      )
      .limit(1);
    if (!current || deliveryStateRank(input.update.state) < deliveryStateRank(current.state)) {
      return current ? asDelivery(current) : undefined;
    }
    const [updated] = await this.database
      .update(outboundMessageDeliveries)
      .set({
        state: input.update.state,
        deliveredAt:
          input.update.state === 'delivered' ? new Date(input.update.occurredAt) : undefined,
        readAt: input.update.state === 'read' ? new Date(input.update.occurredAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(outboundMessageDeliveries.id, current.id))
      .returning();
    return updated ? asDelivery(updated) : undefined;
  }

  public async recordRejectedTransportEvent(input: {
    readonly ownerId: string;
    readonly transport: string;
    readonly instanceReference: string;
    readonly providerEventReference: string | null;
    readonly senderReference: string | null;
    readonly eventType: string;
    readonly reason: string;
    readonly receivedAt: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.database
      .insert(messagingTransportRejections)
      .values({
        ownerId: input.ownerId,
        transport: input.transport,
        instanceReference: input.instanceReference,
        providerEventReference: input.providerEventReference ?? undefined,
        senderReference: input.senderReference ?? undefined,
        eventType: input.eventType,
        reason: input.reason,
        receivedAt: new Date(input.receivedAt),
        metadata: { ...input.metadata },
      })
      .onConflictDoNothing();
  }

  public async recordConnectionState(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly state: MessagingConnectionState;
    readonly occurredAt: string;
    readonly correlationId: string;
    readonly sourceEventId: string | null;
    readonly safeErrorCategory: string | null;
  }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const [current] = await transaction
        .select({ state: messagingTransportConnections.state })
        .from(messagingTransportConnections)
        .where(
          and(
            eq(messagingTransportConnections.id, input.connectionId),
            eq(messagingTransportConnections.ownerId, input.ownerId),
          ),
        )
        .limit(1);
      if (!current) {
        throw new Error('Transport connection state targeted a missing or foreign connection.');
      }
      await transaction
        .update(messagingTransportConnections)
        .set({
          state: input.state,
          lastSafeErrorCategory: input.safeErrorCategory ?? null,
          updatedAt: new Date(),
        })
        .where(eq(messagingTransportConnections.id, input.connectionId));
      await transaction.insert(messagingConnectionStateEvents).values({
        ownerId: input.ownerId,
        connectionId: input.connectionId,
        previousState: current.state,
        resultingState: input.state,
        occurredAt: new Date(input.occurredAt),
        sourceEventId: input.sourceEventId ?? undefined,
        correlationId: input.correlationId,
        safeErrorCategory: input.safeErrorCategory ?? undefined,
        metadata: {},
      });
    });
  }
}

/**
 * Atomically projects an owner-only delivery intent into the canonical outbox, JARVIS job ledger,
 * pg-boss transaction, and safe audit stream. The transaction commits all four or none; no Brain
 * or webhook request performs a provider HTTP call here.
 */
export class DrizzleDurableDeliveryOutbox {
  public constructor(
    private readonly database: JarvisDatabase,
    private readonly jobTransport: TransactionalJobTransport,
  ) {}

  public async persistAndEnqueue(input: OutboundDeliveryIntent): Promise<{
    readonly deliveryId: string;
    readonly duplicate: boolean;
  }> {
    return this.database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(outboundMessageDeliveries)
        .values({
          id: input.id,
          ownerId: input.ownerId,
          messageId: input.messageId,
          connectionId: input.connectionId,
          transport: input.transport,
          targetReference: input.targetReference,
          operationKey: input.operationKey,
          mediaObjectReference: input.mediaObjectReference ?? undefined,
          sourceEventId: input.sourceEventId ?? undefined,
          brainRequestId: input.brainRequestId ?? undefined,
          reminderId: input.reminderId ?? undefined,
          state: 'pending',
          correlationId: input.correlationId,
          causationId: input.causationId ?? undefined,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.createdAt),
          metadata: { contentType: input.contentType, critical: input.critical },
        })
        .onConflictDoNothing()
        .returning({ id: outboundMessageDeliveries.id });
      if (!created) {
        const [existing] = await transaction
          .select({ id: outboundMessageDeliveries.id })
          .from(outboundMessageDeliveries)
          .where(
            and(
              eq(outboundMessageDeliveries.ownerId, input.ownerId),
              eq(outboundMessageDeliveries.operationKey, input.operationKey),
            ),
          )
          .limit(1);
        if (!existing) {
          throw new Error(
            'Outbound delivery transaction conflicted without a canonical outbox record.',
          );
        }
        return { deliveryId: existing.id, duplicate: true };
      }

      const job = createOutboundDeliveryJob(input);
      await transaction.insert(jobs).values({
        id: job.id,
        ownerId: job.ownerId,
        jobType: job.jobType,
        payload: job.payload,
        status: 'queued',
        priority: job.priority,
        scheduledFor: new Date(job.scheduledFor),
        availableAfter: new Date(job.availableAfter),
        maximumAttempts: job.maximumAttempts,
        correlationId: job.correlationId,
        causationId: job.causationId,
        sourceEventId: job.sourceEventId,
        idempotencyKey: job.idempotencyKey,
      });
      await this.jobTransport.enqueue(transaction, job);

      const audit = createSafeAuditEvent({
        id: randomUUID(),
        ownerId: input.ownerId,
        actorType: 'worker',
        actorId: null,
        action: 'transport.delivery.queued',
        targetType: 'outbound_delivery',
        targetId: input.id,
        occurredAt: input.createdAt,
        correlationId: input.correlationId,
        ...(input.causationId ? { causationId: input.causationId } : {}),
        previousState: { entityType: 'outbound_delivery', entityId: input.id },
        resultingState: { entityType: 'outbound_delivery', entityId: input.id },
        reason: 'A server-derived owner-only transport delivery passed deterministic policy.',
        source: 'internal',
        metadata: {
          transport: input.transport,
          contentType: input.contentType,
          critical: input.critical,
          resultingDeliveryState: 'pending',
        },
      });
      await transaction.insert(auditEvents).values({
        id: audit.id,
        ownerId: audit.ownerId,
        actorType: audit.actorType,
        actorId: audit.actorId,
        action: audit.action,
        targetType: audit.targetType,
        targetId: audit.targetId,
        occurredAt: new Date(audit.occurredAt),
        correlationId: audit.correlationId,
        causationId: audit.causationId,
        previousStateReference: audit.previousState ?? undefined,
        resultingStateReference: audit.resultingState ?? undefined,
        reason: audit.reason,
        source: audit.source,
        metadata: audit.metadata,
      });
      return { deliveryId: created.id, duplicate: false };
    });
  }
}
