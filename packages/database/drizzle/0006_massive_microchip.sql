ALTER TABLE "jarvis"."outbound_message_deliveries" ADD COLUMN "maximum_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD COLUMN "freshness_policy" varchar(80) DEFAULT 'conversation_response' NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD COLUMN "available_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Expand/backfill/contract keeps this forward migration valid for a populated canonical outbox.
-- Existing rows receive the normal conversation policy from their canonical creation time; a later
-- runtime decision still performs expiry before any local-bridge lease or provider send.
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "jarvis"."outbound_message_deliveries"
SET "expires_at" = "created_at" + interval '24 hours'
WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD COLUMN "lease_token" varchar(128);--> statement-breakpoint
ALTER TABLE "jarvis"."outbound_message_deliveries" ADD COLUMN "lease_owner" varchar(160);--> statement-breakpoint
CREATE INDEX "outbound_message_deliveries_eligibility_index" ON "jarvis"."outbound_message_deliveries" USING btree ("state","available_after","expires_at");
