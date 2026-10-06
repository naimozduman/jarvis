# Deferred Linux executable validation — canonical candidate

The October 5, 2026 source/docs candidate includes V5 absorption. Windows performed input/archive/hash/link/registry/syntax audits and the new data-only documentation writer regressions. It did not install application dependencies or execute application builds, lint/type checks, application/database/provider suites, migrations, deployment or AWS operations. Original V5's 513 pack tests are historical evidence, not rerun results.

Use the exact final candidate SHA in an isolated Ubuntu checkout, repository-pinned Node 24.19.0 and pnpm 11.23.0, synthetic fixtures, disposable databases and no production credentials. Review lifecycle scripts before frozen installation. No transfer/instance access is performed by this documentation task.

## Added V5 documentation gates

- Run python tools/jarvis-docs/manage.py check and the three documentation writer boundary regressions.
- Resolve bounded topic/mission packets with the relocated CONTEXT_REGISTRY/ROADMAP. Required overflow must fail rather than truncate policy. Source context is not mission admission.
- Extract the exact original 467-member V5 source archive only into fresh scratch for original standalone pack validation/test reproduction. Original validate.py/v5_checks.py do not validate the reorganized application root.
- Verify the legacy generate.py/render.py/index.py application-root refusal, including managed mode, and unchanged compatibility pointers. No trust/key/worker operation is required.
- Confirm staged schemas/modules/templates and workflow examples have no active runtime consumers; preserve all existing application CI and active contracts/prompts.
- Check exact immutable ADR/migration/source preservation, all 93 original requirement/acceptance texts, archive hashes, current document index and zero missing file dispositions.

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

Static source and documentation checks do not certify strict compilation, dependency installation, migrations/catalog behavior, runtime concurrency, provider readiness, current deployment/owner enrollment, actual baseline data or longitudinal usefulness. Stronger V5 first-party/approval/kill/atomic-budget/recovery controls remain separately implemented/proven requirements.

The canonical candidate is the input to Linux validation. Odysseus/controller integration, trust enrollment, paid/provider activation, AWS transfer and deployment are separate later work. Earlier fixed C7 workflows remain historical operational mechanisms, not a release plan for the newer migration chain.
