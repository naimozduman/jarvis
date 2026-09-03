# Phase 3.6 progress: zero-cost serverless orchestration and local bridge

## Current status

Repository-side Phase 3.6 implementation is complete. Provider-free source, test, bundle, secret,
and schema checks have finished; the inherited pnpm workspace-link layout blocks only the
package-manager-driven emitted API build/audit/CI commands described below. This worktree remains
intentionally uncommitted. The historical repository-only status is superseded by the Phase 3.6B
checkpoint below: a Convex development deployment and the manually completed Neon staging migration
now exist, while Vercel deployment, runtime/secret configuration, model inference, Evolution, and
WhatsApp pairing remain unperformed.

The former Railway staging design is **abandoned / superseded by the zero-cost architecture**. Its
documents are retained as historical architecture records rather than deleted.

## Architecture completed

- **Canonical Neon semantics:** events, jobs, message/delivery records, freshness policy,
  availability, attempts, lease owner/token/expiry, retries, terminal failure, and reconciliation
  remain canonical database state.
- **Convex orchestration:** only opaque job and delivery signal references, generations, timing,
  retry counts, and safe state. It carries no message body or private JARVIS context.
- **Vercel runtime:** disposable API/callback composition has no persistent worker, local timer,
  sticky memory, local state, pg-boss loop, or direct Evolution client.
- **Zero-cost AI Gateway:** direct paid OpenAI, paid gateway keys, automatic paid fallback, and
  unverified free-model claims are blocked when zero-cost mode is enabled. The model catalog
  verifier is authoritative and an unavailable route returns `not_configured`.
- **Local WhatsApp bridge:** an opaque Convex signal causes an authenticated Vercel/Neon lease
  request; private delivery content is returned only to the local lease holder, then a local
  Evolution result callback writes canonical Neon state.
- **Offline safety:** reconnect rechecks lease eligibility and expiration, so an old reminder is
  not sent merely because the local computer returned online. Uncertain sends require explicit
  reconciliation rather than automatic resend.

## New repository artifacts

- `packages/orchestration` for canonical serverless job execution, opaque Convex publishing, and
  Vercel-safe transport event processing.
- `convex/` for opaque scheduling and bridge signal state, following the generated Convex guidance.
- `apps/whatsapp-bridge` for injectable local signal/API/Evolution ports and loopback runtime.
- Canonical delivery freshness/lease fields and the forward migration
  `0006_massive_microchip` with populated-outbox backfill.
- Authenticated Vercel local-bridge routes, exact zero-cost model verifier, and provider-free test
  suites for orchestration, bridge, privacy, retry, outage, and model safety boundaries.
- [ZERO_COST_ARCHITECTURE.md](../ZERO_COST_ARCHITECTURE.md),
  [CONVEX_ORCHESTRATION.md](../CONVEX_ORCHESTRATION.md),
  [VERCEL_RUNTIME.md](../VERCEL_RUNTIME.md), [VERCEL_AI_GATEWAY.md](../VERCEL_AI_GATEWAY.md),
  [LOCAL_WHATSAPP_BRIDGE.md](../LOCAL_WHATSAPP_BRIDGE.md), and
  [OFFLINE_TRANSPORT.md](../OFFLINE_TRANSPORT.md), plus ADRs 0012–0014.

## Verification and gates

- The recovered workspace preflight confirmed `HEAD` and `origin/main` both equal
  `c4d27843b768250f18783eee902735d4de649cd7`; inherited Phase 3.6 changes were preserved.
- Desktop runner health passed read/create/delete/process/Node/pnpm/Git checks.
- The offline Drizzle generator initially hit the documented Windows `uv_os_get_passwd` `ENOMEM`
  defect. The documented process-local `os.userInfo` workaround generated migration 0006 and the
  identical Drizzle check returned `Everything's fine`; it did not contact a database.
- `convex codegen` correctly stopped at the missing `CONVEX_DEPLOYMENT` account/deployment gate.
  Generated APIs were not handwritten and no cloud deployment or login was created to bypass it.
- Full local quality-gate totals and results are recorded below.

## Final local verification results

| Check                       | Result                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace formatting        | `prettier --check .` passed.                                                                                                                                                                                    |
| Workspace source lint       | Every package `src` target passed with `eslint --max-warnings=0`; the new Convex, bridge, verifier, and Phase 3.6 test targets also passed.                                                                     |
| Workspace typecheck         | All 16 workspace `tsconfig.json` projects passed with `tsc --noEmit`.                                                                                                                                           |
| Provider-free unit suite    | 31 files / 141 tests passed; one existing database integration test was skipped because no test database URL was configured.                                                                                    |
| Brain evals                 | 1 file / 49 tests passed.                                                                                                                                                                                       |
| Transport evals             | 1 file / 9 tests passed.                                                                                                                                                                                        |
| New orchestration evals     | 5 files / 12 tests passed.                                                                                                                                                                                      |
| New bridge evals            | 3 files / 16 tests passed.                                                                                                                                                                                      |
| Build                       | 15 of 16 workspace emitted builds passed. `apps/api` source typecheck passes, but its emitted build cannot resolve the new `@jarvis/orchestration` package through the inherited stale `node_modules` junction. |
| Bundle / secret scans       | Bundle validation passed for 392 files; the working-tree and Git-history secret scan passed for 392 working-tree files.                                                                                         |
| Drizzle schema verification | Migration `0006_massive_microchip` was generated offline and `drizzle-kit check` returned `Everything's fine` using only the documented process-local Windows identity workaround. No migration ran.            |
| Zero-cost catalog command   | Intentionally skipped locally because zero-cost mode is not configured and the command would contact the public catalog. Deterministic catalog/verifier tests passed without a provider call.                   |

