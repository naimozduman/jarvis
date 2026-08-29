CREATE TABLE "jarvis"."brain_decision_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"brain_decision_id" uuid NOT NULL,
	"record_type" varchar(80) NOT NULL,
	"record_id" uuid NOT NULL,
	"source" varchar(160) NOT NULL,
	"information_state" varchar(32) NOT NULL,
	"confidence_basis_points" integer NOT NULL,
	"sensitivity" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."brain_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"brain_request_id" uuid NOT NULL,
	"model_run_id" uuid,
	"decision_type" varchar(80) NOT NULL,
	"decision_summary" varchar(2000) NOT NULL,
	"material_tradeoffs" jsonb NOT NULL,
	"confidence_basis_points" integer NOT NULL,
	"missing_information" jsonb NOT NULL,
	"validation_state" varchar(80) NOT NULL,
	"prompt_version" varchar(256) NOT NULL,
	"context_version" varchar(64) NOT NULL,
	"execution_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."brain_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"conversation_id" uuid,
	"source_event_id" uuid,
	"message_id" uuid,
	"purpose" varchar(80) NOT NULL,
	"state" varchar(80) DEFAULT 'received' NOT NULL,
	"idempotency_key" varchar(256) NOT NULL,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"prompt_version" varchar(256),
	"context_version" varchar(64),
	"safe_error_category" varchar(80),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."clarification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"brain_request_id" uuid,
	"source_conflict_id" uuid,
	"question" varchar(500) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"state" varchar(80) DEFAULT 'open' NOT NULL,
	"asked_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."commitment_follow_up_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"commitment_id" uuid NOT NULL,
	"state" varchar(80) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"next_review_at" timestamp with time zone,
	"source" varchar(160) NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."constitution_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"constitution_item_id" uuid,
	"source_brain_decision_id" uuid,
	"category" varchar(160) NOT NULL,
	"principle" text NOT NULL,
	"priority" integer NOT NULL,
	"flexibility" varchar(32) NOT NULL,
	"minimum_acceptable_version" text,
	"consequence" text,
	"state" varchar(80) DEFAULT 'draft' NOT NULL,
	"proposed_by" varchar(80) NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_owner_id" uuid,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."context_manifest_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"context_manifest_id" uuid NOT NULL,
	"record_type" varchar(80) NOT NULL,
	"record_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score" integer NOT NULL,
	"selection_reasons" jsonb NOT NULL,
	"sensitivity" varchar(32) NOT NULL,
	"redacted_for_model" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."context_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"brain_request_id" uuid NOT NULL,
	"context_version" varchar(64) NOT NULL,
	"prompt_token_estimate" integer NOT NULL,
	"record_limit" integer NOT NULL,
	"excluded_record_count" integer DEFAULT 0 NOT NULL,
	"source_hash" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."hard_override_entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"hard_override_id" uuid NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."hard_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"scope" varchar(160) NOT NULL,
	"temporary" boolean DEFAULT false NOT NULL,
	"reason" varchar(1000),
	"source_event_id" uuid,
	"source_message_id" uuid,
	"active_from" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"consequence_explained_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."intervention_definitions" (
	"id" varchar(160) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(160) NOT NULL,
	"version" varchar(64) NOT NULL,
	"purpose" text NOT NULL,
	"trigger_conditions" jsonb NOT NULL,
	"contraindications" jsonb NOT NULL,
	"required_context" jsonb NOT NULL,
	"example" text NOT NULL,
	"cooldown_minutes" integer NOT NULL,
	"success_signal" varchar(1000) NOT NULL,
	"failure_signal" varchar(1000) NOT NULL,
	"cost" varchar(1000) NOT NULL,
	"applicable_domains" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."intervention_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"intervention_run_id" uuid NOT NULL,
	"outcome" varchar(80) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"context_key" varchar(512) NOT NULL,
	"note" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "jarvis"."intervention_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"intervention_definition_id" varchar(160) NOT NULL,
	"commitment_id" uuid,
	"source_brain_decision_id" uuid,
	"context_summary" varchar(1000) NOT NULL,
	"state" varchar(80) DEFAULT 'proposed' NOT NULL,
	"cooldown_until" timestamp with time zone,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."memory_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" varchar(80) NOT NULL,
	"normalized_statement" text NOT NULL,
	"authority" varchar(80) NOT NULL,
	"source_event_id" uuid,
	"source_message_id" uuid,
	"source_brain_decision_id" uuid,
	"confidence_basis_points" integer NOT NULL,
	"sensitivity" varchar(32) NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"review_at" timestamp with time zone,
	"related_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_owner_confirmation" boolean DEFAULT true NOT NULL,
	"state" varchar(80) DEFAULT 'pending_review' NOT NULL,
	"accepted_memory_record_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE "jarvis"."memory_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"memory_candidate_id" uuid,
	"memory_record_id" uuid,
	"evidence_record_id" uuid NOT NULL,
	"evidence_type" varchar(80) NOT NULL,
	"authority" varchar(80) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"confidence_delta_basis_points" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."memory_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"from_memory_record_id" uuid NOT NULL,
	"to_memory_record_id" uuid NOT NULL,
	"link_type" varchar(80) NOT NULL,
	"source" varchar(160) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."model_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"brain_request_id" uuid NOT NULL,
	"context_manifest_id" uuid,
	"provider" varchar(80) NOT NULL,
	"route" varchar(32) NOT NULL,
	"configured_model_id" varchar(160) NOT NULL,
	"actual_model_id" varchar(160),
	"reasoning_effort" varchar(32),
	"status" varchar(80) NOT NULL,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"reasoning_tokens" integer,
	"cached_input_tokens" integer,
	"estimated_cost_usd" numeric(14, 8),
	"error_category" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "jarvis"."onboarding_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"question_id" varchar(160) NOT NULL,
	"state" varchar(80) DEFAULT 'draft' NOT NULL,
	"value" text,
	"source" varchar(80) NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."onboarding_questionnaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" varchar(64) NOT NULL,
	"state" varchar(80) DEFAULT 'draft' NOT NULL,
	"source" varchar(160) NOT NULL,
	"reviewed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jarvis"."plan_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"day_plan_id" uuid NOT NULL,
	"source_brain_decision_id" uuid,
	"trigger" varchar(80) NOT NULL,
	"state" varchar(80) DEFAULT 'proposed' NOT NULL,
	"proposal" jsonb NOT NULL,
	"validation_errors" jsonb NOT NULL,
	"validated_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."proactive_message_budget_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"normal_message_count" integer DEFAULT 0 NOT NULL,
	"critical_message_count" integer DEFAULT 0 NOT NULL,
	"grouped_message_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."quiet_mode_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"review_at" timestamp with time zone,
	"reason" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"source" varchar(160) NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."reminder_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"reminder_id" uuid,
	"commitment_id" uuid,
	"source_brain_decision_id" uuid,
	"kind" varchar(80) NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"state" varchar(80) DEFAULT 'proposed' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"rationale" varchar(1000) NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."source_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"subject_type" varchar(80) NOT NULL,
	"subject_reference" varchar(512) NOT NULL,
	"state" varchar(80) DEFAULT 'open' NOT NULL,
	"summary" varchar(1000) NOT NULL,
	"resolution" varchar(1000),
	"resolved_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jarvis"."approval_requests" ADD COLUMN "source_brain_decision_id" uuid;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD COLUMN "brain_request_id" uuid;--> statement-breakpoint
