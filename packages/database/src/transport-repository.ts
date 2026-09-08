import { randomUUID } from 'node:crypto';

import { and, eq, gt, lte, or, sql } from 'drizzle-orm';

import type {
  MessagingConnectionState,
  MessagingDeliveryState,
  MessagingSendResult,
  NormalizedDeliveryUpdate,
  NormalizedInboundMessage,
  OutboundDeliveryIntent,
} from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import {
  calculateOutboundDeliveryRetryDelayMs,
  deriveOutboundDeliveryFreshness,
  evaluateLocalBridgeLeaseEligibility,
  isOutboundDeliveryFresh,
  localBridgeLeaseDurationMs,
} from './delivery-lifecycle.js';
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

export type LocalBridgeLeaseOutcome =
  | {
      readonly status: 'ready';
      readonly intent: OutboundDeliveryIntent;
      readonly leaseToken: string;
      readonly leaseExpiresAt: string;
    }
  | { readonly status: 'expired' | 'already_handled' | 'unavailable' };

export type LocalBridgeResultOutcome =
  | {
      readonly disposition:
        'completed' | 'terminal' | 'already_handled' | 'lease_expired' | 'unavailable';
    }
  | { readonly disposition: 'retry_scheduled'; readonly retryAt: string }
  | { readonly disposition: 'reconciliation_required' };

/**
 * Local bridge-specific canonical lifecycle. The lease token is an opaque, one-time capability;
 * a repeated Convex signal cannot obtain a second payload or submit a stale result.
 */
export interface LocalBridgeDeliveryRepository {
  acquireOutboundDeliveryLeaseForLocalBridge(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly now?: Date;
    readonly leaseDurationMs?: number;
  }): Promise<LocalBridgeLeaseOutcome>;
  recordLocalBridgeDeliveryResult(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly leaseToken: string;
    readonly result: MessagingSendResult;
    readonly now?: Date;
  }): Promise<LocalBridgeResultOutcome>;
  recoverExpiredLocalBridgeLease(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly now?: Date;
  }): Promise<boolean>;
}

export interface CanonicalTransportConnectionPolicy {
  readonly versionVerified: boolean;
  readonly outboundEnabled: boolean;
  readonly state: MessagingConnectionState;
}

/** Read-only Neon projection used by the Vercel processor; it never probes Evolution. */
export interface CanonicalTransportConnectionPolicyRepository {
  loadCanonicalTransportConnectionPolicy(input: {
    readonly ownerId: string;
    readonly connectionId: string;
  }): Promise<CanonicalTransportConnectionPolicy | undefined>;
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

function isTerminalDeliveryState(state: MessagingDeliveryState): boolean {
  return (
    state === 'sent' || state === 'delivered' || state === 'read' || state === 'failed_terminal'
  );
}

/**
 * Drizzle implementation of the canonical transport/outbox state. It never calls a provider and
 * stores only normalized content plus opaque transport references.
 */
export class DrizzleTransportStateRepository
  implements
    TransportStateRepository,
    LocalBridgeDeliveryRepository,
    CanonicalTransportConnectionPolicyRepository
{
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
    const freshness = deriveOutboundDeliveryFreshness(input);
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
        maximumAttempts: freshness.maximumAttempts,
        freshnessPolicy: freshness.policy,
        availableAfter: new Date(input.createdAt),
        expiresAt: new Date(freshness.expiresAt),
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
    const now = new Date();
    const [leased] = await this.database
      .update(outboundMessageDeliveries)
      .set({
        state: 'leased',
        attemptCount: sql`${outboundMessageDeliveries.attemptCount} + 1`,
        leaseExpiresAt: new Date(input.leaseExpiresAt),
        leaseToken: null,
        leaseOwner: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          gt(outboundMessageDeliveries.expiresAt, now),
          lte(outboundMessageDeliveries.availableAfter, now),
          sql`${outboundMessageDeliveries.attemptCount} < ${outboundMessageDeliveries.maximumAttempts}`,
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

  public async recoverExpiredLocalBridgeLease(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly now?: Date;
  }): Promise<boolean> {
    const now = input.now ?? new Date();
    const [recovered] = await this.database
      .update(outboundMessageDeliveries)
      .set({
        state: 'failed_retryable',
        requiresReconciliation: true,
        leaseToken: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        failedAt: now,
        lastErrorCategory: 'local_bridge_lease_expired',
        updatedAt: now,
      })
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          eq(outboundMessageDeliveries.state, 'leased'),
          lte(outboundMessageDeliveries.leaseExpiresAt, now),
          gt(outboundMessageDeliveries.expiresAt, now),
        ),
      )
      .returning({ id: outboundMessageDeliveries.id });
    return Boolean(recovered);
  }

