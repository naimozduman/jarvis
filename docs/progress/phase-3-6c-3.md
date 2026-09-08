# Phase 3.6C.3: Canonical job generation and expiry repair

## Scope and stop boundary

This repository-only repair addresses the two Phase 3.6C.2 findings: an authenticated callback
validated its Convex generation and then dropped it before execution, and generic durable jobs had
no canonical latest-start expiry representation. It preserves the existing uncommitted Fastify and
Vercel runtime work. It does not apply a migration, deploy Vercel or Convex code, change cloud
configuration, configure a model, make an inference request, activate Evolution, or pair
WhatsApp.

## Confirmed root causes

1. `apps/api/src/orchestration-routes.ts` validated `generation` but called the executor with only
   the job and correlation IDs. The old executor loaded a job before lease acquisition, and the old
   Neon lifecycle had no generation column or conditional generation predicate.
2. The old lease grant read a row in application code and then used an update guarded only by its
   attempt count. It did not atomically check generation, scheduled time, an explicit execution
   deadline, or the current authoritative payload revision.
3. `jobs` had scheduling and lease fields but no nullable job execution deadline. Delivery
   freshness existed only in the separate outbound delivery lifecycle, so it could not establish a
   generic callback-expiry guarantee.

## Implemented canonical rules

- Neon `jobs.dispatch_generation` begins at one and is the only authoritative dispatch revision.
  Convex holds an opaque copy supplied by Neon and never creates a newer revision.
- A normal retry retains generation and advances the attempt count only when a new lease is
  granted. Rescheduling, replacing a pending instruction, and cancelling a pending job each
  advance generation. Replacement resets the new instruction's attempt budget; ordinary
  rescheduling preserves it.
- The canonical lease grant is one conditional PostgreSQL update that checks generation,
  callback correlation where supplied, state, scheduled/available time, attempt bound, prior lease
  expiry, and `execution_deadline`. It returns the authoritative current job snapshot used by the
  executor. Completion and failure fence on generation, worker, attempt, and unexpired lease.
- An active lease wins over a concurrently requested cancellation or reschedule. The mutation
  reports `lease_active` instead of claiming to undo a possible external effect. If a revision wins
  first, the old callback cannot lease or write state.
- Long-running pg-boss messages carry the canonical generation in a private envelope. They use the
  canonical returned snapshot, reject unversioned pre-revision messages without execution, and
  request a physical retry only when Neon committed `retry_wait`; an expiry-driven terminal result
  is acknowledged without a retry loop.
- `execution_deadline` is nullable and enforced with database time using strict `>` comparison: at
  the deadline a new lease cannot begin. An expired pending job persists as
  `status = 'terminal_failed'` with `last_error_category = 'expired'`, records a `job.expired`
  audit event, and does not run its handler. Its HTTP callback disposition and Convex opaque
  coordinator state are both `expired`, with no retry from that result.
- Generic work remains durable with a null deadline. `jarvis.transport.outbound.send` receives the
  already canonical outbound delivery freshness instant as its latest-start boundary without
  replacing delivery uncertainty/reconciliation policy. A reminder-fire deadline is only supplied
  by an explicit future reminder policy; expiration leaves its commitment open and history intact.

The full rationale, race ordering, handoff recovery, migration compatibility, and release order
are in [ADR 0015](../ADR/0015-canonical-job-generation-and-expiry.md).

## Migration

Generated migrations: `packages/database/drizzle/0007_nasty_spyke.sql` and
`packages/database/drizzle/0008_striped_dreadnoughts.sql`.

- Adds `jobs.dispatch_generation integer not null default 1`.
- Adds nullable `jobs.execution_deadline`.
- Adds `job_executions.dispatch_generation integer not null default 1`.
- Adds a lease-eligibility index and positive generation checks.
- Replaces execution uniqueness on `(job_id, attempt_number)` with
  `(job_id, dispatch_generation, attempt_number)` so a replacement can reset its own attempt
  budget without colliding with the prior instruction's audit record.

Existing rows backfill to generation one and a null execution deadline, so none silently expire.
The migrations remain unapplied. The generator first encountered the known sandbox-only Windows
`uv_os_get_passwd ENOMEM` identity failure; it completed through the documented process-local
workaround without a database connection.

## PostgreSQL evidence

`packages/database/test/canonical-job-lifecycle.db.integration.test.ts` uses only the explicit
`JARVIS_TEST_DATABASE_URL` primary and `JARVIS_TEST_DATABASE_SECONDARY_URL` secondary test URLs.
It rejects non-local/non-test database URLs, requires distinct PostgreSQL roles against the same
disposable database for concurrency tests, serializes integration files, and uses synthetic
`test.invalid` owners. It covers:

