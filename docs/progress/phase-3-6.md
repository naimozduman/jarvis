# Phase 3.6 progress: zero-cost serverless orchestration and local bridge

## Current status

Repository-side Phase 3.6 implementation is complete. Provider-free source, test, bundle, secret,
and schema checks have finished; the inherited pnpm workspace-link layout blocks only the
package-manager-driven emitted API build/audit/CI commands described below. This worktree remains
intentionally uncommitted. It has not deployed, configured, or invoked
Convex cloud, Vercel, Neon, Vercel AI Gateway, Evolution, or WhatsApp. No migration has been
applied and no WhatsApp pairing has been attempted.

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

## Remaining Phase 3.6B operator actions

1. Review the uncommitted repository changes; do not commit or deploy from this task.
2. Provide/approve an existing safe Convex deployment, then run supported code generation and
   review generated APIs.
3. Create/configure Vercel only after review, with server-only Neon connection, callback secrets,
   Vercel OIDC, and zero-cost verifier output. Do not use a gateway API key or a direct paid
   fallback in zero-cost mode.
4. Apply the reviewed forward Drizzle migration only to an explicitly confirmed Neon target through
   the guarded migration process.
5. Compose the local bridge with a reviewed Convex subscription, Vercel API client, and pinned
   Evolution port only after the existing Evolution security gate is satisfied.
6. Keep WhatsApp unpaired until a separately approved operator procedure authorizes it.
