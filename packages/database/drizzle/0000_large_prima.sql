CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE SCHEMA "jarvis";
--> statement-breakpoint
CREATE TYPE "jarvis"."action_risk_class" AS ENUM('READ', 'LOW_RISK_INTERNAL', 'CONTROLLED_WRITE', 'HIGH_IMPACT');--> statement-breakpoint
CREATE TYPE "jarvis"."audit_actor_type" AS ENUM('owner', 'system', 'service', 'connector', 'worker');--> statement-breakpoint
CREATE TYPE "jarvis"."approval_state" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'expired', 'consumed');--> statement-breakpoint
CREATE TYPE "jarvis"."channel" AS ENUM('web', 'whatsapp', 'telegram', 'ios', 'poke', 'system', 'internal');--> statement-breakpoint
CREATE TYPE "jarvis"."commitment_status" AS ENUM('open', 'in_progress', 'completed', 'cancelled', 'overdue', 'deferred');--> statement-breakpoint
CREATE TYPE "jarvis"."durable_job_status" AS ENUM('queued', 'leased', 'retry_wait', 'completed', 'terminal_failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "jarvis"."event_processing_status" AS ENUM('received', 'queued', 'processing', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "jarvis"."flexibility" AS ENUM('fixed', 'flexible', 'negotiable');--> statement-breakpoint
CREATE TYPE "jarvis"."job_error_category" AS ENUM('transient_database', 'transient_network', 'timeout', 'rate_limited', 'concurrency_conflict', 'validation', 'unauthorized', 'policy_denied', 'unsupported_schema', 'invariant_violation', 'cancelled', 'expired', 'unknown');--> statement-breakpoint
CREATE TYPE "jarvis"."memory_kind" AS ENUM('fact', 'preference', 'person', 'relationship', 'project', 'observation', 'hypothesis', 'open_loop', 'personality_trait');--> statement-breakpoint
CREATE TYPE "jarvis"."plan_block_completion_state" AS ENUM('planned', 'in_progress', 'completed', 'skipped', 'moved', 'cancelled');--> statement-breakpoint
CREATE TYPE "jarvis"."plan_block_kind" AS ENUM('fixed', 'flexible');--> statement-breakpoint
CREATE TYPE "jarvis"."proposed_action_state" AS ENUM('proposed', 'policy_allowed', 'awaiting_approval', 'approved', 'rejected', 'executed', 'failed', 'cancelled', 'expired', 'denied');--> statement-breakpoint
CREATE TYPE "jarvis"."reminder_state" AS ENUM('active', 'completed', 'cancelled', 'snoozed');--> statement-breakpoint
CREATE TYPE "jarvis"."reminder_trigger_kind" AS ENUM('fixed_time', 'relative_time', 'contextual', 'conditional', 'persistent', 'preparation');--> statement-breakpoint
CREATE TYPE "jarvis"."sensitivity" AS ENUM('normal', 'sensitive', 'restricted');--> statement-breakpoint
CREATE TABLE "jarvis"."action_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"proposed_action_id" uuid NOT NULL,
	"approval_request_id" uuid,
	"execution_attempt" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) NOT NULL,
	"idempotency_key" varchar(256) NOT NULL,
	"external_reference_id" varchar(512),
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_category" "jarvis"."job_error_category",
	"error_summary" varchar(1000),
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."action_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"action_execution_id" uuid NOT NULL,
	"status" varchar(32) NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_reference_id" varchar(512),
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"proposed_action_id" uuid NOT NULL,
	"action_snapshot_hash" varchar(128) NOT NULL,
	"risk_class" "jarvis"."action_risk_class" NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"state" "jarvis"."approval_state" DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"actor_id" uuid,
	"result" jsonb,
	"source_decision_id" uuid,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"actor_type" "jarvis"."audit_actor_type" NOT NULL,
	"actor_id" uuid,
	"action" varchar(160) NOT NULL,
	"target_type" varchar(160) NOT NULL,
	"target_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"previous_state_reference" jsonb,
	"resulting_state_reference" jsonb,
	"reason" varchar(1000),
	"source" varchar(160) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."deterministic_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"source_event_id" uuid,
	"decision_type" varchar(160) NOT NULL,
	"decision_version" varchar(64) NOT NULL,
	"input_hash" varchar(128) NOT NULL,
	"output" jsonb NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."job_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"worker_id" varchar(160) NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"leased_at" timestamp with time zone NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_category" "jarvis"."job_error_category",
	"error_summary" varchar(1000),
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"job_type" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "jarvis"."durable_job_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"available_after" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"maximum_attempts" integer DEFAULT 5 NOT NULL,
	"lease_owner" varchar(160),
	"lease_expires_at" timestamp with time zone,
	"last_error_category" "jarvis"."job_error_category",
	"last_error_summary" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"source_event_id" uuid,
	"proposed_action_id" uuid,
	"idempotency_key" varchar(256) NOT NULL,
	CONSTRAINT "jobs_priority_range" CHECK ("jarvis"."jobs"."priority" between -100 and 100),
	CONSTRAINT "jobs_attempt_count_range" CHECK ("jarvis"."jobs"."attempt_count" >= 0 and "jarvis"."jobs"."attempt_count" <= "jarvis"."jobs"."maximum_attempts"),
	CONSTRAINT "jobs_maximum_attempts_range" CHECK ("jarvis"."jobs"."maximum_attempts" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "jarvis"."policy_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"proposed_action_id" uuid NOT NULL,
	"allowed" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"denied" boolean DEFAULT false NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"matched_rules" jsonb NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."policy_rule_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"rule_id" varchar(160) NOT NULL,
	"action_type" varchar(160) NOT NULL,
	"effect" varchar(80) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" varchar(160) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."proposed_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"action_type" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"risk_class" "jarvis"."action_risk_class" NOT NULL,
	"idempotency_key" varchar(256) NOT NULL,
	"source_event_id" uuid,
	"source_decision_id" uuid,
	"state" "jarvis"."proposed_action_state" DEFAULT 'proposed' NOT NULL,
	"expires_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "jarvis"."commitment_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"commitment_id" uuid NOT NULL,
	"deadline_kind" varchar(80) NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"timezone" varchar(80) NOT NULL,
	"is_hard" boolean DEFAULT false NOT NULL,
	"source" varchar(160) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."commitment_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"commitment_id" uuid NOT NULL,
	"depends_on_commitment_id" uuid NOT NULL,
	"dependency_kind" varchar(80) DEFAULT 'finish_before' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."commitment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"commitment_id" uuid NOT NULL,
	"previous_status" "jarvis"."commitment_status",
	"next_status" "jarvis"."commitment_status" NOT NULL,
	"actor_type" varchar(80) NOT NULL,
	"actor_id" uuid,
	"reason" varchar(1000),
	"evidence_reference" varchar(1024),
	"source" varchar(160) NOT NULL,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "jarvis"."commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"status" "jarvis"."commitment_status" DEFAULT 'open' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"consequence" text,
	"flexibility" "jarvis"."flexibility" DEFAULT 'flexible' NOT NULL,
	"source" varchar(160) NOT NULL,
	"source_event_id" uuid,
	"completion_evidence_reference" varchar(1024),
	"minimum_acceptable_version" text,
	"follow_up_state" varchar(80) DEFAULT 'required' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."day_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"timezone" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"source" varchar(160) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."plan_block_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"plan_block_id" uuid NOT NULL,
	"depends_on_plan_block_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."plan_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"day_plan_id" uuid NOT NULL,
	"commitment_id" uuid,
	"block_kind" "jarvis"."plan_block_kind" NOT NULL,
	"completion_state" "jarvis"."plan_block_completion_state" DEFAULT 'planned' NOT NULL,
	"title" varchar(512) NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"estimated_duration_minutes" integer NOT NULL,
	"minimum_duration_minutes" integer,
	"source" varchar(160) NOT NULL,
	"moved_from_block_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."reminder_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"reminder_id" uuid NOT NULL,
	"trigger_id" uuid,
	"job_id" uuid,
	"attempted_at" timestamp with time zone NOT NULL,
	"outcome" varchar(80) NOT NULL,
	"escalation_level" integer NOT NULL,
	"next_eligible_delivery_at" timestamp with time zone,
	"delivery_reference" varchar(512),
	"error_category" varchar(80),
	"error_summary" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "jarvis"."reminder_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"reminder_id" uuid NOT NULL,
	"trigger_kind" "jarvis"."reminder_trigger_kind" NOT NULL,
	"configuration" jsonb NOT NULL,
	"next_scheduled_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"commitment_id" uuid,
	"title" varchar(512) NOT NULL,
	"state" "jarvis"."reminder_state" DEFAULT 'active' NOT NULL,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"next_eligible_delivery_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"source" varchar(160) NOT NULL,
	"source_commitment_id" uuid,
	"job_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."replanning_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"day_plan_id" uuid NOT NULL,
	"previous_revision" integer NOT NULL,
	"resulting_revision" integer NOT NULL,
	"trigger" varchar(160) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"correlation_id" uuid NOT NULL,
	"source" varchar(160) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."constitution_item_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"constitution_item_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"principle" text NOT NULL,
	"priority" integer NOT NULL,
	"flexibility" "jarvis"."flexibility" NOT NULL,
	"source" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"review_date" date,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change_reason" varchar(1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."constitution_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"category" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"review_date" date
);
--> statement-breakpoint
CREATE TABLE "jarvis"."facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"subject" varchar(512) NOT NULL,
	"predicate" varchar(512) NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."hypotheses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"hypothesis" text NOT NULL,
	"status" varchar(80) DEFAULT 'open' NOT NULL,
	"evidence_summary" text
);
--> statement-breakpoint
CREATE TABLE "jarvis"."memory_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "jarvis"."memory_kind" NOT NULL,
	"source" varchar(160) NOT NULL,
	"source_event_id" uuid,
	"confidence_basis_points" integer NOT NULL,
	"sensitivity" "jarvis"."sensitivity" DEFAULT 'sensitive' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"review_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"observation" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."open_loops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"description" text NOT NULL,
	"state" varchar(80) DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"display_name" varchar(512) NOT NULL,
	"external_reference" varchar(512),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."personality_traits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"trait" varchar(160) NOT NULL,
	"value" varchar(512) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"topic" varchar(512) NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"name" varchar(512) NOT NULL,
	"status" varchar(80) DEFAULT 'active' NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "jarvis"."relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_record_id" uuid NOT NULL,
	"from_person_id" uuid,
	"to_person_id" uuid,
	"relationship_type" varchar(160) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "jarvis"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"channel" "jarvis"."channel" NOT NULL,
	"external_conversation_id" varchar(512),
	"state" varchar(32) DEFAULT 'active' NOT NULL,
	"title" varchar(256),
	"last_message_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."event_processing_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"job_id" uuid,
	"attempt_number" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"error_category" varchar(80),
	"error_summary" varchar(1000),
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"source" "jarvis"."channel" NOT NULL,
	"source_event_id" varchar(512),
	"idempotency_key" varchar(256) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"schema_version" integer NOT NULL,
	"processing_status" "jarvis"."event_processing_status" DEFAULT 'received' NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_summary" varchar(1000),
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"sensitivity" "jarvis"."sensitivity" DEFAULT 'sensitive' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"object_reference" varchar(1024) NOT NULL,
	"media_type" varchar(160) NOT NULL,
	"byte_length" integer NOT NULL,
	"content_hash" varchar(128),
	"retention_state" varchar(32) DEFAULT 'unconfigured' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."message_source_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"source_type" varchar(160) NOT NULL,
	"source_reference" varchar(512) NOT NULL,
	"source_event_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel" "jarvis"."channel" NOT NULL,
	"direction" varchar(32) NOT NULL,
	"external_message_id" varchar(512),
	"sender_reference" varchar(512),
	"reply_to_message_id" uuid,
	"content_type" varchar(80) DEFAULT 'text/plain' NOT NULL,
	"content" text,
	"delivery_state" varchar(32) DEFAULT 'received' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"source_event_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"device_id" uuid,
	"token_digest" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reauthenticated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."connector_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"connector_type" varchar(120) NOT NULL,
	"external_account_reference" varchar(512) NOT NULL,
	"display_label" varchar(160),
	"status" varchar(32) DEFAULT 'unconfigured' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"device_label" varchar(160) NOT NULL,
	"platform" varchar(80) NOT NULL,
	"public_key_fingerprint" varchar(256),
	"trusted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."encrypted_connector_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"connector_account_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"algorithm" varchar(120) NOT NULL,
	"key_version" varchar(64) NOT NULL,
	"nonce" varchar(512) NOT NULL,
	"expires_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"identity_provider" varchar(80) NOT NULL,
	"provider_subject" varchar(512) NOT NULL,
	"verified_at" timestamp with time zone,
	"is_allowed" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email_normalized" varchar(320) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"timezone" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."passkey_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"device_id" uuid,
	"credential_id" varchar(1024) NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."trusted_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_identifier" varchar(160) NOT NULL,
	"token_digest" varchar(128) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_version" varchar(64) NOT NULL,
	"last_used_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "jarvis"."action_executions" ADD CONSTRAINT "action_executions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."action_executions" ADD CONSTRAINT "action_executions_proposed_action_id_proposed_actions_id_fk" FOREIGN KEY ("proposed_action_id") REFERENCES "jarvis"."proposed_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."action_executions" ADD CONSTRAINT "action_executions_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "jarvis"."approval_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."action_results" ADD CONSTRAINT "action_results_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."action_results" ADD CONSTRAINT "action_results_action_execution_id_action_executions_id_fk" FOREIGN KEY ("action_execution_id") REFERENCES "jarvis"."action_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."approval_requests" ADD CONSTRAINT "approval_requests_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."approval_requests" ADD CONSTRAINT "approval_requests_proposed_action_id_proposed_actions_id_fk" FOREIGN KEY ("proposed_action_id") REFERENCES "jarvis"."proposed_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."approval_requests" ADD CONSTRAINT "approval_requests_source_decision_id_deterministic_decisions_id_fk" FOREIGN KEY ("source_decision_id") REFERENCES "jarvis"."deterministic_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."audit_events" ADD CONSTRAINT "audit_events_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."deterministic_decisions" ADD CONSTRAINT "deterministic_decisions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."deterministic_decisions" ADD CONSTRAINT "deterministic_decisions_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."job_executions" ADD CONSTRAINT "job_executions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."job_executions" ADD CONSTRAINT "job_executions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "jarvis"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD CONSTRAINT "jobs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD CONSTRAINT "jobs_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD CONSTRAINT "jobs_proposed_action_id_proposed_actions_id_fk" FOREIGN KEY ("proposed_action_id") REFERENCES "jarvis"."proposed_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."policy_evaluations" ADD CONSTRAINT "policy_evaluations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."policy_evaluations" ADD CONSTRAINT "policy_evaluations_proposed_action_id_proposed_actions_id_fk" FOREIGN KEY ("proposed_action_id") REFERENCES "jarvis"."proposed_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."policy_rule_overrides" ADD CONSTRAINT "policy_rule_overrides_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."proposed_actions" ADD CONSTRAINT "proposed_actions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."proposed_actions" ADD CONSTRAINT "proposed_actions_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."proposed_actions" ADD CONSTRAINT "proposed_actions_source_decision_id_deterministic_decisions_id_fk" FOREIGN KEY ("source_decision_id") REFERENCES "jarvis"."deterministic_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_deadlines" ADD CONSTRAINT "commitment_deadlines_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_deadlines" ADD CONSTRAINT "commitment_deadlines_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_dependencies" ADD CONSTRAINT "commitment_dependencies_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_dependencies" ADD CONSTRAINT "commitment_dependencies_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_dependencies" ADD CONSTRAINT "commitment_dependencies_depends_on_commitment_id_commitments_id_fk" FOREIGN KEY ("depends_on_commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_status_history" ADD CONSTRAINT "commitment_status_history_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_status_history" ADD CONSTRAINT "commitment_status_history_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitments" ADD CONSTRAINT "commitments_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."day_plans" ADD CONSTRAINT "day_plans_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_block_dependencies" ADD CONSTRAINT "plan_block_dependencies_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_block_dependencies" ADD CONSTRAINT "plan_block_dependencies_plan_block_id_plan_blocks_id_fk" FOREIGN KEY ("plan_block_id") REFERENCES "jarvis"."plan_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_block_dependencies" ADD CONSTRAINT "plan_block_dependencies_depends_on_plan_block_id_plan_blocks_id_fk" FOREIGN KEY ("depends_on_plan_block_id") REFERENCES "jarvis"."plan_blocks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD CONSTRAINT "plan_blocks_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD CONSTRAINT "plan_blocks_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "jarvis"."day_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD CONSTRAINT "plan_blocks_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_attempts" ADD CONSTRAINT "reminder_attempts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_attempts" ADD CONSTRAINT "reminder_attempts_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "jarvis"."reminders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_attempts" ADD CONSTRAINT "reminder_attempts_trigger_id_reminder_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "jarvis"."reminder_triggers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_triggers" ADD CONSTRAINT "reminder_triggers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_triggers" ADD CONSTRAINT "reminder_triggers_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "jarvis"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminders" ADD CONSTRAINT "reminders_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminders" ADD CONSTRAINT "reminders_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminders" ADD CONSTRAINT "reminders_source_commitment_id_commitments_id_fk" FOREIGN KEY ("source_commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."replanning_history" ADD CONSTRAINT "replanning_history_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."replanning_history" ADD CONSTRAINT "replanning_history_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "jarvis"."day_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_item_versions" ADD CONSTRAINT "constitution_item_versions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_item_versions" ADD CONSTRAINT "constitution_item_versions_constitution_item_id_constitution_items_id_fk" FOREIGN KEY ("constitution_item_id") REFERENCES "jarvis"."constitution_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_items" ADD CONSTRAINT "constitution_items_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."facts" ADD CONSTRAINT "facts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."facts" ADD CONSTRAINT "facts_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hypotheses" ADD CONSTRAINT "hypotheses_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hypotheses" ADD CONSTRAINT "hypotheses_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD CONSTRAINT "memory_records_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."observations" ADD CONSTRAINT "observations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."observations" ADD CONSTRAINT "observations_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD CONSTRAINT "open_loops_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD CONSTRAINT "open_loops_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."people" ADD CONSTRAINT "people_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."people" ADD CONSTRAINT "people_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD CONSTRAINT "personality_traits_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD CONSTRAINT "personality_traits_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."preferences" ADD CONSTRAINT "preferences_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."preferences" ADD CONSTRAINT "preferences_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."projects" ADD CONSTRAINT "projects_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."projects" ADD CONSTRAINT "projects_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."relationships" ADD CONSTRAINT "relationships_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."relationships" ADD CONSTRAINT "relationships_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."relationships" ADD CONSTRAINT "relationships_from_person_id_people_id_fk" FOREIGN KEY ("from_person_id") REFERENCES "jarvis"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."relationships" ADD CONSTRAINT "relationships_to_person_id_people_id_fk" FOREIGN KEY ("to_person_id") REFERENCES "jarvis"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."conversations" ADD CONSTRAINT "conversations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."event_processing_attempts" ADD CONSTRAINT "event_processing_attempts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."event_processing_attempts" ADD CONSTRAINT "event_processing_attempts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "jarvis"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."events" ADD CONSTRAINT "events_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."message_attachments" ADD CONSTRAINT "message_attachments_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "jarvis"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."message_source_links" ADD CONSTRAINT "message_source_links_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."message_source_links" ADD CONSTRAINT "message_source_links_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "jarvis"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messages" ADD CONSTRAINT "messages_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "jarvis"."conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."auth_sessions" ADD CONSTRAINT "auth_sessions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."auth_sessions" ADD CONSTRAINT "auth_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "jarvis"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."connector_accounts" ADD CONSTRAINT "connector_accounts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."devices" ADD CONSTRAINT "devices_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."encrypted_connector_secrets" ADD CONSTRAINT "encrypted_connector_secrets_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."encrypted_connector_secrets" ADD CONSTRAINT "encrypted_connector_secrets_connector_account_id_connector_accounts_id_fk" FOREIGN KEY ("connector_account_id") REFERENCES "jarvis"."connector_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."identities" ADD CONSTRAINT "identities_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."passkey_credentials" ADD CONSTRAINT "passkey_credentials_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."passkey_credentials" ADD CONSTRAINT "passkey_credentials_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "jarvis"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."trusted_clients" ADD CONSTRAINT "trusted_clients_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_executions_action_attempt_unique" ON "jarvis"."action_executions" USING btree ("proposed_action_id","execution_attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "action_executions_owner_idempotency_unique" ON "jarvis"."action_executions" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "action_results_execution_unique" ON "jarvis"."action_results" USING btree ("action_execution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_live_action_unique" ON "jarvis"."approval_requests" USING btree ("proposed_action_id") WHERE "jarvis"."approval_requests"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "approval_requests_owner_state_expires_index" ON "jarvis"."approval_requests" USING btree ("owner_id","state","expires_at");--> statement-breakpoint
CREATE INDEX "audit_events_owner_occurred_index" ON "jarvis"."audit_events" USING btree ("owner_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_correlation_occurred_index" ON "jarvis"."audit_events" USING btree ("correlation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_target_index" ON "jarvis"."audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "deterministic_decisions_owner_event_index" ON "jarvis"."deterministic_decisions" USING btree ("owner_id","source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_executions_job_attempt_unique" ON "jarvis"."job_executions" USING btree ("job_id","attempt_number");--> statement-breakpoint
CREATE INDEX "job_executions_worker_active_index" ON "jarvis"."job_executions" USING btree ("worker_id","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_owner_type_idempotency_unique" ON "jarvis"."jobs" USING btree ("owner_id","job_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_claim_projection_index" ON "jarvis"."jobs" USING btree ("status","available_after","priority","created_at");--> statement-breakpoint
CREATE INDEX "jobs_owner_type_status_index" ON "jarvis"."jobs" USING btree ("owner_id","job_type","status");--> statement-breakpoint
CREATE INDEX "policy_evaluations_action_index" ON "jarvis"."policy_evaluations" USING btree ("proposed_action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_rule_overrides_owner_rule_unique" ON "jarvis"."policy_rule_overrides" USING btree ("owner_id","rule_id");--> statement-breakpoint
CREATE INDEX "policy_rule_overrides_owner_action_index" ON "jarvis"."policy_rule_overrides" USING btree ("owner_id","action_type");--> statement-breakpoint
CREATE UNIQUE INDEX "proposed_actions_owner_idempotency_unique" ON "jarvis"."proposed_actions" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "proposed_actions_owner_state_index" ON "jarvis"."proposed_actions" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "proposed_actions_correlation_index" ON "jarvis"."proposed_actions" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "commitment_deadlines_owner_due_index" ON "jarvis"."commitment_deadlines" USING btree ("owner_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commitment_dependencies_unique" ON "jarvis"."commitment_dependencies" USING btree ("commitment_id","depends_on_commitment_id");--> statement-breakpoint
CREATE INDEX "commitment_status_history_commitment_index" ON "jarvis"."commitment_status_history" USING btree ("commitment_id");--> statement-breakpoint
CREATE INDEX "commitments_owner_status_index" ON "jarvis"."commitments" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "commitments_owner_follow_up_index" ON "jarvis"."commitments" USING btree ("owner_id","follow_up_state");--> statement-breakpoint
CREATE UNIQUE INDEX "day_plans_owner_date_active_unique" ON "jarvis"."day_plans" USING btree ("owner_id","local_date") WHERE "jarvis"."day_plans"."status" = 'active';--> statement-breakpoint
CREATE INDEX "day_plans_owner_date_index" ON "jarvis"."day_plans" USING btree ("owner_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_block_dependencies_unique" ON "jarvis"."plan_block_dependencies" USING btree ("plan_block_id","depends_on_plan_block_id");--> statement-breakpoint
CREATE INDEX "plan_blocks_plan_schedule_index" ON "jarvis"."plan_blocks" USING btree ("day_plan_id","start_at");--> statement-breakpoint
CREATE INDEX "reminder_attempts_reminder_attempted_index" ON "jarvis"."reminder_attempts" USING btree ("reminder_id","attempted_at");--> statement-breakpoint
CREATE INDEX "reminder_triggers_schedule_index" ON "jarvis"."reminder_triggers" USING btree ("active","next_scheduled_at");--> statement-breakpoint
CREATE INDEX "reminders_owner_active_due_index" ON "jarvis"."reminders" USING btree ("owner_id","state","next_eligible_delivery_at");--> statement-breakpoint
CREATE INDEX "reminders_commitment_index" ON "jarvis"."reminders" USING btree ("commitment_id");--> statement-breakpoint
CREATE INDEX "replanning_history_plan_revision_index" ON "jarvis"."replanning_history" USING btree ("day_plan_id","resulting_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "constitution_item_versions_unique" ON "jarvis"."constitution_item_versions" USING btree ("constitution_item_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "constitution_item_versions_current_unique" ON "jarvis"."constitution_item_versions" USING btree ("constitution_item_id") WHERE "jarvis"."constitution_item_versions"."is_current" = true;--> statement-breakpoint
CREATE INDEX "constitution_item_versions_owner_active_index" ON "jarvis"."constitution_item_versions" USING btree ("owner_id","active");--> statement-breakpoint
CREATE INDEX "constitution_items_owner_active_index" ON "jarvis"."constitution_items" USING btree ("owner_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "facts_memory_record_unique" ON "jarvis"."facts" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hypotheses_memory_record_unique" ON "jarvis"."hypotheses" USING btree ("memory_record_id");--> statement-breakpoint
CREATE INDEX "memory_records_owner_kind_active_index" ON "jarvis"."memory_records" USING btree ("owner_id","kind","active");--> statement-breakpoint
CREATE INDEX "memory_records_review_index" ON "jarvis"."memory_records" USING btree ("owner_id","review_at");--> statement-breakpoint
CREATE INDEX "memory_records_source_event_index" ON "jarvis"."memory_records" USING btree ("source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "observations_memory_record_unique" ON "jarvis"."observations" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "open_loops_memory_record_unique" ON "jarvis"."open_loops" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_memory_record_unique" ON "jarvis"."people" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personality_traits_memory_record_unique" ON "jarvis"."personality_traits" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preferences_memory_record_unique" ON "jarvis"."preferences" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_memory_record_unique" ON "jarvis"."projects" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_memory_record_unique" ON "jarvis"."relationships" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_owner_channel_external_unique" ON "jarvis"."conversations" USING btree ("owner_id","channel","external_conversation_id") WHERE "jarvis"."conversations"."external_conversation_id" is not null;--> statement-breakpoint
CREATE INDEX "conversations_owner_updated_index" ON "jarvis"."conversations" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_processing_attempts_event_attempt_unique" ON "jarvis"."event_processing_attempts" USING btree ("event_id","attempt_number");--> statement-breakpoint
CREATE INDEX "event_processing_attempts_owner_event_index" ON "jarvis"."event_processing_attempts" USING btree ("owner_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_owner_idempotency_unique" ON "jarvis"."events" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "events_owner_source_event_unique" ON "jarvis"."events" USING btree ("owner_id","source","event_type","source_event_id") WHERE "jarvis"."events"."source_event_id" is not null;--> statement-breakpoint
CREATE INDEX "events_processing_index" ON "jarvis"."events" USING btree ("processing_status","received_at");--> statement-breakpoint
CREATE INDEX "events_correlation_index" ON "jarvis"."events" USING btree ("correlation_id","received_at");--> statement-breakpoint
CREATE INDEX "message_attachments_message_index" ON "jarvis"."message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_source_links_unique" ON "jarvis"."message_source_links" USING btree ("message_id","source_type","source_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_owner_channel_external_unique" ON "jarvis"."messages" USING btree ("owner_id","channel","external_message_id") WHERE "jarvis"."messages"."external_message_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_conversation_occurred_index" ON "jarvis"."messages" USING btree ("conversation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "messages_owner_source_event_index" ON "jarvis"."messages" USING btree ("owner_id","source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_digest_unique" ON "jarvis"."auth_sessions" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "auth_sessions_owner_active_index" ON "jarvis"."auth_sessions" USING btree ("owner_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_accounts_owner_external_unique" ON "jarvis"."connector_accounts" USING btree ("owner_id","connector_type","external_account_reference");--> statement-breakpoint
CREATE INDEX "devices_owner_active_index" ON "jarvis"."devices" USING btree ("owner_id","revoked_at");--> statement-breakpoint
CREATE INDEX "encrypted_connector_secrets_owner_index" ON "jarvis"."encrypted_connector_secrets" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identities_provider_subject_unique" ON "jarvis"."identities" USING btree ("identity_provider","provider_subject");--> statement-breakpoint
CREATE INDEX "identities_owner_index" ON "jarvis"."identities" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_email_normalized_unique" ON "jarvis"."owners" USING btree ("email_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_single_primary_unique" ON "jarvis"."owners" USING btree ("is_primary") WHERE "jarvis"."owners"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentials_credential_id_unique" ON "jarvis"."passkey_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "passkey_credentials_owner_index" ON "jarvis"."passkey_credentials" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trusted_clients_identifier_unique" ON "jarvis"."trusted_clients" USING btree ("client_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "trusted_clients_token_digest_unique" ON "jarvis"."trusted_clients" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "trusted_clients_owner_active_index" ON "jarvis"."trusted_clients" USING btree ("owner_id","revoked_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "jarvis"."prevent_audit_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'jarvis.audit_events is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "jarvis"."audit_events"
FOR EACH ROW
EXECUTE FUNCTION "jarvis"."prevent_audit_mutation"();
