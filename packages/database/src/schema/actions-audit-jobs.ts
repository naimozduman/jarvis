import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  actionRiskClassEnum,
  actorTypeEnum,
  approvalStateEnum,
  defaultJsonObject,
  durableJobStatusEnum,
  jarvis,
  jobErrorCategoryEnum,
  proposedActionStateEnum,
  standardColumns,
} from './common.js';
import { brainDecisions, brainRequests } from './brain.js';
import { events } from './conversations-events.js';
import { owners } from './identity.js';

export const deterministicDecisions = jarvis.table(
  'deterministic_decisions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    decisionType: varchar('decision_type', { length: 160 }).notNull(),
    decisionVersion: varchar('decision_version', { length: 64 }).notNull(),
    inputHash: varchar('input_hash', { length: 128 }).notNull(),
    output: jsonb('output').$type<Record<string, unknown>>().notNull(),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('deterministic_decisions_owner_event_index').on(table.ownerId, table.sourceEventId),
  ],
);

export const policyRuleOverrides = jarvis.table(
  'policy_rule_overrides',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    ruleId: varchar('rule_id', { length: 160 }).notNull(),
    actionType: varchar('action_type', { length: 160 }).notNull(),
    effect: varchar('effect', { length: 80 }).notNull(),
    active: boolean('active').notNull().default(true),
    source: varchar('source', { length: 160 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('policy_rule_overrides_owner_rule_unique').on(table.ownerId, table.ruleId),
    index('policy_rule_overrides_owner_action_index').on(table.ownerId, table.actionType),
  ],
);

export const proposedActions = jarvis.table(
  'proposed_actions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    actionType: varchar('action_type', { length: 160 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    payloadHash: varchar('payload_hash', { length: 128 }).notNull(),
    riskClass: actionRiskClassEnum('risk_class').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 256 }).notNull(),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    sourceDecisionId: uuid('source_decision_id').references(() => deterministicDecisions.id, {
      onDelete: 'set null',
    }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    state: proposedActionStateEnum('state').notNull().default('proposed'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
  },
  (table) => [
    uniqueIndex('proposed_actions_owner_idempotency_unique').on(
      table.ownerId,
      table.idempotencyKey,
    ),
    index('proposed_actions_owner_state_index').on(table.ownerId, table.state),
    index('proposed_actions_correlation_index').on(table.correlationId),
  ],
);

export const policyEvaluations = jarvis.table(
  'policy_evaluations',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    proposedActionId: uuid('proposed_action_id')
      .notNull()
      .references(() => proposedActions.id, { onDelete: 'restrict' }),
    allowed: boolean('allowed').notNull().default(false),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    denied: boolean('denied').notNull().default(false),
    reason: varchar('reason', { length: 1_000 }).notNull(),
    policyVersion: varchar('policy_version', { length: 64 }).notNull(),
    matchedRules: jsonb('matched_rules').$type<readonly string[]>().notNull(),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [index('policy_evaluations_action_index').on(table.proposedActionId)],
);

