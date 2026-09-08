# Phase 3.6C.2 non-AI callback gate

Date: 2026-09-07. Result: **readiness green; callback release gate incomplete; no commit or push**.

The operator's Production redeployment `dpl_E8PqY4DrfsGoVNvTSnbRCure6AKS` was verified READY.
This task exercised the existing deployment without changing cloud code or configuration.
The requested commit `fix: harden JARVIS Vercel staging runtime` is conditional on all non-AI
cloud tests passing. That condition is not satisfied.

## Verified targets

| Component         | Target                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Vercel project    | `jarvis-api-staging`, `prj_BTVi1zPNGuenfSx0duBqj07z7Kk6`                                              |
| Vercel deployment | `dpl_E8PqY4DrfsGoVNvTSnbRCure6AKS`, Production, Fastify, `apps/api`                                   |
| Stable alias      | `https://jarvis-api-staging.vercel.app`                                                               |
| Convex            | Existing development deployment `determined-retriever-869`                                            |
| Neon              | `jarvis-staging`, project `jolly-truth-47196608`, branch `br-jolly-scene-ayxtwkhr`, database `neondb` |

## Cloud checks

| Check                                           | Result                                      | Evidence                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liveness                                        | Pass                                        | Stable alias `/api/health/live`: HTTP 200.                                                                                                                                                                                                            |
| Readiness                                       | Pass                                        | HTTP 200; configuration, database, queue pass; model `not_configured`.                                                                                                                                                                                |
| Deployment protection                           | Pass, behavior identified                   | Stable alias reaches JARVIS; immutable deployment health redirects to Vercel login and callback returns protected-deployment 401. No protection settings changed.                                                                                     |
| Convex callback configuration                   | Pass, names/presence only                   | `convex env list --names-only --deployment determined-retriever-869` lists `JARVIS_CONVEX_CALLBACK_URL`, `JARVIS_CONVEX_TO_VERCEL_SECRET`, and `JARVIS_VERCEL_TO_CONVEX_SECRET`. No values read or printed.                                           |
| Authenticated callback reachability             | Pass                                        | Convex scheduled an unused opaque job ID; Vercel logged HTTP 200; coordinator recorded one dispatch without `callback_unconfirmed`.                                                                                                                   |
| Canonical authenticated callback                | Pass                                        | Synthetic `jarvis.event.process` job completed in Neon, with one execution and `job.leased` / `job.completed` audit records. Handler checks a nonexistent synthetic event and returns; it cannot enter Brain or transport processing.                 |
| Invalid secret                                  | Pass                                        | Stable alias callback returned HTTP 401 with `{"error":"unauthorized"}` for a synthetic invalid bearer value.                                                                                                                                         |
| Duplicate callback                              | Pass                                        | Rescheduled the same completed synthetic job with coordinator generation 2 to force a second HTTP callback. Vercel returned 200; Neon retained exactly one execution, one lease, and one completion.                                                  |
| Cancelled canonical job                         | Pass                                        | Callback returned 200; Convex recorded cancelled; Neon retained cancelled status, zero attempts, and zero executions.                                                                                                                                 |
| Stale generation before dispatch                | Pass, limited scope                         | Coordinator generation 2 was scheduled in the future; explicitly invoking generation 1 did not dispatch, lease, or execute. The future test schedule was cancelled afterward.                                                                         |
| Stale generation at Vercel / in-flight callback | **Fail: missing enforcement**               | Route validates generation but drops it before calling the executor. A focused local probe sent generations 1 and 2; both calls forwarded only `jobId` and `correlationId`. Live Neon schema has no canonical generation field.                       |
| Expired generic job                             | **Blocked: no representable expiry policy** | Live `jarvis.jobs` has no `expires_at`; contract and lease predicate have no generic expiry check. The existing outbound-delivery expiry policy cannot establish this generic callback guarantee. No misleading expired-job cloud success is claimed. |
| Canonical data boundary                         | Pass, with generation caveat above          | Neon owns job payloads, status, execution, leases, and audits. Convex live tables are only `scheduledJobs` and `transportSignals`; all four inspected job rows contain only allowed orchestration fields, and transport signals are empty.            |

