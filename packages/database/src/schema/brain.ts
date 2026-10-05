import { sql } from 'drizzle-orm';
import type { ModelRequestAdmission, ModelRun } from '@jarvis/contracts';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { defaultJsonObject, jarvis, standardColumns } from './common.js';
import { constitutionItems, memoryRecords } from './constitution-memory.js';
import { commitments, dayPlans, reminders } from './commitments-planning.js';
import { events, conversations, messages } from './conversations-events.js';
import { owners } from './identity.js';

/**
 * Model-request provenance is separate from Phase 1 `deterministic_decisions`. The tables below
 * intentionally store only safe summaries, opaque record references, and provider metadata—not
 * prompts, raw messages, provider reasoning, or private provider payloads.
 */
export const brainRequests = jarvis.table(
  'brain_requests',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    purpose: varchar('purpose', { length: 80 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('received'),
    idempotencyKey: varchar('idempotency_key', { length: 256 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    promptVersion: varchar('prompt_version', { length: 256 }),
    contextVersion: varchar('context_version', { length: 64 }),
    safeErrorCategory: varchar('safe_error_category', { length: 80 }),
    admission: jsonb('admission').$type<ModelRequestAdmission>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('brain_requests_owner_idempotency_unique').on(table.ownerId, table.idempotencyKey),
    uniqueIndex('brain_requests_owner_source_event_unique')
      .on(table.ownerId, table.sourceEventId)
      .where(sql`${table.sourceEventId} is not null`),
    index('brain_requests_owner_state_created_index').on(
      table.ownerId,
      table.state,
      table.createdAt,
    ),
  ],
);

export const contextManifests = jarvis.table(
  'context_manifests',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    brainRequestId: uuid('brain_request_id')
      .notNull()
      .references(() => brainRequests.id, { onDelete: 'restrict' }),
    contextVersion: varchar('context_version', { length: 64 }).notNull(),
    promptTokenEstimate: integer('prompt_token_estimate').notNull(),
    recordLimit: integer('record_limit').notNull(),
    excludedRecordCount: integer('excluded_record_count').notNull().default(0),
    sourceHash: varchar('source_hash', { length: 128 }).notNull(),
  },
  (table) => [
    uniqueIndex('context_manifests_request_unique').on(table.brainRequestId),
    index('context_manifests_owner_created_index').on(table.ownerId, table.createdAt),
  ],
);

export const contextManifestRecords = jarvis.table(
  'context_manifest_records',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    contextManifestId: uuid('context_manifest_id')
      .notNull()
      .references(() => contextManifests.id, { onDelete: 'cascade' }),
    recordType: varchar('record_type', { length: 80 }).notNull(),
    recordId: uuid('record_id').notNull(),
    rank: integer('rank').notNull(),
    score: integer('score').notNull(),
    selectionReasons: jsonb('selection_reasons').$type<readonly string[]>().notNull(),
    sensitivity: varchar('sensitivity', { length: 32 }).notNull(),
    redactedForModel: boolean('redacted_for_model').notNull().default(false),
  },
  (table) => [
    uniqueIndex('context_manifest_records_unique').on(
      table.contextManifestId,
      table.recordType,
      table.recordId,
    ),
    index('context_manifest_records_owner_record_index').on(
      table.ownerId,
      table.recordType,
      table.recordId,
    ),
  ],
);

export const modelRuns = jarvis.table(
  'model_runs',
  {
    ...standardColumns,
    admission: jsonb('admission').$type<ModelRequestAdmission>(),
    usageAccounting: jsonb('usage_accounting').$type<NonNullable<ModelRun['usageAccounting']>>(),
    outputAudit: jsonb('output_audit').$type<NonNullable<ModelRun['outputAudit']>>(),
    exactGatewayCostUsd: text('exact_gateway_cost_usd'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    brainRequestId: uuid('brain_request_id')
      .notNull()
      .references(() => brainRequests.id, { onDelete: 'restrict' }),
    contextManifestId: uuid('context_manifest_id').references(() => contextManifests.id, {
      onDelete: 'set null',
    }),
    provider: varchar('provider', { length: 80 }).notNull(),
    route: varchar('route', { length: 32 }).notNull(),
    configuredModelId: varchar('configured_model_id', { length: 160 }).notNull(),
    actualModelId: varchar('actual_model_id', { length: 160 }),
    reasoningEffort: varchar('reasoning_effort', { length: 32 }),
    status: varchar('status', { length: 80 }).notNull(),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    reasoningTokens: integer('reasoning_tokens'),
    cachedInputTokens: integer('cached_input_tokens'),
    estimatedCostUsd: numeric('estimated_cost_usd', { precision: 14, scale: 8 }),
    errorCategory: varchar('error_category', { length: 80 }),
  },
  (table) => [
    index('model_runs_owner_created_index').on(table.ownerId, table.createdAt),
    index('model_runs_request_index').on(table.brainRequestId),
  ],
);

export const brainDecisions = jarvis.table(
  'brain_decisions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    brainRequestId: uuid('brain_request_id')
      .notNull()
      .references(() => brainRequests.id, { onDelete: 'restrict' }),
    modelRunId: uuid('model_run_id').references(() => modelRuns.id, { onDelete: 'set null' }),
    decisionType: varchar('decision_type', { length: 80 }).notNull(),
    decisionSummary: varchar('decision_summary', { length: 2_000 }).notNull(),
    materialTradeoffs: jsonb('material_tradeoffs').$type<readonly string[]>().notNull(),
    confidenceBasisPoints: integer('confidence_basis_points').notNull(),
    missingInformation: jsonb('missing_information').$type<readonly string[]>().notNull(),
    validationState: varchar('validation_state', { length: 80 }).notNull(),
    promptVersion: varchar('prompt_version', { length: 256 }).notNull(),
    contextVersion: varchar('context_version', { length: 64 }).notNull(),
    executionResult: jsonb('execution_result')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    uniqueIndex('brain_decisions_request_unique').on(table.brainRequestId),
    index('brain_decisions_owner_created_index').on(table.ownerId, table.createdAt),
  ],
);

export const brainDecisionEvidence = jarvis.table(
  'brain_decision_evidence',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    brainDecisionId: uuid('brain_decision_id')
      .notNull()
      .references(() => brainDecisions.id, { onDelete: 'cascade' }),
    recordType: varchar('record_type', { length: 80 }).notNull(),
    recordId: uuid('record_id').notNull(),
    source: varchar('source', { length: 160 }).notNull(),
    informationState: varchar('information_state', { length: 32 }).notNull(),
    confidenceBasisPoints: integer('confidence_basis_points').notNull(),
    sensitivity: varchar('sensitivity', { length: 32 }).notNull(),
  },
  (table) => [
    uniqueIndex('brain_decision_evidence_unique').on(
      table.brainDecisionId,
      table.recordType,
      table.recordId,
    ),
    index('brain_decision_evidence_owner_record_index').on(table.ownerId, table.recordId),
  ],
);