  public async acquireOutboundDeliveryLeaseForLocalBridge(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly now?: Date;
    readonly leaseDurationMs?: number;
  }): Promise<LocalBridgeLeaseOutcome> {
    const now = input.now ?? new Date();
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(
      now.getTime() + Math.max(1_000, input.leaseDurationMs ?? localBridgeLeaseDurationMs),
    );

    // A transport that reconnects after a delivery window must not resurrect it. Expiry is a
    // canonical terminal state and has no outbound side effect.
    await this.database
      .update(outboundMessageDeliveries)
      .set({
        state: 'failed_terminal',
        requiresReconciliation: false,
        leaseToken: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        failedAt: now,
        lastErrorCategory: 'delivery_expired',
        updatedAt: now,
      })
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          lte(outboundMessageDeliveries.expiresAt, now),
          or(
            eq(outboundMessageDeliveries.state, 'pending'),
            eq(outboundMessageDeliveries.state, 'failed_retryable'),
            eq(outboundMessageDeliveries.state, 'leased'),
          ),
        ),
      );
    await this.recoverExpiredLocalBridgeLease({
      ownerId: input.ownerId,
      deliveryId: input.deliveryId,
      now,
    });

    const [leased] = await this.database
      .update(outboundMessageDeliveries)
      .set({
        state: 'leased',
        attemptCount: sql`${outboundMessageDeliveries.attemptCount} + 1`,
        leaseToken,
        leaseOwner: input.bridgeId,
        leaseExpiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
          gt(outboundMessageDeliveries.expiresAt, now),
          lte(outboundMessageDeliveries.availableAfter, now),
          eq(outboundMessageDeliveries.requiresReconciliation, false),
          sql`${outboundMessageDeliveries.attemptCount} < ${outboundMessageDeliveries.maximumAttempts}`,
          or(
            eq(outboundMessageDeliveries.state, 'pending'),
            eq(outboundMessageDeliveries.state, 'failed_retryable'),
          ),
        ),
      )
      .returning({ id: outboundMessageDeliveries.id });

    if (!leased) {
      const [current] = await this.database
        .select({
          state: outboundMessageDeliveries.state,
          availableAfter: outboundMessageDeliveries.availableAfter,
          expiresAt: outboundMessageDeliveries.expiresAt,
          attemptCount: outboundMessageDeliveries.attemptCount,
          maximumAttempts: outboundMessageDeliveries.maximumAttempts,
          requiresReconciliation: outboundMessageDeliveries.requiresReconciliation,
          leaseExpiresAt: outboundMessageDeliveries.leaseExpiresAt,
        })
        .from(outboundMessageDeliveries)
        .where(
          and(
            eq(outboundMessageDeliveries.id, input.deliveryId),
            eq(outboundMessageDeliveries.ownerId, input.ownerId),
          ),
        )
        .limit(1);
      if (!current) return { status: 'expired' };
      const eligibility = evaluateLocalBridgeLeaseEligibility({ ...current, now });
      return eligibility === 'expired'
        ? { status: 'expired' }
        : eligibility === 'already_handled'
          ? { status: 'already_handled' }
          : { status: 'unavailable' };
    }

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
          eq(outboundMessageDeliveries.state, 'leased'),
          eq(outboundMessageDeliveries.leaseToken, leaseToken),
          eq(outboundMessageDeliveries.leaseOwner, input.bridgeId),
          eq(messages.ownerId, input.ownerId),
        ),
      )
      .limit(1);
    if (!row) {
      return { status: 'unavailable' };
    }
    const contentKind = outboundContentType(row.delivery.metadata['contentType']);
    const content = row.content ?? null;
    if (
      !contentKind ||
      (contentKind === 'text' && !content) ||
      row.delivery.transport !== 'evolution_whatsapp' ||
      !row.conversationId
    ) {
      // No malformed row may result in a provider send. Preserve it for operator review rather
      // than leaking a partial payload to the local process.
      await this.database
        .update(outboundMessageDeliveries)
        .set({
          state: 'failed_terminal',
          leaseToken: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          failedAt: now,
          lastErrorCategory: 'canonical_delivery_invalid',
          updatedAt: now,
        })
        .where(
          and(
            eq(outboundMessageDeliveries.id, input.deliveryId),
            eq(outboundMessageDeliveries.leaseToken, leaseToken),
          ),
        );
      return { status: 'unavailable' };
    }
    return {
      status: 'ready',
      leaseToken,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
      intent: {
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
      },
    };
  }

  public async recordLocalBridgeDeliveryResult(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly bridgeId: string;
    readonly leaseToken: string;
    readonly result: MessagingSendResult;
    readonly now?: Date;
  }): Promise<LocalBridgeResultOutcome> {
    const now = input.now ?? new Date();
    return this.database.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(outboundMessageDeliveries)
        .where(
          and(
            eq(outboundMessageDeliveries.id, input.deliveryId),
            eq(outboundMessageDeliveries.ownerId, input.ownerId),
          ),
        )
        .limit(1);
      if (!current) return { disposition: 'unavailable' };
      if (isTerminalDeliveryState(current.state)) return { disposition: 'already_handled' };
      if (current.state === 'failed_retryable') {
        // Replayed result callbacks are expected when Vercel could commit Neon but could not yet
        // repair the scheduled opaque signal. Re-emitting the same schedule is safe because
        // Convex deduplicates a pending signal by delivery ID.
        return current.requiresReconciliation
          ? { disposition: 'reconciliation_required' }
          : { disposition: 'retry_scheduled', retryAt: current.availableAfter.toISOString() };
      }
      if (
        current.state !== 'leased' ||
        current.leaseToken !== input.leaseToken ||
        current.leaseOwner !== input.bridgeId
      ) {
        return { disposition: 'unavailable' };
      }
      if (!current.leaseExpiresAt || current.leaseExpiresAt <= now) {
        await transaction
          .update(outboundMessageDeliveries)
          .set({
            state: 'failed_retryable',
            requiresReconciliation: true,
            leaseToken: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            failedAt: now,
            lastErrorCategory: 'local_bridge_lease_expired',
            updatedAt: now,
          })
          .where(
            and(
              eq(outboundMessageDeliveries.id, input.deliveryId),
              eq(outboundMessageDeliveries.leaseToken, input.leaseToken),
            ),
          );
        return { disposition: 'lease_expired' };
      }
      if (!isOutboundDeliveryFresh({ expiresAt: current.expiresAt, now })) {
        await transaction
          .update(outboundMessageDeliveries)
          .set({
            state: 'failed_terminal',
            requiresReconciliation: false,
            leaseToken: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            failedAt: now,
            lastErrorCategory: 'delivery_expired',
            updatedAt: now,
          })
          .where(
            and(
              eq(outboundMessageDeliveries.id, input.deliveryId),
              eq(outboundMessageDeliveries.leaseToken, input.leaseToken),
            ),
          );
        return { disposition: 'terminal' };
      }

      const guardedLease = and(
        eq(outboundMessageDeliveries.id, input.deliveryId),
        eq(outboundMessageDeliveries.ownerId, input.ownerId),
        eq(outboundMessageDeliveries.state, 'leased'),
        eq(outboundMessageDeliveries.leaseToken, input.leaseToken),
        eq(outboundMessageDeliveries.leaseOwner, input.bridgeId),
        gt(outboundMessageDeliveries.leaseExpiresAt, now),
      );
      if (input.result.disposition === 'accepted') {
        const [updated] = await transaction
          .update(outboundMessageDeliveries)
          .set({
            state: 'sent',
            providerMessageReference: input.result.providerMessageReference,
            requiresReconciliation: false,
            acceptedAt: input.result.acceptedAt ? new Date(input.result.acceptedAt) : now,
            failedAt: null,
            lastErrorCategory: null,
            leaseToken: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            updatedAt: now,
          })
          .where(guardedLease)
          .returning({ id: outboundMessageDeliveries.id });
        return updated ? { disposition: 'completed' } : { disposition: 'unavailable' };
      }

      if (input.result.disposition === 'retryable_failure') {
        if (input.result.requiresReconciliation) {
          const [updated] = await transaction
            .update(outboundMessageDeliveries)
            .set({
              state: 'failed_retryable',
              requiresReconciliation: true,
              providerMessageReference: input.result.providerMessageReference,
              failedAt: now,
              lastErrorCategory: input.result.errorCategory ?? 'transport_uncertain',
              leaseToken: null,
              leaseOwner: null,
              leaseExpiresAt: null,
              updatedAt: now,
            })
            .where(guardedLease)
            .returning({ id: outboundMessageDeliveries.id });
          return updated
            ? { disposition: 'reconciliation_required' }
            : { disposition: 'unavailable' };
        }
        const retryAt = new Date(
          now.getTime() + calculateOutboundDeliveryRetryDelayMs(current.attemptCount),
        );
        if (
          current.attemptCount >= current.maximumAttempts ||
          !isOutboundDeliveryFresh({ expiresAt: current.expiresAt, now: retryAt })
        ) {
          const [updated] = await transaction
            .update(outboundMessageDeliveries)
            .set({
              state: 'failed_terminal',
              requiresReconciliation: false,
              providerMessageReference: input.result.providerMessageReference,
              failedAt: now,
              lastErrorCategory:
                current.attemptCount >= current.maximumAttempts
                  ? 'delivery_attempt_limit'
                  : 'delivery_expired',
              leaseToken: null,
              leaseOwner: null,
              leaseExpiresAt: null,
              updatedAt: now,
            })
            .where(guardedLease)
            .returning({ id: outboundMessageDeliveries.id });
          return updated ? { disposition: 'terminal' } : { disposition: 'unavailable' };
        }
        const [updated] = await transaction
          .update(outboundMessageDeliveries)
          .set({
            state: 'failed_retryable',
            requiresReconciliation: false,
            providerMessageReference: input.result.providerMessageReference,
            availableAfter: retryAt,
            failedAt: now,
            lastErrorCategory: input.result.errorCategory ?? 'transport_retryable',
            leaseToken: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            updatedAt: now,
          })
          .where(guardedLease)
          .returning({ id: outboundMessageDeliveries.id });
        return updated
          ? { disposition: 'retry_scheduled', retryAt: retryAt.toISOString() }
          : { disposition: 'unavailable' };
      }

      const [updated] = await transaction
        .update(outboundMessageDeliveries)
        .set({
          state: 'failed_terminal',
          requiresReconciliation: input.result.requiresReconciliation,
          providerMessageReference: input.result.providerMessageReference,
          failedAt: now,
          lastErrorCategory: input.result.errorCategory ?? 'transport_terminal',
          leaseToken: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(guardedLease)
        .returning({ id: outboundMessageDeliveries.id });
      return updated ? { disposition: 'terminal' } : { disposition: 'unavailable' };
    });
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
        leaseToken: null,
        leaseOwner: null,
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

  public async loadCanonicalTransportConnectionPolicy(input: {
    readonly ownerId: string;
    readonly connectionId: string;
  }): Promise<CanonicalTransportConnectionPolicy | undefined> {
    const [connection] = await this.database
      .select({
        versionVerified: messagingTransportConnections.versionVerified,
        outboundEnabled: messagingTransportConnections.outboundEnabled,
        state: messagingTransportConnections.state,
      })
      .from(messagingTransportConnections)
      .where(
        and(
          eq(messagingTransportConnections.id, input.connectionId),
          eq(messagingTransportConnections.ownerId, input.ownerId),
        ),
      )
      .limit(1);
    return connection;
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
      const freshness = deriveOutboundDeliveryFreshness(input);
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
          maximumAttempts: freshness.maximumAttempts,
          freshnessPolicy: freshness.policy,
          availableAfter: new Date(input.createdAt),
          expiresAt: new Date(freshness.expiresAt),
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

      const job = createOutboundDeliveryJob(input, freshness.expiresAt);
      if (job.executionDeadline === null) {
        throw new Error('The outbound delivery job must retain its canonical execution deadline.');
      }
      await transaction.insert(jobs).values({
        id: job.id,
        ownerId: job.ownerId,
        jobType: job.jobType,
        payload: job.payload,
        status: 'queued',
        priority: job.priority,
        scheduledFor: new Date(job.scheduledFor),
        availableAfter: new Date(job.availableAfter),
        executionDeadline: new Date(job.executionDeadline),
        dispatchGeneration: job.dispatchGeneration,
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
