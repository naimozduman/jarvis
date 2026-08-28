# ADR 0007: Use Drizzle and pg-boss for canonical PostgreSQL persistence and durable delivery

Status: Accepted

Date: 2026-08-28

## Context

JARVIS needs durable, concurrent-safe jobs that outlive API, worker, Railway, and process restarts.
The canonical database must be PostgreSQL-compatible for Neon, while normal CI must remain usable
without a live database. A timer-only queue and an in-memory job store cannot meet those
requirements.

## Decision

- Use Drizzle ORM with the Node `pg` driver for JARVIS-owned PostgreSQL schema definitions,
  migrations, and repositories.
- Use pg-boss as the physical PostgreSQL queue, lease, retry, heartbeat, and scheduling transport.
- Keep JARVIS-owned `jobs` and `job_executions` records as the canonical application lifecycle and
  audit projection. A job uses the same UUID in that ledger and in pg-boss.
- Insert the canonical event, job projection, pg-boss transport row, and audit event in one
  Drizzle transaction through pg-boss’s documented transaction adapter.
- Let pg-boss own its internal schema. Drizzle migrations own only the `jarvis` application schema.
- Use reviewed generated migrations (`generate` then `migrate`); never use schema push as the
  production-style migration path.

## Consequences

- Concurrent workers can safely claim work using PostgreSQL-backed locking without a second,
  competing custom queue.
- Queue delivery is durable but does not make external side effects exactly once; every handler and
  future executor still needs idempotency and reconciliation.
- A database is optional for unit tests, but a real disposable PostgreSQL integration suite can
  verify atomic enqueue, retry, and migration behavior through `JARVIS_TEST_DATABASE_URL`.
