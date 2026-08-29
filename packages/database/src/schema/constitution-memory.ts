import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
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
  defaultJsonObject,
  flexibilityEnum,
  jarvis,
  memoryKindEnum,
  sensitivityEnum,
  standardColumns,
} from './common.js';
import { owners } from './identity.js';

export const constitutionItems = jarvis.table(
  'constitution_items',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    category: varchar('category', { length: 160 }).notNull(),
    active: boolean('active').notNull().default(true),
    currentVersion: integer('current_version').notNull().default(1),
    reviewDate: date('review_date'),
  },
  (table) => [index('constitution_items_owner_active_index').on(table.ownerId, table.active)],
);

export const constitutionItemVersions = jarvis.table(
  'constitution_item_versions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    constitutionItemId: uuid('constitution_item_id')
      .notNull()
      .references(() => constitutionItems.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    principle: text('principle').notNull(),
    priority: integer('priority').notNull(),
    flexibility: flexibilityEnum('flexibility').notNull(),
    source: varchar('source', { length: 160 }).notNull(),
    active: boolean('active').notNull().default(true),
    isCurrent: boolean('is_current').notNull().default(true),
    reviewDate: date('review_date'),
    exceptions: jsonb('exceptions')
      .$type<readonly Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    changeReason: varchar('change_reason', { length: 1_000 }).notNull(),
  },
  (table) => [
    uniqueIndex('constitution_item_versions_unique').on(table.constitutionItemId, table.version),
    uniqueIndex('constitution_item_versions_current_unique')
      .on(table.constitutionItemId)
      .where(sql`${table.isCurrent} = true`),
    index('constitution_item_versions_owner_active_index').on(table.ownerId, table.active),
  ],
);

export const memoryRecords = jarvis.table(
  'memory_records',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    kind: memoryKindEnum('kind').notNull(),
    source: varchar('source', { length: 160 }).notNull(),
    sourceEventId: uuid('source_event_id'),
    confidenceBasisPoints: integer('confidence_basis_points').notNull(),
    sensitivity: sensitivityEnum('sensitivity').notNull().default('sensitive'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    reviewAt: timestamp('review_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    supersededByMemoryRecordId: uuid('superseded_by_memory_record_id'),
    evidenceCount: integer('evidence_count').notNull().default(0),
    positiveEvidenceCount: integer('positive_evidence_count').notNull().default(0),
    negativeEvidenceCount: integer('negative_evidence_count').notNull().default(0),
    relatedEntityIds: jsonb('related_entity_ids')
      .$type<readonly string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    index('memory_records_owner_kind_active_index').on(table.ownerId, table.kind, table.active),
    index('memory_records_review_index').on(table.ownerId, table.reviewAt),
    index('memory_records_source_event_index').on(table.sourceEventId),
  ],
);

export const facts = jarvis.table(
  'facts',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    subject: varchar('subject', { length: 512 }).notNull(),
    predicate: varchar('predicate', { length: 512 }).notNull(),
    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [uniqueIndex('facts_memory_record_unique').on(table.memoryRecordId)],
);

export const preferences = jarvis.table(
  'preferences',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    topic: varchar('topic', { length: 512 }).notNull(),
    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [uniqueIndex('preferences_memory_record_unique').on(table.memoryRecordId)],
);

export const people = jarvis.table(
  'people',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    displayName: varchar('display_name', { length: 512 }).notNull(),
    externalReference: varchar('external_reference', { length: 512 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [uniqueIndex('people_memory_record_unique').on(table.memoryRecordId)],
);

export const relationships = jarvis.table(
  'relationships',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    fromPersonId: uuid('from_person_id').references(() => people.id, { onDelete: 'set null' }),
    toPersonId: uuid('to_person_id').references(() => people.id, { onDelete: 'set null' }),
    relationshipType: varchar('relationship_type', { length: 160 }).notNull(),
    description: text('description'),
  },
  (table) => [uniqueIndex('relationships_memory_record_unique').on(table.memoryRecordId)],
);

export const projects = jarvis.table(
  'projects',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 512 }).notNull(),
    status: varchar('status', { length: 80 }).notNull().default('active'),
    description: text('description'),
  },
  (table) => [uniqueIndex('projects_memory_record_unique').on(table.memoryRecordId)],
);

export const observations = jarvis.table(
  'observations',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    observation: text('observation').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('observations_memory_record_unique').on(table.memoryRecordId)],
);

export const hypotheses = jarvis.table(
  'hypotheses',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    hypothesis: text('hypothesis').notNull(),
    status: varchar('status', { length: 80 }).notNull().default('open'),
    evidenceSummary: text('evidence_summary'),
  },
  (table) => [uniqueIndex('hypotheses_memory_record_unique').on(table.memoryRecordId)],
);

export const openLoops = jarvis.table(
  'open_loops',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    state: varchar('state', { length: 80 }).notNull().default('open'),
    followUpAfter: timestamp('follow_up_after', { withTimezone: true }),
    reviewAfter: timestamp('review_after', { withTimezone: true }),
    uncertainty: varchar('uncertainty', { length: 80 }).notNull().default('unknown'),
    relatedEntityType: varchar('related_entity_type', { length: 80 }),
    relatedEntityId: uuid('related_entity_id'),
    relatedCommitmentId: uuid('related_commitment_id'),
    resolutionState: varchar('resolution_state', { length: 80 }).notNull().default('unresolved'),
  },
  (table) => [uniqueIndex('open_loops_memory_record_unique').on(table.memoryRecordId)],
);

export const personalityTraits = jarvis.table(
  'personality_traits',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryRecordId: uuid('memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'restrict' }),
    trait: varchar('trait', { length: 160 }).notNull(),
    value: varchar('value', { length: 512 }).notNull(),
    currentEstimate: integer('current_estimate').notNull().default(50),
    confidenceBasisPoints: integer('confidence_basis_points').notNull().default(0),
    evidenceCount: integer('evidence_count').notNull().default(0),
    positiveEvidenceCount: integer('positive_evidence_count').notNull().default(0),
    negativeEvidenceCount: integer('negative_evidence_count').notNull().default(0),
    frozen: boolean('frozen').notNull().default(false),
    learningEnabled: boolean('learning_enabled').notNull().default(true),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('personality_traits_memory_record_unique').on(table.memoryRecordId)],
);
