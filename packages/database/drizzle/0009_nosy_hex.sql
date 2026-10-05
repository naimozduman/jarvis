ALTER TABLE "jarvis"."brain_requests" ADD COLUMN "admission" jsonb;--> statement-breakpoint
ALTER TABLE "jarvis"."model_runs" ADD COLUMN "admission" jsonb;--> statement-breakpoint
ALTER TABLE "jarvis"."model_runs" ADD COLUMN "usage_accounting" jsonb;--> statement-breakpoint
ALTER TABLE "jarvis"."model_runs" ADD COLUMN "exact_gateway_cost_usd" text;