### Package-manager verification blocker

The recovered `node_modules/@jarvis` junction points at an earlier external temporary virtual
store and has no `@jarvis/orchestration` child link. With the exact pinned pnpm 11.23.0, a frozen,
offline, script-disabled reconciliation safely refused to remove the modules directory because its
resolved target is outside a strict workspace subdirectory. A subsequent non-mutating `pnpm
format:check` safely aborted before execution with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.

No purge, forced confirmation, module-directory deletion, lockfile rewrite, or blind reinstall was
performed. Consequently the literal `pnpm build`, `pnpm audit --prod`, and `pnpm run ci` commands
remain blocked by this pre-existing workspace layout even though their provider-free underlying
checks above were run directly. Resolve it only after preserving/reviewing this uncommitted
worktree through an approved clean-link/reinstall or relocation plan.

## Phase 3.6B provider checkpoint — 2026-09-02

- The current-workspace preflight for this continuation confirmed both `HEAD` and `origin/main` at
  `2879d6b73e5bd82b5cccb52e97e96808395a1f8b`. Existing uncommitted Convex compatibility fixes and
  progress documentation were preserved; no clone, reset, OneDrive checkout, or migration rerun was
  used.
- The reviewed Convex development deployment was created on the authenticated Free target. The
  supported code generation completed and `health:get` returned the expected healthy result. No
  production deployment was created.
- The operator confirmed that the reviewed `jarvis` migration completed on the explicitly named
  `jarvis-staging` Neon target. The temporary migrations-only connection variable was removed; it
  was not copied into any application configuration.
- The `jarvis-web` project was created on the authenticated Vercel Hobby team. It has no
  deployments. Its only project environment configuration is the zero-cost-mode flag and the
  OIDC-only Vercel AI Gateway provider selection, stored as ordinary Config values in Development,
  Preview, and Production. There is no `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, model route,
  verified-model allow-list, or manually supplied OIDC token.
- The former literal-zero-price predicate was corrected. It was wrong because Vercel Free Tier
  eligibility is current catalog metadata, while an eligible model can retain nonzero provider list
  pricing against included credits. The new verifier accepts only exact `data[].tags` value `free`,
  fails closed on a changed/malformed schema, and emits an auditable machine-readable ID list.
- The corrected public catalog query returned HTTP 200 and **15** exact Free Tier IDs, including
  seven language candidates. `minimax/minimax-m2.7` and `minimax/minimax-m3` have nonzero listed
  prices yet current `free` tags, proving the corrected semantics. Candidate logical routes are
  `fast=minimax/minimax-m2.7`, `standard=minimax/minimax-m3`, and
  `deep=minimax/minimax-m3`; none is configured and no inference was made. Public metadata does
  not prove per-model structured-output compatibility, so that remains a later explicit gate.
- The repository now contains a Vercel `/api/*` Web-Handler Fastify entrypoint, a canonical
  included-credit safety guard, and focused tests. Option B was chosen: `jarvis-web` remains
  reserved for the future control center and the single `jarvis-api-staging` Hobby project was
  created as the clean API boundary. It has zero deployments, no domain, no framework binding, and
  no project configuration; its root remains to be set to `apps/api` only during a later deployment
  review.
- Current local verification after the corrected verifier/entrypoint changes passed
  `format:check`, lint (16 packages), typecheck (16 packages), tests (159 passed, 1 skipped), build
  (16 packages), bundle validation (404 files), all four eval suites (49 Brain, 9 transport, 17
  orchestration, and 16 bridge cases), Convex code generation, and production dependency audit (no
  known vulnerabilities). The normal `db:check` wrapper still encounters the documented Windows
  `uv_os_get_passwd` `ENOMEM` environment defect; the identical Drizzle check succeeded via the
  process-local identity workaround and did not contact Neon. `secrets:check` and therefore `ci`
  previously stopped only because a pre-existing ignored `.env.local` was correctly detected as
  secret-shaped. During the 2026-09-03 pre-deployment checkpoint, that file was preserved outside
  the Git worktree without inspecting, printing, changing, or exposing its contents; it no longer
  blocks the repository secret scan.
- No payment, card, upgrade, paid resource, or WhatsApp pairing action was performed.

## Remaining Phase 3.6B operator actions

1. Review the uncommitted repository changes; do not commit or deploy from this task.
2. Review the already-created empty `jarvis-api-staging` Hobby project and point its root at
   `apps/api` only when the later deployment review is approved. Stop if Vercel asks for payment, a
   card, an upgrade, or paid usage; do not deploy at that step.
3. Provide or separately approve a server-only pooled Neon _application_ connection and the callback
   secret composition required for the Vercel/Convex boundary. Do not reuse the removed
   migrations-only connection variable or expose any secret in source, logs, or client code.
4. Re-run the exact public catalog verifier immediately before deployment. Only then may exact
   Gateway model IDs, the verified allow-list, conservative rate cards, and a current account usage
   snapshot be configured after a separately approved structured-output probe; no paid fallback,
   static Gateway key, purchased credits, or auto top-up is permitted.
5. Compose the local bridge with a reviewed Convex subscription, Vercel API client, and pinned
   Evolution port only after the existing Evolution security gate is satisfied.
6. Keep WhatsApp unpaired until a separately approved operator procedure authorizes it.
