---
title: "Durable Job Lifecycle"
document_id: "docs::JOB_LIFECYCLE"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Canonical authority

Neon owns durable job state.

The historical pg-boss runtime remains part of repository history. The active serverless topology uses Convex to wake an authenticated Vercel callback, then Vercel rehydrates and leases the canonical Neon job.

Convex never decides whether work is valid.

## Required job fields

A durable job records:
- owner,
- type,
- idempotency key,
- canonical payload/reference,
- priority,
- availability/schedule time,
- dispatch generation,
- optional latest-start deadline,
- attempt/lease state,
- maximum attempts,
- correlation/causation,
- source event,
- sanitized error/result metadata.

## Generation

A reschedule, replacement, or cancellation that invalidates previously emitted wakeups advances `dispatch_generation`.

A normal retry remains in the same generation.

Stale callbacks cannot execute a newer or cancelled instruction.

## Lifecycle

`queued -> eligible -> leased -> running -> completed`

Failure branches:
- retryable -> retry wait -> eligible,
- terminal -> terminal failed,
- uncertain external side effect -> reconciliation required,
- cancelled,
- expired before lease.

## Lease

Only canonical database state grants execution. A stale or duplicate worker cannot overwrite a newer lease/result.

## Error policy

Retry only explicitly classified transient failures. Unknown failures are terminal or review-required by default.

## Agent jobs

Long-running agent work follows the same durable lifecycle. The worker may checkpoint progress, but “agent started” is not completion.

## Completion

Completion is a canonical state transition backed by handler evidence. Silence, timeout, or lost connection never implies success.

## Deadline and lease distinctions

An optional execution deadline is the latest time a new database lease may start. It does not expire an already acquired lease, mark a commitment complete or replace outbound freshness. A null execution deadline means durable work remains eligible under its own lifecycle. Normal retry keeps dispatch generation and advances the attempt counter. Replacement, reschedule and cancellation invalidate stale callbacks through a new generation. Preserve the actual accepted ADR 0015 implementation and tests during migration.

A stalled worker is an observed liveness problem, not proof that its external effect failed. Reconciliation survives worker death and stop activation. Heartbeat windows and progress markers are registered per job type and tested against the deployed worker before unattended operation.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Durable job lifecycle

> **Phase 3.6 update.** This document retains the pg-boss lifecycle for the historical
> long-running runtime. The serverless deployment target does not start pg-boss: Convex wakes an
> authenticated Vercel callback, which rehydrates and leases the canonical Neon job. See
> [CONVEX_ORCHESTRATION.md](CONVEX_ORCHESTRATION.md) and
> [VERCEL_RUNTIME.md](VERCEL_RUNTIME.md).

## Contract

JARVIS owns a `jarvis.jobs` lifecycle projection and uses pg-boss as its only physical
PostgreSQL-backed queue. Both records use the same UUID. The application projection carries the
owner, type, payload, priority, schedule/availability time, attempt bound, lease fields, sanitized
error fields, completion time, correlation/causation, source event, and idempotency key. pg-boss
owns concurrent claiming, heartbeats, leases, retry scheduling, and crash recovery in its separate
`pgboss` schema.

No timer-only queue, in-process setTimeout loop, or second custom `FOR UPDATE SKIP LOCKED` claimant
exists alongside pg-boss. pg-boss uses PostgreSQL transactional locking for safe concurrent claims.

## Supported Phase 1 queues

- `jarvis.event.process`
- `jarvis.reminder.fire`
- `jarvis.reminder.follow-up`
- `jarvis.connector.reconcile`
- `jarvis.dead-letter`

The latter three are contracts only in Phase 1. No connector or outbound delivery is configured.

## Lifecycle

```text
event transaction -> queued -> pg-boss claim/lease -> handler
                                              |          |
                                              |          +--> completed
                                              |
                                              +--> retry_wait -> re-claimed -> handler
                                              |
                                              +--> terminal_failed or dead-letter review
```

Queue creation configures a bounded lease (`expireInSeconds`), heartbeat refresh, exponential
backoff, maximum delay, retry limit, and dead-letter destination. A process, API, worker, or
Railway restart leaves the PostgreSQL records intact; an expired lease becomes claimable by a later
worker. Handlers must remain idempotent because durability gives at-least-once delivery rather than
magical exactly-once external effects.

When a worker is registered with the JARVIS lifecycle projection, the successful pg-boss claim is
also recorded as `leased`, increments the attempt count, creates a `job_executions` row, and appends
audit. Completion clears the lease and records completion. A retryable failure becomes `retry_wait`
with a bounded next availability time; a terminal or exhausted failure becomes `terminal_failed`.
Those updates use an optimistic attempt/lease-owner check, so a stale worker cannot overwrite a newer
attempt after a crash or lease expiry.

## Error policy

| Category | Disposition |
| --- | --- |
| Timeout, rate limit, transient network failure, serialization/deadlock conflict | Retry with bounded exponential backoff. |
| Validation/schema error, authorization failure, policy or approval denial | Terminal; do not retry. |
| Unknown error | Terminal by default; review before changing its classification. |

The code records generic, redacted error summaries only. It never puts raw provider responses,
credentials, message content, or token text into a job error or audit record. A job reaches no more
than its configured `maximumAttempts`; Phase 1 has no infinite retry loop.

## Future jobs

The generic contract is deliberately broad enough for reminder/follow-up work, email triage,
calendar reconciliation, daily planning, weekly reports, memory maintenance, finance checks, health
synchronization, connector reconciliation, and retries. Registering one in a later phase requires
a typed payload, idempotency strategy, policy boundary, audit behavior, failure classification, and
reconciliation plan before its worker is started.

## Phase 3 transport jobs

Phase 3 adds `jarvis.transport.outbound.send`, `jarvis.transport.reconcile`, `jarvis.transport.connection.health`, and `jarvis.media.fetch`. An outbound job contains only a canonical delivery ID, owner scope, opaque connection/operation references, and content class. The worker reloads the persisted delivery intent from JARVIS state, obtains an outbox lease, rechecks deterministic policy/connection, and then calls the transport port.

A connection loss becomes retryable/waiting work without deleting canonical state. A timeout after dispatch is reconciliation-required and must not produce an automatic duplicate send. Provider delivery updates advance canonical state monotonically and are auditable. See `OUTBOUND_DELIVERY.md` for states and guarantees.
