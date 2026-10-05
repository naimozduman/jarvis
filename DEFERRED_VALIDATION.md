# Deferred executable validation — 2026-10-05

This is a reviewable source candidate. Windows did not provide the required isolated executable
environment, so this phase installed no dependencies and ran no repository application, test,
build, lint, typecheck, code generator, migration, provider call or deployment. Host security was
not weakened. Standalone trusted parsers read source as data; they did not import repository code.

The next separately scoped Ubuntu Lightsail validation task should use a disposable isolated
checkout of the final `reconciliation/2026-10-05` SHA, the repository-pinned Node 24.19.0 and
pnpm 11.23.0, synthetic fixtures and disposable local/container databases. No transfer, instance
access or infrastructure operation was performed by this phase.

## Required validation

| Gate | Scope and evidence still required |
| --- | --- |
| Dependency and lock reproducibility | Review lifecycle scripts under isolation; verify frozen-lockfile installation and pinned production dependency audit. Static importer/specifier checks passed here, but installation was not attempted. |
| Format, lint, types and build | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`; strict TypeScript and workspace resolution must pass. Babel grammar/import checks are narrower than the compiler. |
| Provider-free repository tests | `pnpm test` includes Vitest and the separate Node migration-safety runner. Run brain, transport, orchestration and local-bridge evaluations; `pnpm bundle:validate` and `pnpm secrets:check` remain executable checks. |
| Merged runtime boundaries | Exercise invocation-local identity, no local helper lookup, absence of identity, unchanged non-model health readiness, one HTTP Gateway attempt, admission/accounting, request framing, API route composition and C7 fixed fixture guards. Missing model identity must report model `not_configured`; overall non-model readiness can remain OK as existing tests specify. |
| Staging authentication repair | Execute the regression proving missing/wrong smoke bearer cannot prepare a fixture, persist an event or create a job; authorized ingress remains authenticated again at its canonical boundary. |
| Disposable PostgreSQL gate | Provide distinct least-privileged primary/secondary roles on explicitly named local/container test databases. `pnpm test:db` now selects all five local suites, requires at least 64 cases, every selected suite to produce nonempty results, all results to pass and no pending/todo/skipped suites. It retains the original ten exact required case titles. |
| Database migration and catalog | Validate fresh chain `0000`–`0012`, representative upgrades through `0006`, SQL hashes, canonical generation/expiry/leases, outbox/event transactions, model accounting/admission/output audit and Telegram table/index/FKs/ID default. Exercise the new catalog-default assertion. |
| Drizzle metadata and generator | `pnpm db:check`; run generation only in a disposable scratch checkout and review its diff. `0011`/`0012` snapshots were reconstructed statically, preserve the prior 77 tables and prevent duplicate Telegram table creation. The original inline REFERENCES use PostgreSQL FK names; Drizzle may propose naming alignment with current source conventions. Confirm actual catalog and generator behavior before accepting any further migration. |
| Reminder and daily-use reliability | Two-role cancellation/reschedule races, final enrollment/quiet/generation/execution/delivery revalidation, safe retry floors, held unknown outcomes, idempotent dispatch, owner feedback and scoped bootstrap/privacy/concurrent approval/recovery cases. |
| Transport integration | Synthetic Telegram and dedicated WhatsApp Cloud ingress/delivery, typing lifecycle, raw webhook/signature/owner boundaries and disabled gates. No live message or provider canary is part of this candidate validation. |
| Personal-system integration | Main's protected read admission, token rotation, scoped audit, service-owned origins/client/envelopes and mocked unavailable/retry/error paths; ensure client adapters remain server-only. Do not call the production origins embedded as configuration direction. |
| Convex | Offline TypeScript/schema/opaque-job consistency and compatible local validation. No production codegen/deployment or remote scheduler callback should be invoked. |

The five local database suites contain 9 canonical lifecycle, 1 PostgreSQL, 25 requested-reminder,
11 owner-feedback and 18 owner-baseline cases: **64** in total, counted from source, including
parameterized cases. Earlier reports of 65 enabled cases are retained as dated evidence. The
additional `reliability.db.integration.test.ts` is preserved but intentionally excluded from the
local gate: it is hard-bound to a historical hosted synthetic Neon endpoint. Its accounting/delta
coverage still needs a separately reviewed disposable local equivalent before execution; this
phase neither provisioned that endpoint nor authenticated to it.

## Remaining release limits

Safe static results do not certify migration execution, type correctness, runtime behavior,
provider availability, current deployment enablement, owner baseline population, delivery/read
proof or longitudinal natural use. Existing product questions in `docs/JARVIS/OPEN_QUESTIONS.md`
remain scoped product questions. Historical fixed C7 release/recovery workflows are provenance,
not a release mechanism for this candidate's newer migrations.

The branch is ready to become the input to isolated Linux validation. It is not a validated
release. V5 integration, Jarvis Zero development, AWS transfer and deployment remain outside this
phase.
