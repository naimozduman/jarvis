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
  commitmentStatusEnum,
  defaultJsonObject,
  flexibilityEnum,
  jarvis,
  planBlockCompletionStateEnum,
  planBlockKindEnum,
  reminderStateEnum,
  reminderTriggerKindEnum,
  standardColumns,
} from './common.js';
import { owners } from './identity.js';

export const commitments = jarvis.table(
  'commitments',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 512 }).notNull(),
    description: text('description'),
    status: commitmentStatusEnum('status').notNull().default('open'),
    priority: integer('priority').notNull().default(0),
    consequence: text('consequence'),
    flexibility: flexibilityEnum('flexibility').notNull().default('flexible'),
    source: varchar('source', { length: 160 }).notNull(),
    sourceEventId: uuid('source_event_id'),
    completionEvidenceReference: varchar('completion_evidence_reference', { length: 1_024 }),
    minimumAcceptableVersion: text('minimum_acceptable_version'),
    followUpState: varchar('follow_up_state', { length: 80 }).notNull().default('required'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    index('commitments_owner_status_index').on(table.ownerId, table.status),
    index('commitments_owner_follow_up_index').on(table.ownerId, table.followUpState),
  ],
);

export const commitmentStatusHistory = jarvis.table(
  'commitment_status_history',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    commitmentId: uuid('commitment_id')
      .notNull()
      .references(() => commitments.id, { onDelete: 'restrict' }),
    previousStatus: commitmentStatusEnum('previous_status'),
    nextStatus: commitmentStatusEnum('next_status').notNull(),
    actorType: varchar('actor_type', { length: 80 }).notNull(),
    actorId: uuid('actor_id'),
    reason: varchar('reason', { length: 1_000 }),
    evidenceReference: varchar('evidence_reference', { length: 1_024 }),
    source: varchar('source', { length: 160 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
  },
  (table) => [index('commitment_status_history_commitment_index').on(table.commitmentId)],
);

export const commitmentDeadlines = jarvis.table(
  'commitment_deadlines',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    commitmentId: uuid('commitment_id')
      .notNull()
      .references(() => commitments.id, { onDelete: 'restrict' }),
    deadlineKind: varchar('deadline_kind', { length: 80 }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    timezone: varchar('timezone', { length: 80 }).notNull(),
    isHard: boolean('is_hard').notNull().default(false),
    source: varchar('source', { length: 160 }).notNull(),
  },
  (table) => [index('commitment_deadlines_owner_due_index').on(table.ownerId, table.dueAt)],
);

export const commitmentDependencies = jarvis.table(
  'commitment_dependencies',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    commitmentId: uuid('commitment_id')
      .notNull()
      .references(() => commitments.id, { onDelete: 'cascade' }),
    dependsOnCommitmentId: uuid('depends_on_commitment_id')
      .notNull()
      .references(() => commitments.id, { onDelete: 'restrict' }),
    dependencyKind: varchar('dependency_kind', { length: 80 }).notNull().default('finish_before'),
  },
  (table) => [
    uniqueIndex('commitment_dependencies_unique').on(
      table.commitmentId,
      table.dependsOnCommitmentId,
    ),
  ],
);

export const reminders = jarvis.table(
  'reminders',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    commitmentId: uuid('commitment_id').references(() => commitments.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 512 }).notNull(),
    state: reminderStateEnum('state').notNull().default('active'),
    escalationLevel: integer('escalation_level').notNull().default(0),
    nextEligibleDeliveryAt: timestamp('next_eligible_delivery_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    source: varchar('source', { length: 160 }).notNull(),
    sourceCommitmentId: uuid('source_commitment_id').references(() => commitments.id, {
      onDelete: 'set null',
    }),
    jobId: uuid('job_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    index('reminders_owner_active_due_index').on(
      table.ownerId,
      table.state,
      table.nextEligibleDeliveryAt,
    ),
    index('reminders_commitment_index').on(table.commitmentId),
  ],
);