Vercel Standard Protection distinguishes production aliases from generated deployment URLs.
The observed behavior matches the documented boundary in
[Vercel Deployment Protection](https://vercel.com/docs/deployment-protection). The callback client
sends its application bearer credential, without a Vercel protection bypass header. Its configured
base must include `/api`; the successful real callback proves the configured path resolves without
reading the URL value. No bypass credential was created, no protection was disabled, and no
environment values were changed.

## Blocking findings and required remediation

1. **Bind generation to canonical execution.** `apps/api/src/orchestration-routes.ts` validates
   generation then calls `executor.run({ jobId, correlationId })`.
   `packages/orchestration/src/canonical-job-executor.ts` and
   `packages/database/src/job-lifecycle.ts` cannot compare a canonical generation. Convex's
   `claimDispatch` rejects an outdated generation before HTTP starts, but a callback already in
   flight can still lease a queueable canonical job. Add an authoritative Neon revision or rotating
   dispatch capability and enforce it atomically with leasing. Test an old request after the
   canonical revision changes, including a held in-flight callback. Convex must remain opaque.
2. **Define generic expiry explicitly.** `DurableJob` has scheduling and lease timestamps, but no
   job TTL. ADR 0014 defines expiry for outbound deliveries only. Specify which job types may
   expire, persist that deadline canonically, and reject expired execution atomically with a safe
   disposition and audit. Do not silently expire commitments or treat no response as completion.
   If the intended gate is only expired outbound delivery, it needs a separately explicit test
   scope; it is not equivalent to a generic expired-job guarantee.

These require canonical contract/lifecycle design and, if columns are added, a reviewed migration.
This verification task did not improvise a TTL, migrate cloud state, weaken tests, or report the
missing behavior as passing. The runtime entrypoint fixes were reviewed and appear narrow in
isolation, but the user's all-cloud-tests condition prevents committing them now.

## Synthetic fixture receipts

The test-only owner is non-primary: `36c20000-0000-4000-8000-000000000900`.
Its email uses `test.invalid`; it contains no personal data. Fixture creation and retirement have
audit receipts and stable operation/idempotency keys. Existing user data was not altered.

| Opaque job ID suffix | Test                              | Final Neon state     | Executions |
| -------------------- | --------------------------------- | -------------------- | ---------- |
| `000000000001`       | Unknown-job reachability          | No Neon job          | 0          |
| `000000000002`       | Authenticated callback and replay | Completed            | 1          |
| `000000000003`       | Canonical cancellation            | Cancelled            | 0          |
| `000000000004`       | Coordinator stale generation      | Cancelled after test | 0          |

All IDs above have prefix `36c20000-0000-4000-8000-`. Final checks found zero active synthetic
Neon jobs and zero active synthetic Convex schedules. The synthetic owner has zero Brain requests,
messages, and outbound deliveries. Sanitized audit/fixture records were retained for review.

## Log privacy review

Vercel logs were scoped to the named deployment from 21:50 UTC through 22:00 UTC. The sample
contained seven requests: four authenticated callback requests (200), one invalid-secret callback
(401), readiness (200), and liveness (200). Application records exposed only operational metadata
with the model-provider field redacted. A `pg-connection-string` TLS-mode deprecation warning was
present; it contained no database URL or credential and did not prevent readiness. The runtime
currently preserves the driver's strict TLS behavior; `DATABASE_URL` was not changed.

Convex's sampled history contained 29 execution records and zero application log lines. An
in-memory scan found no credential URL, bearer value, private key, common token value, or prohibited
private-payload field. Live Convex records had no unexpected schema fields. This is a scoped sample
and code review, not a claim about all historical platform logs.

## Local verification

| Check                               | Result                                                                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run ci`                       | Pass: formatting, lint, typecheck, tests, build, bundle validation, secret scan.                                                                                                             |
| Unit/integration-style suite        | 162 passed, 1 optional PostgreSQL test skipped; 33 passing files.                                                                                                                            |
| Workspace lint/typecheck/build      | 16 packages successful, using valid Turbo cache entries where available.                                                                                                                     |
| Brain evaluations                   | 49 passed; fake/provider-free gateway only.                                                                                                                                                  |
| Transport evaluations               | 9 passed; synthetic ports only.                                                                                                                                                              |
| Orchestration evaluations           | 17 passed.                                                                                                                                                                                   |
| Bridge evaluations                  | 16 passed; no live bridge or Evolution process.                                                                                                                                              |
| Convex TypeScript                   | `tsc -p convex/tsconfig.json --noEmit`: pass; no code push.                                                                                                                                  |
| Drizzle schema check                | Pass from `packages/database` with the documented process-local Windows identity workaround. Ordinary wrapper hit `uv_os_get_passwd` ENOMEM. No migration executed.                          |
| Production dependency audit         | Zero known vulnerabilities.                                                                                                                                                                  |
| `pnpm test:db`                      | Skipped: `JARVIS_TEST_DATABASE_URL` is absent; no dedicated local test database is configured. The canonical cloud callback tests above do not replace the optional migration/rollback test. |
| Focused generation-forwarding probe | Failed as expected for the identified gap; neither request's generation reaches the executor. This separate diagnostic is not hidden by the passing existing suite.                          |
| Diff whitespace check               | Pass.                                                                                                                                                                                        |

The installed pnpm is 11.19.0 and Node is 24.19.0, within the declared engine range. pnpm's automatic
dependency-reinstall preflight initially refused a noninteractive purge; setting
`pnpm_config_verify_deps_before_run=false` for the test process ran the existing installed
dependencies without deleting or replacing them. No dependency or lockfile changed.

The additional documentation was checked after writing. Current runtime fixes remain uncommitted.
No GitHub Actions run was triggered because no commit or push was made.

## Stop boundary

No model IDs configured; no AI Gateway request, OpenAI request, live AI inference, BYOK, credit
purchase, auto-top-up, payment, upgrade, Evolution start, or WhatsApp pairing. `DATABASE_URL` was
not changed. No cloud migration or code deployment occurred in this task.