- full fresh migration installation and an upgrade from schema through `0006` with representative
  old job and execution rows;
- matching and stale generations, a held old callback released after rescheduling, and two matching
  claims racing across connections;
- cancellation and rescheduling races with leasing;
- before/at/after latest-start deadlines, non-expiring durable work, and an expired reminder whose
  commitment remains open;
- replacement versus retry generation behavior, including a generation-two first attempt after a
  generation-one audit attempt.

The test harness is runnable by `pnpm test:db`, which includes the new suite and requires both
explicit test URLs. It cannot and does not fall back to `DATABASE_URL`. The ordinary provider-free
suite retains a documented optional skip when no test database is configured.

## Local verification

The repository-pinned toolchain reported Node `v24.19.0` and pnpm `11.19.0`. The following
commands passed: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (169 passed and
10 skipped tests), `pnpm build`, `pnpm bundle:validate`, `pnpm secrets:check`,
`pnpm brain:evals` (49/49), `pnpm transport:evals` (9/9), `pnpm orchestration:evals` (23 tests),
`pnpm bridge:evals` (16 tests), `pnpm audit --prod`, `pnpm db:check`, `pnpm run ci`, and
`git diff --check`. Convex type checking with `tsc -p convex/tsconfig.json --noEmit` also passed.

After those literal checks, the final review added the bounded positive-integer generation guard
at the Convex scheduling boundary. The final source state passed direct repository-local checks:
the full Vitest invocation reports 171 passed and 10 skipped tests; focused route and Convex policy
tests report 10 passed; direct Prettier and ESLint checks cover every final edited code file; and
direct TypeScript type and build checks passed for Convex, `packages/contracts`,
`packages/database`, `packages/orchestration`, and `apps/api`. Bundle validation, secret scanning,
and `git diff --check` also passed again. No generated JavaScript exists under `packages/*/src`.

Attempting the workspace-wide lint, typecheck, and build commands again after that final change
was blocked before execution for `@jarvis/orchestration`: its package-local pnpm process tried to
remove a modules directory and stopped with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. The
repair did not set `confirmModulesPurge`, set CI to permit a purge, install dependencies, or alter
the dependency tree. This is a process-only final-verification limitation; the direct checks above
provide current code evidence, while the earlier literal commands provide the full workspace
evidence before the small validator change.

Before Phase 3.6C.4, `pnpm test:db` ran the guarded harness and reported that
`JARVIS_TEST_DATABASE_URL` was unset; it did not run PostgreSQL integration tests. Phase 3.6C.4
makes the dedicated command fail unless both required URLs are explicitly supplied, so a missing
real-database run cannot appear successful.

The Windows sandbox process cannot resolve its account identity for some Drizzle commands and
reports `uv_os_get_passwd ENOMEM`. The repository's literal `pnpm db:generate` and
`pnpm db:check` commands were then run through the approved process-local identity workaround.
They used no database URL or connection; generation produced the reviewed migrations and
`db:check` reported `Everything's fine`. The first sandboxed production audit could not reach the
advisory service (`EACCES`), while the literal `pnpm audit --prod` subsequently completed under
the approved read-only network process and reported no known vulnerabilities.

## Required later release procedure

1. Review this uncommitted repair, the generated migration, and the local database-concurrency
   result from an isolated disposable PostgreSQL database.
2. Apply reviewed migrations `0007` and `0008` in journal order to the approved Neon target with
   the separate migrations credential. Do not use the Vercel runtime credential.
3. Deploy the revision-aware Vercel API and canonical scheduling producers, then deploy the Convex
   schema/functions that understand `expired`, then restart any revision-aware pg-boss worker.
4. Reconcile active canonical Neon rows into Convex from their current generations. Old physical
   pg-boss messages lacking a generation must be acknowledged without execution and recovered from
   their canonical Neon records.
5. Rerun the authenticated cloud callback, duplicate, stale-generation, cancellation, expiry, and
   log/privacy scenarios. Treat a failed or unavailable publication as a recoverable canonical-row
   handoff, never as a successful schedule.

If a release is paused or runtime code is rolled back, stop dispatch and retain both expand
migrations. Do not recreate the old `(job_id, attempt_number)` uniqueness key after a replacement
may have recorded generation-scoped attempts; restore a compatible runtime and reconcile from the
canonical Neon rows instead.

The cloud release gate remains incomplete until those reviewed deployment and cloud-retention tests
pass.