export const approvalRequests = jarvis.table(
  'approval_requests',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    proposedActionId: uuid('proposed_action_id')
      .notNull()
      .references(() => proposedActions.id, { onDelete: 'restrict' }),
    actionSnapshotHash: varchar('action_snapshot_hash', { length: 128 }).notNull(),
    riskClass: actionRiskClassEnum('risk_class').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    state: approvalStateEnum('state').notNull().default('pending'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    actorId: uuid('actor_id'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    sourceDecisionId: uuid('source_decision_id').references(() => deterministicDecisions.id, {
      onDelete: 'set null',
    }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    uniqueIndex('approval_requests_live_action_unique')
      .on(table.proposedActionId)
      .where(sql`${table.state} = 'pending'`),
    index('approval_requests_owner_state_expires_index').on(
      table.ownerId,
      table.state,
      table.expiresAt,
    ),
  ],
);

export const actionExecutions = jarvis.table(
  'action_executions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    proposedActionId: uuid('proposed_action_id')
      .notNull()
      .references(() => proposedActions.id, { onDelete: 'restrict' }),
    approvalRequestId: uuid('approval_request_id').references(() => approvalRequests.id, {
      onDelete: 'set null',
    }),
    executionAttempt: integer('execution_attempt').notNull().default(1),
    status: varchar('status', { length: 32 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 256 }).notNull(),
    externalReferenceId: varchar('external_reference_id', { length: 512 }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorCategory: jobErrorCategoryEnum('error_category'),
    errorSummary: varchar('error_summary', { length: 1_000 }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    uniqueIndex('action_executions_action_attempt_unique').on(
      table.proposedActionId,
      table.executionAttempt,
    ),
    uniqueIndex('action_executions_owner_idempotency_unique').on(
      table.ownerId,
      table.idempotencyKey,
    ),
  ],
);

export const actionResults = jarvis.table(
  'action_results',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    actionExecutionId: uuid('action_execution_id')
      .notNull()
      .references(() => actionExecutions.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull(),
    result: jsonb('result').$type<Record<string, unknown>>().notNull().default(defaultJsonObject),
    externalReferenceId: varchar('external_reference_id', { length: 512 }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [uniqueIndex('action_results_execution_unique').on(table.actionExecutionId)],
);

export const auditEvents = jarvis.table(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    action: varchar('action', { length: 160 }).notNull(),
    targetType: varchar('target_type', { length: 160 }).notNull(),
    targetId: uuid('target_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    previousStateReference: jsonb('previous_state_reference').$type<Record<string, unknown>>(),
    resultingStateReference: jsonb('resulting_state_reference').$type<Record<string, unknown>>(),
    reason: varchar('reason', { length: 1_000 }),
    source: varchar('source', { length: 160 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    index('audit_events_owner_occurred_index').on(table.ownerId, table.occurredAt),
    index('audit_events_correlation_occurred_index').on(table.correlationId, table.occurredAt),
    index('audit_events_target_index').on(table.targetType, table.targetId),
  ],
);

export const jobs = jarvis.table(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    jobType: varchar('job_type', { length: 160 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: durableJobStatusEnum('status').notNull().default('queued'),
    priority: integer('priority').notNull().default(0),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    availableAfter: timestamp('available_after', { withTimezone: true }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    maximumAttempts: integer('maximum_attempts').notNull().default(5),
    leaseOwner: varchar('lease_owner', { length: 160 }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastErrorCategory: jobErrorCategoryEnum('last_error_category'),
    lastErrorSummary: varchar('last_error_summary', { length: 1_000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    brainRequestId: uuid('brain_request_id').references(() => brainRequests.id, {
      onDelete: 'set null',
    }),
    proposedActionId: uuid('proposed_action_id').references(() => proposedActions.id, {
      onDelete: 'set null',
    }),
    idempotencyKey: varchar('idempotency_key', { length: 256 }).notNull(),
  },
  (table) => [
    uniqueIndex('jobs_owner_type_idempotency_unique').on(
      table.ownerId,
      table.jobType,
      table.idempotencyKey,
    ),
    index('jobs_claim_projection_index').on(
      table.status,
      table.availableAfter,
      table.priority,
      table.createdAt,
    ),
    index('jobs_owner_type_status_index').on(table.ownerId, table.jobType, table.status),
    check('jobs_priority_range', sql`${table.priority} between -100 and 100`),
    check(
      'jobs_attempt_count_range',
      sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= ${table.maximumAttempts}`,
    ),
    check('jobs_maximum_attempts_range', sql`${table.maximumAttempts} between 1 and 20`),
  ],
);

export const jobExecutions = jarvis.table(
  'job_executions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    workerId: varchar('worker_id', { length: 160 }).notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    leasedAt: timestamp('leased_at', { withTimezone: true }).notNull(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorCategory: jobErrorCategoryEnum('error_category'),
    errorSummary: varchar('error_summary', { length: 1_000 }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    uniqueIndex('job_executions_job_attempt_unique').on(table.jobId, table.attemptNumber),
    index('job_executions_worker_active_index').on(table.workerId, table.leaseExpiresAt),
  ],
);