export const constitutionProposals = jarvis.table(
  'constitution_proposals',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    constitutionItemId: uuid('constitution_item_id').references(() => constitutionItems.id, {
      onDelete: 'set null',
    }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    category: varchar('category', { length: 160 }).notNull(),
    principle: text('principle').notNull(),
    priority: integer('priority').notNull(),
    flexibility: varchar('flexibility', { length: 32 }).notNull(),
    minimumAcceptableVersion: text('minimum_acceptable_version'),
    consequence: text('consequence'),
    state: varchar('state', { length: 80 }).notNull().default('draft'),
    proposedBy: varchar('proposed_by', { length: 80 }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByOwnerId: uuid('reviewed_by_owner_id').references(() => owners.id, {
      onDelete: 'set null',
    }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('constitution_proposals_owner_state_index').on(table.ownerId, table.state),
    index('constitution_proposals_item_index').on(table.constitutionItemId),
  ],
);

export const memoryCandidates = jarvis.table(
  'memory_candidates',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    kind: varchar('kind', { length: 80 }).notNull(),
    normalizedStatement: text('normalized_statement').notNull(),
    authority: varchar('authority', { length: 80 }).notNull(),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    sourceMessageId: uuid('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    confidenceBasisPoints: integer('confidence_basis_points').notNull(),
    sensitivity: varchar('sensitivity', { length: 32 }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    reviewAt: timestamp('review_at', { withTimezone: true }),
    relatedEntityIds: jsonb('related_entity_ids')
      .$type<readonly string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    requiresOwnerConfirmation: boolean('requires_owner_confirmation').notNull().default(true),
    state: varchar('state', { length: 80 }).notNull().default('pending_review'),
    acceptedMemoryRecordId: uuid('accepted_memory_record_id').references(() => memoryRecords.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByOwnerId: uuid('reviewed_by_owner_id').references(() => owners.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('memory_candidates_owner_state_review_index').on(
      table.ownerId,
      table.state,
      table.reviewAt,
    ),
    index('memory_candidates_owner_kind_index').on(table.ownerId, table.kind),
  ],
);

export const memoryEvidence = jarvis.table(
  'memory_evidence',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    memoryCandidateId: uuid('memory_candidate_id').references(() => memoryCandidates.id, {
      onDelete: 'cascade',
    }),
    memoryRecordId: uuid('memory_record_id').references(() => memoryRecords.id, {
      onDelete: 'cascade',
    }),
    evidenceRecordId: uuid('evidence_record_id').notNull(),
    evidenceType: varchar('evidence_type', { length: 80 }).notNull(),
    authority: varchar('authority', { length: 80 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    confidenceDeltaBasisPoints: integer('confidence_delta_basis_points').notNull().default(0),
  },
  (table) => [
    index('memory_evidence_candidate_index').on(table.memoryCandidateId),
    index('memory_evidence_record_index').on(table.memoryRecordId),
  ],
);

export const memoryLinks = jarvis.table(
  'memory_links',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    fromMemoryRecordId: uuid('from_memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'cascade' }),
    toMemoryRecordId: uuid('to_memory_record_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'cascade' }),
    linkType: varchar('link_type', { length: 80 }).notNull(),
    source: varchar('source', { length: 160 }).notNull(),
  },
  (table) => [
    uniqueIndex('memory_links_unique').on(
      table.fromMemoryRecordId,
      table.toMemoryRecordId,
      table.linkType,
    ),
    index('memory_links_owner_from_index').on(table.ownerId, table.fromMemoryRecordId),
  ],
);

export const hardOverrides = jarvis.table(
  'hard_overrides',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    statement: text('statement').notNull(),
    scope: varchar('scope', { length: 160 }).notNull(),
    temporary: boolean('temporary').notNull().default(false),
    reason: varchar('reason', { length: 1_000 }),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
    sourceMessageId: uuid('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    activeFrom: timestamp('active_from', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    consequenceExplainedAt: timestamp('consequence_explained_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('hard_overrides_owner_active_index').on(table.ownerId, table.expiresAt, table.revokedAt),
  ],
);

export const hardOverrideEntityLinks = jarvis.table(
  'hard_override_entity_links',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    hardOverrideId: uuid('hard_override_id')
      .notNull()
      .references(() => hardOverrides.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: uuid('entity_id').notNull(),
  },
  (table) => [
    uniqueIndex('hard_override_entity_links_unique').on(
      table.hardOverrideId,
      table.entityType,
      table.entityId,
    ),
  ],
);

export const quietModePeriods = jarvis.table(
  'quiet_mode_periods',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    reviewAt: timestamp('review_at', { withTimezone: true }),
    reason: varchar('reason', { length: 500 }),
    active: boolean('active').notNull().default(true),
    source: varchar('source', { length: 160 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('quiet_mode_periods_owner_active_index').on(table.ownerId, table.active, table.endsAt),
  ],
);

export const proactiveMessageBudgetUsage = jarvis.table(
  'proactive_message_budget_usage',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    localDate: date('local_date').notNull(),
    normalMessageCount: integer('normal_message_count').notNull().default(0),
    criticalMessageCount: integer('critical_message_count').notNull().default(0),
    groupedMessageCount: integer('grouped_message_count').notNull().default(0),
  },
  (table) => [
    uniqueIndex('proactive_message_budget_owner_date_unique').on(table.ownerId, table.localDate),
  ],
);

export const commitmentFollowUpHistory = jarvis.table(
  'commitment_follow_up_history',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    commitmentId: uuid('commitment_id')
      .notNull()
      .references(() => commitments.id, { onDelete: 'cascade' }),
    state: varchar('state', { length: 80 }).notNull(),
    reason: varchar('reason', { length: 1_000 }).notNull(),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    source: varchar('source', { length: 160 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('commitment_follow_up_owner_commitment_index').on(table.ownerId, table.commitmentId),
  ],
);

export const planProposals = jarvis.table(
  'plan_proposals',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    dayPlanId: uuid('day_plan_id')
      .notNull()
      .references(() => dayPlans.id, { onDelete: 'restrict' }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    trigger: varchar('trigger', { length: 80 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('proposed'),
    proposal: jsonb('proposal').$type<Record<string, unknown>>().notNull(),
    validationErrors: jsonb('validation_errors').$type<readonly string[]>().notNull(),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('plan_proposals_owner_plan_state_index').on(table.ownerId, table.dayPlanId, table.state),
  ],
);

export const reminderProposals = jarvis.table(
  'reminder_proposals',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    reminderId: uuid('reminder_id').references(() => reminders.id, { onDelete: 'set null' }),
    commitmentId: uuid('commitment_id').references(() => commitments.id, { onDelete: 'set null' }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    kind: varchar('kind', { length: 80 }).notNull(),
    critical: boolean('critical').notNull().default(false),
    state: varchar('state', { length: 80 }).notNull().default('proposed'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    rationale: varchar('rationale', { length: 1_000 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('reminder_proposals_owner_state_scheduled_index').on(
      table.ownerId,
      table.state,
      table.scheduledFor,
    ),
  ],
);

export const interventionDefinitions = jarvis.table(
  'intervention_definitions',
  {
    ...standardColumns,
    id: varchar('id', { length: 160 }).primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    version: varchar('version', { length: 64 }).notNull(),
    purpose: text('purpose').notNull(),
    triggerConditions: jsonb('trigger_conditions').$type<readonly string[]>().notNull(),
    contraindications: jsonb('contraindications').$type<readonly string[]>().notNull(),
    requiredContext: jsonb('required_context').$type<readonly string[]>().notNull(),
    example: text('example').notNull(),
    cooldownMinutes: integer('cooldown_minutes').notNull(),
    successSignal: varchar('success_signal', { length: 1_000 }).notNull(),
    failureSignal: varchar('failure_signal', { length: 1_000 }).notNull(),
    cost: varchar('cost', { length: 1_000 }).notNull(),
    applicableDomains: jsonb('applicable_domains').$type<readonly string[]>().notNull(),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('intervention_definitions_name_version_unique').on(table.name, table.version),
  ],
);

export const interventionRuns = jarvis.table(
  'intervention_runs',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    interventionDefinitionId: varchar('intervention_definition_id', { length: 160 })
      .notNull()
      .references(() => interventionDefinitions.id, { onDelete: 'restrict' }),
    commitmentId: uuid('commitment_id').references(() => commitments.id, { onDelete: 'set null' }),
    sourceBrainDecisionId: uuid('source_brain_decision_id').references(() => brainDecisions.id, {
      onDelete: 'set null',
    }),
    contextKey: varchar('context_key', { length: 512 }).notNull(),
    contextSummary: varchar('context_summary', { length: 1_000 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('proposed'),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    index('intervention_runs_owner_definition_created_index').on(
      table.ownerId,
      table.interventionDefinitionId,
      table.createdAt,
    ),
  ],
);

export const interventionOutcomes = jarvis.table(
  'intervention_outcomes',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    interventionRunId: uuid('intervention_run_id')
      .notNull()
      .references(() => interventionRuns.id, { onDelete: 'cascade' }),
    outcome: varchar('outcome', { length: 80 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    contextKey: varchar('context_key', { length: 512 }).notNull(),
    note: varchar('note', { length: 1_000 }),
  },
  (table) => [
    index('intervention_outcomes_owner_context_index').on(table.ownerId, table.contextKey),
  ],
);

export const onboardingQuestionnaires = jarvis.table(
  'onboarding_questionnaires',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    version: varchar('version', { length: 64 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('draft'),
    source: varchar('source', { length: 160 }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => [index('onboarding_questionnaires_owner_state_index').on(table.ownerId, table.state)],
);

export const onboardingAnswers = jarvis.table(
  'onboarding_answers',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    questionnaireId: uuid('questionnaire_id')
      .notNull()
      .references(() => onboardingQuestionnaires.id, { onDelete: 'cascade' }),
    questionId: varchar('question_id', { length: 160 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('draft'),
    value: text('value'),
    source: varchar('source', { length: 80 }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('onboarding_answers_questionnaire_question_unique').on(
      table.questionnaireId,
      table.questionId,
    ),
  ],
);

export const sourceConflicts = jarvis.table(
  'source_conflicts',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    subjectType: varchar('subject_type', { length: 80 }).notNull(),
    subjectReference: varchar('subject_reference', { length: 512 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('open'),
    summary: varchar('summary', { length: 1_000 }).notNull(),
    resolution: varchar('resolution', { length: 1_000 }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [index('source_conflicts_owner_state_index').on(table.ownerId, table.state)],
);

export const clarificationRequests = jarvis.table(
  'clarification_requests',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    brainRequestId: uuid('brain_request_id').references(() => brainRequests.id, {
      onDelete: 'set null',
    }),
    sourceConflictId: uuid('source_conflict_id').references(() => sourceConflicts.id, {
      onDelete: 'set null',
    }),
    question: varchar('question', { length: 500 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    state: varchar('state', { length: 80 }).notNull().default('open'),
    askedAt: timestamp('asked_at', { withTimezone: true }).notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [index('clarification_requests_owner_state_index').on(table.ownerId, table.state)],
);
