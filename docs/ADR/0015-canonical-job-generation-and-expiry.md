# ADR 0015: Canonical job generation and execution expiry

## Status

Accepted for the Phase 3.6C.3 repository repair. The required database migration and code remain
unapplied and undeployed until a later reviewed release.

## Context

The Phase 3.6C.2 gate established that Convex is correctly limited to opaque scheduling data, but
it also found two missing canonical safeguards. The Convex-to-Vercel callback validated a
generation supplied by Convex and then discarded it before canonical lease acquisition. In
addition, generic durable jobs had no representation of a latest safe execution start time.

Convex scheduler attempts, PostgreSQL worker attempts, a PostgreSQL lease, an outbound-delivery
freshness window, and a commitment deadline answer different questions. Treating any one of them
as another would permit a stale callback to execute, create a hidden blanket TTL, or infer a
commitment outcome from missed work.

## Decision

### Canonical dispatch generation

`jarvis.jobs.dispatch_generation` is the authoritative, positive, monotonically increasing
dispatch revision. A newly created canonical job has generation `1`; the value is stored in Neon
and is included in each `job_executions` row for auditability. Convex stores only the opaque job
ID, correlation ID, trigger, timing, generation, and safe coordinator state. It never chooses or
increments a generation.

Neon advances generation only through an atomic pending-job revision:

- rescheduling a pending instruction advances generation and preserves its existing retry/attempt
  history;
- replacing a pending instruction advances generation, replaces its canonical payload and
  schedule, and starts a new attempt budget for that replacement;
- cancellation advances generation and marks the canonical job cancelled, invalidating earlier
  dispatch authority;
- a normal retry after a handler failure does **not** advance generation. It retains the same
  generation and increments the attempt count only when a new lease is acquired.

An active, unexpired lease cannot be cancelled or rescheduled. If a lease wins that race, the
revision operation reports that the lease is active; it cannot claim to reverse a possible
external effect. If cancellation or revision wins first, the old callback's conditional lease
update no longer matches and no handler runs. Completion and failure updates fence on generation,
worker identity, attempt number, and an unexpired lease.

Every path carries the canonical generation:

```text
canonical job create/revision
  -> opaque Convex scheduling signal
  -> Convex stored schedule and dispatch
  -> authenticated HTTP callback
  -> canonical executor
  -> atomic Neon lease acquisition
```

Missing, malformed, or mismatched generations are rejected. An old physical pg-boss message that
does not contain its canonical generation is not allowed to silently assume generation `1`.

The canonical `jobs` ledger remains the recovery record for the post-commit Neon-to-Convex handoff.
If opaque publication fails after a canonical job or revision commits, the publisher reports an
unavailable outcome. A retry or reconciliation reloads that same canonical row and republishes its
current generation; no second queue or replicated payload is introduced.

### Atomic canonical leasing

The lease grant is one conditional PostgreSQL update. It checks the expected generation and,
where supplied by the HTTP callback, correlation ID; eligible state; scheduled and available time;
attempt bound; expired prior lease; and execution deadline. The predicate uses PostgreSQL time.
The successful update returns the authoritative canonical job snapshot that the handler receives.
An application read followed by a weaker update is never execution authority.

At the exact execution deadline, a new lease is ineligible: the predicate is
`execution_deadline IS NULL OR execution_deadline > database_now`. An existing lease that started
before the deadline is not retroactively revoked; its ordinary lease fencing and external-effect
reconciliation still apply. Once such a lease has expired, it becomes eligible for the same safe
terminal-expiry transition before any new lease can begin.

### Optional execution expiry

`jarvis.jobs.execution_deadline` is a nullable latest-start deadline, not a worker lease expiry,
outbound delivery freshness field, or an underlying commitment deadline. Generic durable work
defaults to `NULL` and therefore remains durable until handled.

- Canonical event processing, connector reconciliation, transport reconciliation/connection
  health, media fetches, reminder follow-up, and other generic jobs remain non-expiring unless a
  product rule explicitly supplies a deadline.
- `jarvis.transport.outbound.send` receives the separately persisted delivery freshness instant as
  its job latest-start deadline. The delivery table still owns outbound freshness and uncertain-send
  reconciliation under ADR 0014.
- `jarvis.reminder.fire` may receive an explicit, server-derived latest-start deadline from its
  reminder trigger. If that deadline passes before a lease, the job becomes terminal with the safe
  `expired` category and requires a future reminder evaluator to decide the next reminder action.
  It does not complete or cancel the linked commitment, remove reminder history, or interpret
  silence as delivery success.

An expiration performs no handler execution. Neon persists `jobs.status = 'terminal_failed'` and
`jobs.last_error_category = 'expired'`, then records the `job.expired` audit event. The callback
disposition is `expired`; Convex stores its safe coordinator state as `expired` and schedules no
automatic callback retry. There is no separate persisted `expired` job status.

The long-running pg-boss path carries the Neon generation inside a private physical-message
envelope and still leases the canonical row before it invokes a handler. A physical retry is
allowed only when Neon committed `retry_wait`; a terminal failure caused by an execution deadline
is acknowledged without scheduling another physical retry. An unversioned pre-revision physical
message is acknowledged without execution and recovered through canonical-row reconciliation.

## Migration and release compatibility

The unapplied `0007` expand migration adds `dispatch_generation integer not null default 1`,
nullable `execution_deadline`, an execution-audit generation, an eligibility index, and positive
generation constraints. The following unapplied `0008` migration replaces the old
`(job_id, attempt_number)` execution-history uniqueness key with
`(job_id, dispatch_generation, attempt_number)`, so a replacement can start its own attempt budget
without overwriting or colliding with the prior instruction's audit history. Existing rows safely
backfill to generation `1` with no execution deadline, so they are not silently expired. The old
unique key makes the new composite key safe for existing data. The migrations alone do not make an
old API, old worker, or old Convex function revision-aware.

The later release order is: review and apply the Neon migrations `0007` then `0008`; deploy the
revision-aware Vercel API and canonical producers; deploy the Convex schema/functions; then
deploy/restart revision-aware workers and reconcile pending canonical rows into opaque schedules.
Old queued callbacks may carry generation `1` only when explicitly present. Old physical pg-boss
messages without a generation are acknowledged without executing a handler and must be recovered
by the canonical-row reconciliation path. During rollback or a release pause, stop dispatch,
retain the forward `0007`/`0008` schema, and resume/reconcile from Neon after a compatible runtime
is restored. Do not recreate the old execution uniqueness key after a replacement may have produced
the same attempt number in more than one generation. Do not assume a column addition alone
corrects already deployed code.

## Consequences

- Neon stays canonical for payloads, generations, lifecycle state, deadlines, leases, execution
  records, and audits; Convex remains an opaque scheduler.
- Duplicate, cancelled, stale, and expired callbacks are safe terminal dispositions rather than
  evidence that a provider effect occurred.
- Infrastructure errors remain unavailable errors at the HTTP boundary. They are not relabeled as
  harmless stale callbacks.
- The change does not configure a model, make inference requests, alter provider configuration, or
  activate a transport.