ALTER TABLE "jarvis"."proposed_actions" ADD COLUMN "source_brain_decision_id" uuid;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD COLUMN "role" varchar(80) DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD COLUMN "anchor_class" varchar(80) DEFAULT 'flexible' NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD COLUMN "earliest_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD COLUMN "latest_finish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_blocks" ADD COLUMN "reason_for_placement" varchar(1000);--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD COLUMN "superseded_by_memory_record_id" uuid;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD COLUMN "evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD COLUMN "positive_evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD COLUMN "negative_evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_records" ADD COLUMN "related_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "follow_up_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "review_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "uncertainty" varchar(80) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "related_entity_type" varchar(80);--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "related_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "related_commitment_id" uuid;--> statement-breakpoint
ALTER TABLE "jarvis"."open_loops" ADD COLUMN "resolution_state" varchar(80) DEFAULT 'unresolved' NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "current_estimate" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "confidence_basis_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "positive_evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "negative_evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "frozen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "learning_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."personality_traits" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_decision_evidence" ADD CONSTRAINT "brain_decision_evidence_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_decision_evidence" ADD CONSTRAINT "brain_decision_evidence_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_decisions" ADD CONSTRAINT "brain_decisions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_decisions" ADD CONSTRAINT "brain_decisions_brain_request_id_brain_requests_id_fk" FOREIGN KEY ("brain_request_id") REFERENCES "jarvis"."brain_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_decisions" ADD CONSTRAINT "brain_decisions_model_run_id_model_runs_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "jarvis"."model_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_requests" ADD CONSTRAINT "brain_requests_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_requests" ADD CONSTRAINT "brain_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "jarvis"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_requests" ADD CONSTRAINT "brain_requests_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."brain_requests" ADD CONSTRAINT "brain_requests_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "jarvis"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."clarification_requests" ADD CONSTRAINT "clarification_requests_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."clarification_requests" ADD CONSTRAINT "clarification_requests_brain_request_id_brain_requests_id_fk" FOREIGN KEY ("brain_request_id") REFERENCES "jarvis"."brain_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."clarification_requests" ADD CONSTRAINT "clarification_requests_source_conflict_id_source_conflicts_id_fk" FOREIGN KEY ("source_conflict_id") REFERENCES "jarvis"."source_conflicts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_follow_up_history" ADD CONSTRAINT "commitment_follow_up_history_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."commitment_follow_up_history" ADD CONSTRAINT "commitment_follow_up_history_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_proposals" ADD CONSTRAINT "constitution_proposals_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_proposals" ADD CONSTRAINT "constitution_proposals_constitution_item_id_constitution_items_id_fk" FOREIGN KEY ("constitution_item_id") REFERENCES "jarvis"."constitution_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_proposals" ADD CONSTRAINT "constitution_proposals_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."constitution_proposals" ADD CONSTRAINT "constitution_proposals_reviewed_by_owner_id_owners_id_fk" FOREIGN KEY ("reviewed_by_owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."context_manifest_records" ADD CONSTRAINT "context_manifest_records_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."context_manifest_records" ADD CONSTRAINT "context_manifest_records_context_manifest_id_context_manifests_id_fk" FOREIGN KEY ("context_manifest_id") REFERENCES "jarvis"."context_manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."context_manifests" ADD CONSTRAINT "context_manifests_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."context_manifests" ADD CONSTRAINT "context_manifests_brain_request_id_brain_requests_id_fk" FOREIGN KEY ("brain_request_id") REFERENCES "jarvis"."brain_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hard_override_entity_links" ADD CONSTRAINT "hard_override_entity_links_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hard_override_entity_links" ADD CONSTRAINT "hard_override_entity_links_hard_override_id_hard_overrides_id_fk" FOREIGN KEY ("hard_override_id") REFERENCES "jarvis"."hard_overrides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hard_overrides" ADD CONSTRAINT "hard_overrides_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hard_overrides" ADD CONSTRAINT "hard_overrides_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."hard_overrides" ADD CONSTRAINT "hard_overrides_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "jarvis"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."intervention_outcomes" ADD CONSTRAINT "intervention_outcomes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."intervention_outcomes" ADD CONSTRAINT "intervention_outcomes_intervention_run_id_intervention_runs_id_fk" FOREIGN KEY ("intervention_run_id") REFERENCES "jarvis"."intervention_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."intervention_runs" ADD CONSTRAINT "intervention_runs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."intervention_runs" ADD CONSTRAINT "intervention_runs_intervention_definition_id_intervention_definitions_id_fk" FOREIGN KEY ("intervention_definition_id") REFERENCES "jarvis"."intervention_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."intervention_runs" ADD CONSTRAINT "intervention_runs_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."intervention_runs" ADD CONSTRAINT "intervention_runs_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_candidates" ADD CONSTRAINT "memory_candidates_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_candidates" ADD CONSTRAINT "memory_candidates_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_candidates" ADD CONSTRAINT "memory_candidates_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "jarvis"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_candidates" ADD CONSTRAINT "memory_candidates_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_candidates" ADD CONSTRAINT "memory_candidates_accepted_memory_record_id_memory_records_id_fk" FOREIGN KEY ("accepted_memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_candidates" ADD CONSTRAINT "memory_candidates_reviewed_by_owner_id_owners_id_fk" FOREIGN KEY ("reviewed_by_owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_evidence" ADD CONSTRAINT "memory_evidence_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_evidence" ADD CONSTRAINT "memory_evidence_memory_candidate_id_memory_candidates_id_fk" FOREIGN KEY ("memory_candidate_id") REFERENCES "jarvis"."memory_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_evidence" ADD CONSTRAINT "memory_evidence_memory_record_id_memory_records_id_fk" FOREIGN KEY ("memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_links" ADD CONSTRAINT "memory_links_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_links" ADD CONSTRAINT "memory_links_from_memory_record_id_memory_records_id_fk" FOREIGN KEY ("from_memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."memory_links" ADD CONSTRAINT "memory_links_to_memory_record_id_memory_records_id_fk" FOREIGN KEY ("to_memory_record_id") REFERENCES "jarvis"."memory_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."model_runs" ADD CONSTRAINT "model_runs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."model_runs" ADD CONSTRAINT "model_runs_brain_request_id_brain_requests_id_fk" FOREIGN KEY ("brain_request_id") REFERENCES "jarvis"."brain_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."model_runs" ADD CONSTRAINT "model_runs_context_manifest_id_context_manifests_id_fk" FOREIGN KEY ("context_manifest_id") REFERENCES "jarvis"."context_manifests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."onboarding_answers" ADD CONSTRAINT "onboarding_answers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."onboarding_answers" ADD CONSTRAINT "onboarding_answers_questionnaire_id_onboarding_questionnaires_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "jarvis"."onboarding_questionnaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."onboarding_questionnaires" ADD CONSTRAINT "onboarding_questionnaires_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_proposals" ADD CONSTRAINT "plan_proposals_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_proposals" ADD CONSTRAINT "plan_proposals_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "jarvis"."day_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."plan_proposals" ADD CONSTRAINT "plan_proposals_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."proactive_message_budget_usage" ADD CONSTRAINT "proactive_message_budget_usage_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."quiet_mode_periods" ADD CONSTRAINT "quiet_mode_periods_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_proposals" ADD CONSTRAINT "reminder_proposals_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_proposals" ADD CONSTRAINT "reminder_proposals_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "jarvis"."reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_proposals" ADD CONSTRAINT "reminder_proposals_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "jarvis"."commitments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."reminder_proposals" ADD CONSTRAINT "reminder_proposals_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."source_conflicts" ADD CONSTRAINT "source_conflicts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brain_decision_evidence_unique" ON "jarvis"."brain_decision_evidence" USING btree ("brain_decision_id","record_type","record_id");--> statement-breakpoint
CREATE INDEX "brain_decision_evidence_owner_record_index" ON "jarvis"."brain_decision_evidence" USING btree ("owner_id","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brain_decisions_request_unique" ON "jarvis"."brain_decisions" USING btree ("brain_request_id");--> statement-breakpoint
CREATE INDEX "brain_decisions_owner_created_index" ON "jarvis"."brain_decisions" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brain_requests_owner_idempotency_unique" ON "jarvis"."brain_requests" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "brain_requests_owner_source_event_unique" ON "jarvis"."brain_requests" USING btree ("owner_id","source_event_id") WHERE "jarvis"."brain_requests"."source_event_id" is not null;--> statement-breakpoint
CREATE INDEX "brain_requests_owner_state_created_index" ON "jarvis"."brain_requests" USING btree ("owner_id","state","created_at");--> statement-breakpoint
CREATE INDEX "clarification_requests_owner_state_index" ON "jarvis"."clarification_requests" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "commitment_follow_up_owner_commitment_index" ON "jarvis"."commitment_follow_up_history" USING btree ("owner_id","commitment_id");--> statement-breakpoint
CREATE INDEX "constitution_proposals_owner_state_index" ON "jarvis"."constitution_proposals" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "constitution_proposals_item_index" ON "jarvis"."constitution_proposals" USING btree ("constitution_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "context_manifest_records_unique" ON "jarvis"."context_manifest_records" USING btree ("context_manifest_id","record_type","record_id");--> statement-breakpoint
CREATE INDEX "context_manifest_records_owner_record_index" ON "jarvis"."context_manifest_records" USING btree ("owner_id","record_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "context_manifests_request_unique" ON "jarvis"."context_manifests" USING btree ("brain_request_id");--> statement-breakpoint
CREATE INDEX "context_manifests_owner_created_index" ON "jarvis"."context_manifests" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hard_override_entity_links_unique" ON "jarvis"."hard_override_entity_links" USING btree ("hard_override_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "hard_overrides_owner_active_index" ON "jarvis"."hard_overrides" USING btree ("owner_id","expires_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "intervention_definitions_name_version_unique" ON "jarvis"."intervention_definitions" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "intervention_outcomes_owner_context_index" ON "jarvis"."intervention_outcomes" USING btree ("owner_id","context_key");--> statement-breakpoint
CREATE INDEX "intervention_runs_owner_definition_created_index" ON "jarvis"."intervention_runs" USING btree ("owner_id","intervention_definition_id","created_at");--> statement-breakpoint
CREATE INDEX "memory_candidates_owner_state_review_index" ON "jarvis"."memory_candidates" USING btree ("owner_id","state","review_at");--> statement-breakpoint
CREATE INDEX "memory_candidates_owner_kind_index" ON "jarvis"."memory_candidates" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "memory_evidence_candidate_index" ON "jarvis"."memory_evidence" USING btree ("memory_candidate_id");--> statement-breakpoint
CREATE INDEX "memory_evidence_record_index" ON "jarvis"."memory_evidence" USING btree ("memory_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_links_unique" ON "jarvis"."memory_links" USING btree ("from_memory_record_id","to_memory_record_id","link_type");--> statement-breakpoint
CREATE INDEX "memory_links_owner_from_index" ON "jarvis"."memory_links" USING btree ("owner_id","from_memory_record_id");--> statement-breakpoint
CREATE INDEX "model_runs_owner_created_index" ON "jarvis"."model_runs" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "model_runs_request_index" ON "jarvis"."model_runs" USING btree ("brain_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_answers_questionnaire_question_unique" ON "jarvis"."onboarding_answers" USING btree ("questionnaire_id","question_id");--> statement-breakpoint
CREATE INDEX "onboarding_questionnaires_owner_state_index" ON "jarvis"."onboarding_questionnaires" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "plan_proposals_owner_plan_state_index" ON "jarvis"."plan_proposals" USING btree ("owner_id","day_plan_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "proactive_message_budget_owner_date_unique" ON "jarvis"."proactive_message_budget_usage" USING btree ("owner_id","local_date");--> statement-breakpoint
CREATE INDEX "quiet_mode_periods_owner_active_index" ON "jarvis"."quiet_mode_periods" USING btree ("owner_id","active","ends_at");--> statement-breakpoint
CREATE INDEX "reminder_proposals_owner_state_scheduled_index" ON "jarvis"."reminder_proposals" USING btree ("owner_id","state","scheduled_for");--> statement-breakpoint
CREATE INDEX "source_conflicts_owner_state_index" ON "jarvis"."source_conflicts" USING btree ("owner_id","state");--> statement-breakpoint
ALTER TABLE "jarvis"."approval_requests" ADD CONSTRAINT "approval_requests_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD CONSTRAINT "jobs_brain_request_id_brain_requests_id_fk" FOREIGN KEY ("brain_request_id") REFERENCES "jarvis"."brain_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."proposed_actions" ADD CONSTRAINT "proposed_actions_source_brain_decision_id_brain_decisions_id_fk" FOREIGN KEY ("source_brain_decision_id") REFERENCES "jarvis"."brain_decisions"("id") ON DELETE set null ON UPDATE no action;