# Retained and restored C7 continuity — 2026-10-05

All 17 C7 paths identified as absent from preserved R1 already exist in the verified GitHub-main
baseline. The fresh candidate starts from that baseline, so **17 items are retained/restored to the
combined product state and 0 files require a copy from a source absent on main**. “Restored” here
means preserving C7 continuity while importing R1, not manufacturing a new recovery operation.
The reconciliation matrix records `KEEP_MAIN` for unchanged C7 source and `MERGE` where navigation
or runtime composition is deliberately reconciled.

Provenance: preserved R2/C7 commit `6f1519795553a0c7f75d437c6914b1d9282a7faf`, branch
`codex/phase-3-6d3-single-gateway-attempt`; preserved snapshot
`C:/Users/localhost/JARVIS_PRESERVATION_2026-10-05/snapshots/R2`; main baseline
`8fffe34cf12f13b9dbbd8fe7f7f37b2d17937df7`. These 17 source blobs match between C7 and main.
The original accepted ADR body and source/test/workflow/script content remain traceable without
altering preservation evidence. `docs/STAGING_MIGRATION_WORKFLOW.md` receives a dated historical
scope note; its underlying procedure is retained.

| C7 item absent from R1 | Candidate disposition | Reason / retained scope |
| --- | --- | --- |
| `.github/workflows/staging-migration-manual.yml` | KEEP_MAIN, retained unchanged | Fixed reviewed historical release gate; manual dispatch restricts repository, owner, main, acknowledgements and fixed application/migration hashes. Not invoked. |
| `.github/workflows/staging-migration-rehearsal.yml` | KEEP_MAIN, retained unchanged | Fixed historical PostgreSQL/TLS/index rehearsal; push trigger only targets `verify/staging-migration-workflow`. Not invoked. |
| `apps/api/src/phase-3-6d1-job-recovery-cli.ts` | KEEP_MAIN, operational history | One fixed staging job publication; requires staging/configured canonical database and coordinator. No general recovery authority or execution added. |
| `apps/api/src/phase-3-6d1-job-recovery-route.ts` | KEEP_MAIN, operational history | Temporary token-gated route with no caller selector/body and safe refusal/publication categories. Preserve evidence; no token provisioned or call made. |
| `apps/api/src/phase-3-6d1-job-recovery.ts` | KEEP_MAIN, operational history | Exact pre-authorized job/event/owner/generation and zero-attempt/no-lease queued preconditions; no canonical mutation or Brain invocation. |
| `apps/api/src/staging-c7-harness-routes.ts` | KEEP_MAIN, validation safeguard | Staging-only fixed lifecycle suite; owner/token/suite required; rejects caller-selected query/body and sanitizes errors. |
| `apps/api/src/staging-c7-harness.ts` | KEEP_MAIN, validation safeguard | Fixed generation, cancellation, reschedule, expiry, retry and publication-recovery cases; synthetic owner and cleanup fences. Isolated execution deferred. |
| `apps/api/src/staging-runtime-auth.ts` | KEEP_MAIN, shared safeguard | Timing-safe hashed bearer comparison and fixed trusted staging principal, reused by fixed probes. |
| `apps/api/test/phase-3-6d1-job-recovery-route.test.ts` | KEEP_MAIN, retained test | Auth/body/refusal/publication transport boundaries; never silently removed because its recovery is historical. |
| `apps/api/test/phase-3-6d1-job-recovery.test.ts` | KEEP_MAIN, retained test | Exact-target canonical preconditions and one opaque publication; safe executable validation deferred. |
| `apps/api/test/staging-c7-harness-routes.test.ts` | KEEP_MAIN, retained test | Staging-only registration, token, request shape and safe error paths. |
| `apps/api/test/staging-c7-harness.test.ts` | KEEP_MAIN, retained test | Fixed lifecycle matrix and cleanup behavior remain regression evidence. |
| `docs/ADR/0016-request-scoped-vercel-oidc-and-bounded-recovery.md` | KEEP_MAIN, accepted history | Accepted 2026-09-23; original filename/body preserved alongside R1 admission ADR 0016, indexed by full slug. |
| `docs/STAGING_MIGRATION_WORKFLOW.md` | MERGE, historical scope note | Preserve procedure/provenance while identifying fixed `940ab61`/0007/0008 scope and distinguishing later candidate migrations. |
| `scripts/staging-migration-rehearsal.mjs` | KEEP_MAIN, historical validation | Structural schema/index checks and TLS failure gates retained. No dependency install or rehearsal execution performed. |
| `scripts/staging-migration-release.mjs` | KEEP_MAIN, historical release evidence | Fixed source/migration/target trust checks and narrow child environment retained; cannot be treated as candidate release authorization. |
| `scripts/staging-migration-release.test.mjs` | KEEP_MAIN, retained test | Safety checks retained for isolated Linux execution; test-runner separation from Vitest is preserved. |

C7's request-local OIDC composition and `maxRetries: 0` safeguard remain required technical
invariants. They live partly in shared paths also changed by R1, so source reconciliation preserves
both rather than treating the 17-file list as the entire C7 contribution. C7's no-automatic-retry
and explicit-identity documentation is retained alongside R1 Cloud-intake and model-admission work.

The migration workflows still target their original fixed source. They are historical operational
evidence, not instructions to apply later candidate migrations. Pushing `reconciliation/2026-10-05`
does not meet their migration/rehearsal branch guards. No workflow was dispatched, runtime token
created, fixture persisted, recovery signal published or production infrastructure accessed here.
See [DEFERRED_VALIDATION.md](DEFERRED_VALIDATION.md) for Ubuntu execution gates and
[CANONICAL_DOCUMENTATION_MAP.md](CANONICAL_DOCUMENTATION_MAP.md) for ADR/document authority.
