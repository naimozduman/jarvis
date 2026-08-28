# Phase 0 progress — repository and safety foundation

## Scope completed

- pnpm workspace, Turborepo graph, Node and package-manager pins, and shared strict TypeScript
  configuration.
- Empty product-app scaffolds for web, API, and worker, limited to health behavior.
- Provider-free packages for configuration, schemas, database boundary, domain primitives,
  integrations boundary, security, observability, and testing.
- Environment validation that permits test mode without provider credentials and fails closed for
  missing production foundation variables.
- Lint, type-check, unit-test, format-check, bundle-validation, and portable secret-scan commands.
- CI verification with read-only permissions and no deployment step, provider connection, or
  deployment-secret reference.
- An index for the four accepted ADRs.

The declared package manager remains pinned to pnpm 11.23.0 for CI. The compatible engine range
also permits the bundled local pnpm 11.19.0 runtime so the repository commands remain executable
in this workspace.

## Deliberately not performed

- No GitHub, Vercel, Railway, Neon, messaging, model, OAuth, or other provider connection.
- No database schema, migration, job queue, webhook, authentication flow, audit persistence, or
  runtime agent loop.
- No real secrets, credentials, personal fixtures, or provider SDKs.

## Health contract

| Surface | Route or handler                         | Phase 0 behavior                                                                        |
| ------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| API     | `GET /health/live`                       | Process liveness only.                                                                  |
| API     | `GET /health/ready`                      | Validated bootstrap configuration; database and queue are explicitly `not_initialized`. |
| Worker  | `GET /health/live`                       | Health-listener liveness only; no worker loop starts.                                   |
| Worker  | `GET /health/ready`                      | Configuration plus explicit deferred database, queue, and integration checks.           |
| Web     | `GET` handler intended for `/api/health` | Framework-neutral response skeleton for the future control center.                      |

## Validation record

All commands below passed locally with Node 24.19.0 and pnpm 11.19.0. CI pins pnpm 11.23.0. The
managed Windows environment blocks Turbo's native helper, so the checked-in command wrapper used
pnpm's dependency-ordered workspace fallback after detecting that specific policy error; normal
machines and CI use Turbo directly.

| Command                | Result                                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| `pnpm format:check`    | Passed; all matched files use the configured Prettier style.                 |
| `pnpm lint`            | Passed across all 11 app/package workspaces.                                 |
| `pnpm typecheck`       | Passed across all 11 app/package workspaces with strict TypeScript settings. |
| `pnpm test`            | Passed: 5 test files and 8 tests.                                            |
| `pnpm build`           | Passed across all 11 app/package workspaces in dependency order.             |
| `pnpm bundle:validate` | Passed; 151 files checked.                                                   |
| `pnpm secrets:check`   | Passed; 151 working-tree files checked; history unavailable without Git.     |
| `pnpm run ci`          | Passed; runs the complete sequence above exactly as the CI workflow does.    |

## Unresolved decisions

1. `docs/PRD.md` and `docs/BUILD_PLAN.md` label the WhatsApp vertical slice as Phase 1, while
   `BUILD_ORDER.md` and the next prompt place canonical data, jobs, auth, policy, and audit first.
   The phase numbering needs documentation reconciliation before the later slice is reported
   complete.
2. `schemas`/`domain` are the requested Phase 0 package names, while the architecture separately
   reserves `contracts`/`brain`. The current mapping is recorded in the ADR index; no duplicate
   package is created before it has a real responsibility.
3. Production infrastructure, retention, recovery, storage, monitoring, provider scopes, and
   encryption-key operations remain intentionally undecided and unconnected.
4. The starter directory is not a Git worktree. A true Git-history secret scan and live CI run
   require private repository initialization outside this provider-free repository change.

## Exact next phase entry point

[`prompts/codex/01-foundation.md`](../../prompts/codex/01-foundation.md) is the next concrete
implementation entry point. It adds canonical data, events, jobs, authentication, policy, and
audit without adding WhatsApp or Google. Before starting it, invoke the repository skills it names:
`database-and-jobs`, `security-and-privacy`, and `jarvis-product-rules`.
