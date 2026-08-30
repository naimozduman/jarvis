import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { CanonicalEvent, EventProcessingStatus } from '@jarvis/contracts';
import { createSafeAuditEvent } from '@jarvis/security';

import type { JarvisDatabase } from './client.js';
import {
  auditEvents,
  conversations,
  events,
  messagingTransportConnections,
} from './schema/index.js';

function asCanonicalEvent(row: typeof events.$inferSelect): CanonicalEvent {
  return {
    id: row.id,
    ownerId: row.ownerId,
    eventType: row.eventType,
    source: row.source,
    sourceEventId: row.sourceEventId ?? undefined,
    idempotencyKey: row.idempotencyKey,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    payload: row.payload,
    schemaVersion: row.schemaVersion,
    processingStatus: row.processingStatus,
    correlationId: row.correlationId,
    causationId: row.causationId ?? undefined,
  };
}

export interface CanonicalEventRepository {
  load(input: {
    readonly ownerId: string;
    readonly eventId: string;
  }): Promise<CanonicalEvent | undefined>;
  markProcessing(input: {
    readonly event: CanonicalEvent;
    readonly summary: string;
  }): Promise<void>;
  markProcessed(input: { readonly event: CanonicalEvent; readonly summary: string }): Promise<void>;
  markIgnored(input: { readonly event: CanonicalEvent; readonly summary: string }): Promise<void>;
  markFailed(input: { readonly event: CanonicalEvent; readonly summary: string }): Promise<void>;
}

/**
 * Runtime-owned event lookup and lifecycle projection. Domain event transactions still own
 * ingress and deterministic actions; this repository only lets a pg-boss worker rehydrate a
 * canonical event safely from its opaque job reference.
 */
export class DrizzleCanonicalEventRepository implements CanonicalEventRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async load(input: {
    readonly ownerId: string;
    readonly eventId: string;
  }): Promise<CanonicalEvent | undefined> {
    const [event] = await this.database
      .select()
      .from(events)
      .where(and(eq(events.id, input.eventId), eq(events.ownerId, input.ownerId)))
      .limit(1);
    return event ? asCanonicalEvent(event) : undefined;
  }

  public async markProcessing(input: {
    readonly event: CanonicalEvent;
    readonly summary: string;
  }): Promise<void> {
    await this.updateState(input.event, 'processing', input.summary, 'event.processing.started');
  }

  public async markProcessed(input: {
    readonly event: CanonicalEvent;
    readonly summary: string;
  }): Promise<void> {
    await this.updateState(input.event, 'processed', input.summary, 'event.processed');
  }

  public async markIgnored(input: {
    readonly event: CanonicalEvent;
    readonly summary: string;
  }): Promise<void> {
    await this.updateState(input.event, 'ignored', input.summary, 'event.ignored');
  }

  public async markFailed(input: {
    readonly event: CanonicalEvent;
    readonly summary: string;
  }): Promise<void> {
    await this.updateState(input.event, 'failed', input.summary, 'event.processing.failed');
  }

  private async updateState(
    event: CanonicalEvent,
    status: EventProcessingStatus,
    summary: string,
    auditAction: string,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const processedAt = status === 'processing' ? null : new Date();
      const [updated] = await transaction
        .update(events)
        .set({
          processingStatus: status,
          processedAt,
          processingSummary: summary,
          updatedAt: new Date(),
        })
        .where(and(eq(events.id, event.id), eq(events.ownerId, event.ownerId)))
        .returning({ id: events.id });
      if (!updated) {
        throw new Error('A worker lifecycle update targeted a missing or foreign canonical event.');
      }

      const audit = createSafeAuditEvent({
        id: randomUUID(),
        ownerId: event.ownerId,
        actorType: 'worker',
        actorId: null,
        action: auditAction,
        targetType: 'event',
        targetId: event.id,
        occurredAt: new Date().toISOString(),
        correlationId: event.correlationId,
        ...(event.causationId ? { causationId: event.causationId } : {}),
        previousState: { entityType: 'event', entityId: event.id },
        resultingState: { entityType: 'event', entityId: event.id },
        reason: summary,
        source: event.source,
        metadata: { eventType: event.eventType, processingStatus: status },
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
    });
  }
}

export interface RuntimeConversationRepository {
  /** Creates or returns the one non-public synthetic staging conversation for a trusted owner. */
  ensureSyntheticConversation(input: { readonly ownerId: string }): Promise<string>;
}

/**
 * The runtime route never accepts a conversation ID from its request body. This repository gives
 * its already-authenticated owner one deterministic internal conversation without creating a
 * public user or importing any personal conversation data.
 */
export class DrizzleRuntimeConversationRepository implements RuntimeConversationRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async ensureSyntheticConversation(input: { readonly ownerId: string }): Promise<string> {
    const externalConversationId = 'staging-runtime-synthetic';
    const [created] = await this.database
      .insert(conversations)
      .values({
        id: randomUUID(),
        ownerId: input.ownerId,
        channel: 'internal',
        externalConversationId,
        state: 'active',
        title: 'Staging runtime verification',
        metadata: { purpose: 'synthetic_runtime_verification' },
      })
      .onConflictDoNothing()
      .returning({ id: conversations.id });
    if (created) {
      return created.id;
    }

    const [existing] = await this.database
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.ownerId, input.ownerId),
          eq(conversations.channel, 'internal'),
          eq(conversations.externalConversationId, externalConversationId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error('A synthetic conversation insert conflicted without a canonical record.');
    }
    return existing.id;
  }
}

export interface TransportConnectionRegistry {
  /** Creates canonical control metadata only; it never creates a provider instance or session. */
  ensureEvolutionConnection(input: {
    readonly ownerId: string;
    readonly instanceReference: string;
    readonly providerBuildId: string;
    readonly baileysVersion: string;
    readonly imageDigest: string;
    readonly versionVerified: boolean;
  }): Promise<string>;
}

/**
 * JARVIS records its own transport control state separately from Evolution's database/session
 * state. Creating this row is safe configuration projection, not pairing or an outbound action.
 */
export class DrizzleTransportConnectionRegistry implements TransportConnectionRegistry {
  public constructor(private readonly database: JarvisDatabase) {}

  public async ensureEvolutionConnection(input: {
    readonly ownerId: string;
    readonly instanceReference: string;
    readonly providerBuildId: string;
    readonly baileysVersion: string;
    readonly imageDigest: string;
    readonly versionVerified: boolean;
  }): Promise<string> {
    const [created] = await this.database
      .insert(messagingTransportConnections)
      .values({
        id: randomUUID(),
        ownerId: input.ownerId,
        transport: 'evolution_whatsapp',
        instanceReference: input.instanceReference,
        providerBuildId: input.providerBuildId,
        baileysVersion: input.baileysVersion,
        imageDigest: input.imageDigest,
        versionVerified: input.versionVerified,
        outboundEnabled: false,
        state: 'unconfigured',
        metadata: { configuredBy: 'runtime_composition' },
      })
      .onConflictDoNothing()
      .returning({ id: messagingTransportConnections.id });
    if (created) {
      return created.id;
    }

    const [existing] = await this.database
      .select({ id: messagingTransportConnections.id })
      .from(messagingTransportConnections)
      .where(
        and(
          eq(messagingTransportConnections.ownerId, input.ownerId),
          eq(messagingTransportConnections.transport, 'evolution_whatsapp'),
          eq(messagingTransportConnections.instanceReference, input.instanceReference),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error('A transport connection insert conflicted without a canonical record.');
    }
    return existing.id;
  }
}
