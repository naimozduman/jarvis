ALTER TABLE "jarvis"."job_executions" ADD COLUMN "dispatch_generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD COLUMN "execution_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD COLUMN "dispatch_generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_lease_eligibility_index" ON "jarvis"."jobs" USING btree ("status","available_after","execution_deadline","dispatch_generation");--> statement-breakpoint
ALTER TABLE "jarvis"."job_executions" ADD CONSTRAINT "job_executions_dispatch_generation_positive" CHECK ("jarvis"."job_executions"."dispatch_generation" >= 1);--> statement-breakpoint
ALTER TABLE "jarvis"."jobs" ADD CONSTRAINT "jobs_dispatch_generation_positive" CHECK ("jarvis"."jobs"."dispatch_generation" >= 1);