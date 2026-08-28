# Durable job lifecycle

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
