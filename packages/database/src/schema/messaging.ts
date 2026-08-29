import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  defaultJsonObject,
  jarvis,
  messagingConnectionStateEnum,
  outboundDeliveryStateEnum,
  standardColumns,
} from './common.js';
import { events, messages } from './conversations-events.js';
import { owners } from './identity.js';

/**
 * Canonical transport control state. This is intentionally distinct from an Evolution database or
 * Baileys session directory: JARVIS remains authoritative for its own delivery/audit lifecycle.
 */
export const messagingTransportConnections = jarvis.table(
  'messaging_transport_connections',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    transport: varchar('transport', { length: 80 }).notNull(),
    instanceReference: varchar('instance_reference', { length: 512 }).notNull(),
    providerBuildId: varchar('provider_build_id', { length: 256 }),
    baileysVersion: varchar('baileys_version', { length: 80 }),
    imageDigest: varchar('image_digest', { length: 128 }),
    versionVerified: boolean('version_verified').notNull().default(false),
    outboundEnabled: boolean('outbound_enabled').notNull().default(false),
    state: messagingConnectionStateEnum('state').notNull().default('unconfigured'),
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
    lastOutboundAt: timestamp('last_outbound_at', { withTimezone: true }),
    lastReconciledAt: timestamp('last_reconciled_at', { withTimezone: true }),
    lastSafeErrorCategory: varchar('last_safe_error_category', { length: 80 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('messaging_transport_connections_owner_transport_instance_unique').on(
      table.ownerId,
      table.transport,
      table.instanceReference,
    ),
    index('messaging_transport_connections_owner_state_index').on(table.ownerId, table.state),
  ],
);

export const messagingConnectionStateEvents = jarvis.table(
  'messaging_connection_state_events',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => messagingTransportConnections.id, { onDelete: 'restrict' }),
    previousState: messagingConnectionStateEnum('previous_state'),
    resultingState: messagingConnectionStateEnum('resulting_state').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    correlationId: uuid('correlation_id').notNull(),
    safeErrorCategory: varchar('safe_error_category', { length: 80 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    index('messaging_connection_state_events_connection_occurred_index').on(
      table.connectionId,
      table.occurredAt,
    ),
  ],
);

/** A future approved-contact extension; aliases are opaque and never raw JIDs. */
export const messagingIdentityAliases = jarvis.table(
  'messaging_identity_aliases',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => messagingTransportConnections.id, { onDelete: 'restrict' }),
    identityReference: varchar('identity_reference', { length: 512 }).notNull(),
    canonicalContactReference: varchar('canonical_contact_reference', { length: 512 }).notNull(),
    identityKind: varchar('identity_kind', { length: 80 }).notNull(),
    approved: boolean('approved').notNull().default(false),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('messaging_identity_aliases_connection_reference_unique').on(
      table.connectionId,
      table.identityReference,
    ),
    index('messaging_identity_aliases_owner_approved_index').on(table.ownerId, table.approved),
  ],
);

/** Safe operational record for rejected traffic; no raw body, JID, message content, or API key. */
export const messagingTransportRejections = jarvis.table(
  'messaging_transport_rejections',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    transport: varchar('transport', { length: 80 }).notNull(),
    instanceReference: varchar('instance_reference', { length: 512 }).notNull(),
    providerEventReference: varchar('provider_event_reference', { length: 512 }),
    eventType: varchar('event_type', { length: 160 }).notNull(),
    senderReference: varchar('sender_reference', { length: 512 }),
    reason: varchar('reason', { length: 160 }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('messaging_transport_rejections_dedupe_unique')
      .on(table.ownerId, table.instanceReference, table.providerEventReference, table.reason)
      .where(sql`${table.providerEventReference} is not null`),
    index('messaging_transport_rejections_owner_received_index').on(
      table.ownerId,
      table.receivedAt,
    ),
  ],
);

/**
 * Durable provider-free outbox projection. A transport worker leases this row after policy; an
 * external send is never issued from a Brain transaction or webhook request.
 */
export const outboundMessageDeliveries = jarvis.table(
  'outbound_message_deliveries',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'restrict' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => messagingTransportConnections.id, { onDelete: 'restrict' }),
    transport: varchar('transport', { length: 80 }).notNull(),
    targetReference: varchar('target_reference', { length: 512 }).notNull(),
    operationKey: varchar('operation_key', { length: 256 }).notNull(),
    mediaObjectReference: varchar('media_object_reference', { length: 1_024 }),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    brainRequestId: uuid('brain_request_id'),
    reminderId: uuid('reminder_id'),
    state: outboundDeliveryStateEnum('state').notNull().default('pending'),
    providerMessageReference: varchar('provider_message_reference', { length: 512 }),
    attemptCount: integer('attempt_count').notNull().default(0),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    requiresReconciliation: boolean('requires_reconciliation').notNull().default(false),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    lastErrorCategory: varchar('last_error_category', { length: 80 }),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('outbound_message_deliveries_owner_operation_unique').on(
      table.ownerId,
      table.operationKey,
    ),
    uniqueIndex('outbound_message_deliveries_connection_provider_message_unique')
      .on(table.connectionId, table.providerMessageReference)
      .where(sql`${table.providerMessageReference} is not null`),
    index('outbound_message_deliveries_connection_state_index').on(
      table.connectionId,
      table.state,
      table.createdAt,
    ),
    index('outbound_message_deliveries_message_index').on(table.messageId),
  ],
);

/** Metadata-only media boundary. Fetching is a later durable job and never a model side effect. */
export const mediaFetchRequests = jarvis.table(
  'media_fetch_requests',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'restrict' }),
    providerMediaReference: varchar('provider_media_reference', { length: 512 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('metadata_only'),
    mimeType: varchar('mime_type', { length: 160 }),
    byteLength: integer('byte_length'),
    objectReference: varchar('object_reference', { length: 1_024 }),
    contentHash: varchar('content_hash', { length: 128 }),
    safeErrorCategory: varchar('safe_error_category', { length: 80 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('media_fetch_requests_message_provider_unique').on(
      table.messageId,
      table.providerMediaReference,
    ),
    index('media_fetch_requests_owner_state_index').on(table.ownerId, table.state),
  ],
);