export const reminderTriggers = jarvis.table(
  'reminder_triggers',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    reminderId: uuid('reminder_id')
      .notNull()
      .references(() => reminders.id, { onDelete: 'cascade' }),
    triggerKind: reminderTriggerKindEnum('trigger_kind').notNull(),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull(),
    nextScheduledAt: timestamp('next_scheduled_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
  },
  (table) => [index('reminder_triggers_schedule_index').on(table.active, table.nextScheduledAt)],
);

export const reminderAttempts = jarvis.table(
  'reminder_attempts',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    reminderId: uuid('reminder_id')
      .notNull()
      .references(() => reminders.id, { onDelete: 'restrict' }),
    triggerId: uuid('trigger_id').references(() => reminderTriggers.id, { onDelete: 'set null' }),
    jobId: uuid('job_id'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
    outcome: varchar('outcome', { length: 80 }).notNull(),
    escalationLevel: integer('escalation_level').notNull(),
    nextEligibleDeliveryAt: timestamp('next_eligible_delivery_at', { withTimezone: true }),
    deliveryReference: varchar('delivery_reference', { length: 512 }),
    errorCategory: varchar('error_category', { length: 80 }),
    errorSummary: varchar('error_summary', { length: 1_000 }),
  },
  (table) => [
    index('reminder_attempts_reminder_attempted_index').on(table.reminderId, table.attemptedAt),
  ],
);

export const dayPlans = jarvis.table(
  'day_plans',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    localDate: date('local_date').notNull(),
    timezone: varchar('timezone', { length: 80 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    revision: integer('revision').notNull().default(1),
    source: varchar('source', { length: 160 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('day_plans_owner_date_active_unique')
      .on(table.ownerId, table.localDate)
      .where(sql`${table.status} = 'active'`),
    index('day_plans_owner_date_index').on(table.ownerId, table.localDate),
  ],
);

export const planBlocks = jarvis.table(
  'plan_blocks',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    dayPlanId: uuid('day_plan_id')
      .notNull()
      .references(() => dayPlans.id, { onDelete: 'cascade' }),
    commitmentId: uuid('commitment_id').references(() => commitments.id, { onDelete: 'set null' }),
    blockKind: planBlockKindEnum('block_kind').notNull(),
    role: varchar('role', { length: 80 }).notNull().default('other'),
    anchorClass: varchar('anchor_class', { length: 80 }).notNull().default('flexible'),
    priority: integer('priority').notNull().default(0),
    completionState: planBlockCompletionStateEnum('completion_state').notNull().default('planned'),
    title: varchar('title', { length: 512 }).notNull(),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    earliestStartAt: timestamp('earliest_start_at', { withTimezone: true }),
    latestFinishAt: timestamp('latest_finish_at', { withTimezone: true }),
    estimatedDurationMinutes: integer('estimated_duration_minutes').notNull(),
    minimumDurationMinutes: integer('minimum_duration_minutes'),
    source: varchar('source', { length: 160 }).notNull(),
    reasonForPlacement: varchar('reason_for_placement', { length: 1_000 }),
    movedFromBlockId: uuid('moved_from_block_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [index('plan_blocks_plan_schedule_index').on(table.dayPlanId, table.startAt)],
);

export const planBlockDependencies = jarvis.table(
  'plan_block_dependencies',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    planBlockId: uuid('plan_block_id')
      .notNull()
      .references(() => planBlocks.id, { onDelete: 'cascade' }),
    dependsOnPlanBlockId: uuid('depends_on_plan_block_id')
      .notNull()
      .references(() => planBlocks.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('plan_block_dependencies_unique').on(table.planBlockId, table.dependsOnPlanBlockId),
  ],
);

export const replanningHistory = jarvis.table(
  'replanning_history',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    dayPlanId: uuid('day_plan_id')
      .notNull()
      .references(() => dayPlans.id, { onDelete: 'restrict' }),
    previousRevision: integer('previous_revision').notNull(),
    resultingRevision: integer('resulting_revision').notNull(),
    trigger: varchar('trigger', { length: 160 }).notNull(),
    reason: varchar('reason', { length: 1_000 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    source: varchar('source', { length: 160 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    index('replanning_history_plan_revision_index').on(table.dayPlanId, table.resultingRevision),
  ],
);
