CREATE TABLE "jarvis"."telegram_bot_participants" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "jarvis"."owners"("id") ON DELETE RESTRICT,
  "connection_id" uuid NOT NULL REFERENCES "jarvis"."messaging_transport_connections"("id") ON DELETE RESTRICT,
  "participant_reference" varchar(512) NOT NULL,
  "conversation_reference" varchar(512) NOT NULL,
  "provider_chat_id" varchar(80) NOT NULL,
  "last_observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_bot_participants_connection_participant_unique" ON "jarvis"."telegram_bot_participants" ("connection_id", "participant_reference");
--> statement-breakpoint
CREATE INDEX "telegram_bot_participants_owner_connection_index" ON "jarvis"."telegram_bot_participants" ("owner_id", "connection_id");
