import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  channelEnum,
  defaultJsonObject,
  eventSourceEnum,
  eventProcessingStatusEnum,
  jarvis,
  sensitivityEnum,
  standardColumns,
} from './common.js';
import { owners } from './identity.js';

export const conversations = jarvis.table(
  'conversations',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    channel: channelEnum('channel').notNull(),
    externalConversationId: varchar('external_conversation_id', { length: 512 }),
    state: varchar('state', { length: 32 }).notNull().default('active'),
    title: varchar('title', { length: 256 }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('conversations_owner_channel_external_unique')
      .on(table.ownerId, table.channel, table.externalConversationId)
      .where(sql`${table.externalConversationId} is not null`),
    index('conversations_owner_updated_index').on(table.ownerId, table.updatedAt),
  ],
);

export const messages = jarvis.table(
  'messages',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'restrict' }),
    channel: channelEnum('channel').notNull(),
    direction: varchar('direction', { length: 32 }).notNull(),
    externalMessageId: varchar('external_message_id', { length: 512 }),
    senderReference: varchar('sender_reference', { length: 512 }),
    replyToMessageId: uuid('reply_to_message_id'),
    contentType: varchar('content_type', { length: 80 }).notNull().default('text/plain'),
    content: text('content'),
    deliveryState: varchar('delivery_state', { length: 32 }).notNull().default('received'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    sourceEventId: uuid('source_event_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('messages_owner_channel_external_unique')
      .on(table.ownerId, table.channel, table.externalMessageId)
      .where(sql`${table.externalMessageId} is not null`),
    index('messages_conversation_occurred_index').on(table.conversationId, table.occurredAt),
    index('messages_owner_source_event_index').on(table.ownerId, table.sourceEventId),
  ],
);

export const messageAttachments = jarvis.table(
  'message_attachments',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'restrict' }),
    objectReference: varchar('object_reference', { length: 1_024 }).notNull(),
    mediaType: varchar('media_type', { length: 160 }).notNull(),
    byteLength: integer('byte_length').notNull(),
    contentHash: varchar('content_hash', { length: 128 }),
    retentionState: varchar('retention_state', { length: 32 }).notNull().default('unconfigured'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [index('message_attachments_message_index').on(table.messageId)],
);

export const messageSourceLinks = jarvis.table(
  'message_source_links',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'restrict' }),
    sourceType: varchar('source_type', { length: 160 }).notNull(),
    sourceReference: varchar('source_reference', { length: 512 }).notNull(),
    sourceEventId: uuid('source_event_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('message_source_links_unique').on(
      table.messageId,
      table.sourceType,
      table.sourceReference,
    ),
  ],
);

export const events = jarvis.table(
  'events',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    eventType: varchar('event_type', { length: 160 }).notNull(),
    source: eventSourceEnum('source').notNull(),
    sourceEventId: varchar('source_event_id', { length: 512 }),
    idempotencyKey: varchar('idempotency_key', { length: 256 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    payloadHash: varchar('payload_hash', { length: 128 }).notNull(),
    schemaVersion: integer('schema_version').notNull(),
    processingStatus: eventProcessingStatusEnum('processing_status').notNull().default('received'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingSummary: varchar('processing_summary', { length: 1_000 }),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    sensitivity: sensitivityEnum('sensitivity').notNull().default('sensitive'),
  },
  (table) => [
    uniqueIndex('events_owner_idempotency_unique').on(table.ownerId, table.idempotencyKey),
    uniqueIndex('events_owner_source_event_unique')
      .on(table.ownerId, table.source, table.eventType, table.sourceEventId)
      .where(sql`${table.sourceEventId} is not null`),
    index('events_processing_index').on(table.processingStatus, table.receivedAt),
    index('events_correlation_index').on(table.correlationId, table.receivedAt),
  ],
);

export const eventProcessingAttempts = jarvis.table(
  'event_processing_attempts',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    jobId: uuid('job_id'),
    attemptNumber: integer('attempt_number').notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    errorCategory: varchar('error_category', { length: 80 }),
    errorSummary: varchar('error_summary', { length: 1_000 }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    uniqueIndex('event_processing_attempts_event_attempt_unique').on(
      table.eventId,
      table.attemptNumber,
    ),
    index('event_processing_attempts_owner_event_index').on(table.ownerId, table.eventId),
  ],
);
