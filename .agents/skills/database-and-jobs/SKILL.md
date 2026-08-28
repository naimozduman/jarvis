---
name: database-and-jobs
description: Use for Neon/Postgres schemas, Drizzle migrations, pgvector, full-text search, pg-boss jobs, idempotency, event storage, audit records, backups, or recovery.
---

# Database and jobs

## Canonical state

Neon Postgres is the canonical JARVIS database. Provider databases and APIs retain provider-owned raw state. JARVIS stores normalized records, source references, summaries, and audit history.

## Schema rules

- Use UUID primary keys and UTC timestamps.
- Include user ownership on all personal records even in a one-user release.
- Include source, confidence, sensitivity, validity, and review metadata where relevant.
- Separate facts, observations, and hypotheses.
- Use append-only events and audit entries for important transitions.
- Add unique constraints for provider identifiers and idempotency keys.
- Prefer explicit join tables over opaque JSON for core relationships.
- Use JSONB for provider payload fragments and evolving metadata, not for the whole domain model.

## Migrations

- Create versioned migrations through Drizzle.
- Do not edit an already-applied production migration.
- Add backfills as resumable jobs.
- Test forward migration, application compatibility, and rollback or restore plan.

## Jobs

Use pg-boss for durable jobs, retries, cron, and dead-letter handling. Every job payload includes schema version, correlation ID, user ID, source event ID, and idempotency key. Handlers must tolerate at-least-once delivery.

## Retrieval

Use typed SQL and full-text search first. Use pgvector to retrieve supporting context, never as the only copy of a fact.

## Operations

Verify automated backups, restore drills, queue health, dead-letter count, long-running jobs, and database connection limits before production.
