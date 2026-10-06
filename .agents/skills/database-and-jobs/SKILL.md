---
title: "Preserve canonical transactions, migrations and durable work."
document_id: ".agents::skills::database-and-jobs::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "backend_implementer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "database-and-jobs"
description: "Preserve canonical transactions, migrations and durable work."
version: "5.0.0"
---

# Purpose

Preserve canonical transactions, migrations and durable work.

## Scope and handoff

Primary role: `backend_implementer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Lead schema/migration correctness. Deployment skill owns rollout, not SQL meaning.
2. Inspect applied journals and preserve historical migrations.
3. Prove generation, lease, idempotency and partial-result transactions.
4. Test concurrent workers, deadline boundaries and late callbacks.

## Read
- `docs/architecture/DATA_MODEL.md`
- `docs/architecture/JOB_LIFECYCLE.md`
- `docs/missions/STAGING_MIGRATION_WORKFLOW.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Retained detailed engineering guidance

Follow the current root authority and relevant V5 requirements when older wording differs.

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
