import { sql } from 'drizzle-orm';
import { check, pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { boolean, text } from 'drizzle-orm/pg-core';

export const jarvis = pgSchema('jarvis');

export const channelEnum = jarvis.enum('channel', [
  'web',
  'whatsapp',
  'telegram',
  'ios',
  'poke',
  'system',
  'internal',
]);

export const eventSourceEnum = jarvis.enum('event_source', [
  'web',
  'whatsapp',
  'telegram',
  'ios',
  'poke',
  'system',
  'internal',
  'gmail',
  'google_calendar',
  'plaid',
  'whoop',
  'iron_and_intervals',
  'food_logging',
  'healthkit',
  'hermes',
]);

export const eventProcessingStatusEnum = jarvis.enum('event_processing_status', [
  'received',
  'queued',
  'processing',
  'processed',
  'failed',
  'ignored',
]);

export const commitmentStatusEnum = jarvis.enum('commitment_status', [
  'open',
  'in_progress',
  'completed',
  'cancelled',
  'overdue',
  'deferred',
]);

export const flexibilityEnum = jarvis.enum('flexibility', ['fixed', 'flexible', 'negotiable']);

export const reminderStateEnum = jarvis.enum('reminder_state', [
  'active',
  'completed',
  'cancelled',
  'snoozed',
]);

export const reminderTriggerKindEnum = jarvis.enum('reminder_trigger_kind', [
  'fixed_time',
  'relative_time',
  'contextual',
  'conditional',
  'persistent',
  'preparation',
]);

export const planBlockKindEnum = jarvis.enum('plan_block_kind', ['fixed', 'flexible']);

export const planBlockCompletionStateEnum = jarvis.enum('plan_block_completion_state', [
  'planned',
  'in_progress',
  'completed',
  'skipped',
  'moved',
  'cancelled',
]);

export const actionRiskClassEnum = jarvis.enum('action_risk_class', [
  'READ',
  'LOW_RISK_INTERNAL',
  'CONTROLLED_WRITE',
  'HIGH_IMPACT',
]);

export const proposedActionStateEnum = jarvis.enum('proposed_action_state', [
  'proposed',
  'policy_allowed',
  'awaiting_approval',
  'approved',
  'rejected',
  'executed',
  'failed',
  'cancelled',
  'expired',
  'denied',
]);

export const approvalStateEnum = jarvis.enum('approval_state', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'consumed',
]);

export const durableJobStatusEnum = jarvis.enum('durable_job_status', [
  'queued',
  'leased',
  'retry_wait',
  'completed',
  'terminal_failed',
  'cancelled',
]);

export const jobErrorCategoryEnum = jarvis.enum('job_error_category', [
  'transient_database',
  'transient_network',
  'timeout',
  'rate_limited',
  'concurrency_conflict',
  'validation',
  'unauthorized',
  'policy_denied',
  'unsupported_schema',
  'invariant_violation',
  'cancelled',
  'expired',
  'unknown',
]);

export const actorTypeEnum = jarvis.enum('audit_actor_type', [
  'owner',
  'system',
  'service',
  'connector',
  'worker',
]);

export const sensitivityEnum = jarvis.enum('sensitivity', ['normal', 'sensitive', 'restricted']);

export const messagingConnectionStateEnum = jarvis.enum('messaging_connection_state', [
  'disabled',
  'unconfigured',
  'connecting',
  'qr_required',
  'connected',
  'degraded',
  'reconnecting',
  'disconnected',
  'logged_out',
  'blocked',
  'incompatible_dependency',
  'license_required',
  'unknown',
]);

export const outboundDeliveryStateEnum = jarvis.enum('outbound_delivery_state', [
  'pending',
  'leased',
  'sent',
  'delivered',
  'read',
  'failed_retryable',
  'failed_terminal',
]);

export const memoryKindEnum = jarvis.enum('memory_kind', [
  'fact',
  'preference',
  'person',
  'relationship',
  'project',
  'observation',
  'hypothesis',
  'open_loop',
  'personality_trait',
]);

export const defaultJsonObject = sql`'{}'::jsonb`;

export const standardColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const appendOnlyColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
};

/** Reusable application-side shape for generated SQL constraints. */
export const booleanIsTrue = (column: ReturnType<typeof boolean>) => sql`${column} = true`;

export const nonEmptyTextCheck = (name: string, column: ReturnType<typeof text>) =>
  check(name, sql`length(trim(${column})) > 0`);
