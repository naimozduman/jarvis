CREATE TYPE "jarvis"."messaging_connection_state" AS ENUM('disabled', 'unconfigured', 'connecting', 'qr_required', 'connected', 'degraded', 'reconnecting', 'disconnected', 'logged_out', 'blocked', 'incompatible_dependency', 'license_required', 'unknown');--> statement-breakpoint
CREATE TYPE "jarvis"."outbound_delivery_state" AS ENUM('pending', 'leased', 'sent', 'delivered', 'read', 'failed_retryable', 'failed_terminal');--> statement-breakpoint
CREATE TABLE "jarvis"."media_fetch_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"provider_media_reference" varchar(512) NOT NULL,
	"state" varchar(80) DEFAULT 'metadata_only' NOT NULL,
	"mime_type" varchar(160),
	"byte_length" integer,
	"object_reference" varchar(1024),
	"content_hash" varchar(128),
	"safe_error_category" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."messaging_connection_state_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"previous_state" "jarvis"."messaging_connection_state",
	"resulting_state" "jarvis"."messaging_connection_state" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source_event_id" uuid,
	"correlation_id" uuid NOT NULL,
	"safe_error_category" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."messaging_identity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"identity_reference" varchar(512) NOT NULL,
	"canonical_contact_reference" varchar(512) NOT NULL,
	"identity_kind" varchar(80) NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."messaging_transport_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"transport" varchar(80) NOT NULL,
	"instance_reference" varchar(512) NOT NULL,
	"provider_build_id" varchar(256),
	"baileys_version" varchar(80),
	"image_digest" varchar(128),
	"version_verified" boolean DEFAULT false NOT NULL,
	"outbound_enabled" boolean DEFAULT false NOT NULL,
	"state" "jarvis"."messaging_connection_state" DEFAULT 'unconfigured' NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"last_reconciled_at" timestamp with time zone,
	"last_safe_error_category" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."messaging_transport_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"transport" varchar(80) NOT NULL,
	"instance_reference" varchar(512) NOT NULL,
	"provider_event_reference" varchar(512),
	"event_type" varchar(160) NOT NULL,
	"sender_reference" varchar(512),
	"reason" varchar(160) NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jarvis"."outbound_message_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"transport" varchar(80) NOT NULL,
	"target_reference" varchar(512) NOT NULL,
	"operation_key" varchar(256) NOT NULL,
	"source_event_id" uuid,
	"brain_request_id" uuid,
	"reminder_id" uuid,
	"state" "jarvis"."outbound_delivery_state" DEFAULT 'pending' NOT NULL,
	"provider_message_reference" varchar(512),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"requires_reconciliation" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error_category" varchar(80),
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jarvis"."media_fetch_requests" ADD CONSTRAINT "media_fetch_requests_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."media_fetch_requests" ADD CONSTRAINT "media_fetch_requests_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "jarvis"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_connection_state_events" ADD CONSTRAINT "messaging_connection_state_events_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_connection_state_events" ADD CONSTRAINT "messaging_connection_state_events_connection_id_messaging_transport_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "jarvis"."messaging_transport_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_connection_state_events" ADD CONSTRAINT "messaging_connection_state_events_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_identity_aliases" ADD CONSTRAINT "messaging_identity_aliases_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_identity_aliases" ADD CONSTRAINT "messaging_identity_aliases_connection_id_messaging_transport_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "jarvis"."messaging_transport_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_transport_connections" ADD CONSTRAINT "messaging_transport_connections_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."messaging_transport_rejections" ADD CONSTRAINT "messaging_transport_rejections_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD CONSTRAINT "outbound_message_deliveries_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "jarvis"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD CONSTRAINT "outbound_message_deliveries_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "jarvis"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD CONSTRAINT "outbound_message_deliveries_connection_id_messaging_transport_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "jarvis"."messaging_transport_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD CONSTRAINT "outbound_message_deliveries_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "jarvis"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_fetch_requests_message_provider_unique" ON "jarvis"."media_fetch_requests" USING btree ("message_id","provider_media_reference");--> statement-breakpoint
CREATE INDEX "media_fetch_requests_owner_state_index" ON "jarvis"."media_fetch_requests" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "messaging_connection_state_events_connection_occurred_index" ON "jarvis"."messaging_connection_state_events" USING btree ("connection_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_identity_aliases_connection_reference_unique" ON "jarvis"."messaging_identity_aliases" USING btree ("connection_id","identity_reference");--> statement-breakpoint
CREATE INDEX "messaging_identity_aliases_owner_approved_index" ON "jarvis"."messaging_identity_aliases" USING btree ("owner_id","approved");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_transport_connections_owner_transport_instance_unique" ON "jarvis"."messaging_transport_connections" USING btree ("owner_id","transport","instance_reference");--> statement-breakpoint
CREATE INDEX "messaging_transport_connections_owner_state_index" ON "jarvis"."messaging_transport_connections" USING btree ("owner_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_transport_rejections_dedupe_unique" ON "jarvis"."messaging_transport_rejections" USING btree ("owner_id","instance_reference","provider_event_reference","reason") WHERE "jarvis"."messaging_transport_rejections"."provider_event_reference" is not null;--> statement-breakpoint
CREATE INDEX "messaging_transport_rejections_owner_received_index" ON "jarvis"."messaging_transport_rejections" USING btree ("owner_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_message_deliveries_owner_operation_unique" ON "jarvis"."outbound_message_deliveries" USING btree ("owner_id","operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_message_deliveries_connection_provider_message_unique" ON "jarvis"."outbound_message_deliveries" USING btree ("connection_id","provider_message_reference") WHERE "jarvis"."outbound_message_deliveries"."provider_message_reference" is not null;--> statement-breakpoint
CREATE INDEX "outbound_message_deliveries_connection_state_index" ON "jarvis"."outbound_message_deliveries" USING btree ("connection_id","state","created_at");--> statement-breakpoint
CREATE INDEX "outbound_message_deliveries_message_index" ON "jarvis"."outbound_message_deliveries" USING btree ("message_id");