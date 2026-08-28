# Architecture decision index

This index is navigation for the accepted architecture decisions. It does not replace an ADR or
create a new production decision.

| ADR                                                                        | Status                         | Phase 0 implication                                                                               |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| [0001 — split Vercel, Railway, and Neon](0001-stack.md)                    | Accepted                       | Keep web, API, and worker independently buildable; CI makes no deployment or database connection. |
| [0002 — Evolution as a replaceable transport](0002-evolution-transport.md) | Accepted with operational risk | Do not add a messaging transport client, session state, or provider credentials.                  |
| [0003 — one runtime orchestrator](0003-single-orchestrator.md)             | Accepted                       | Do not implement an agent loop, specialist runtime agents, or a model call.                       |
| [0004 — finance remains read-only](0004-read-only-finance.md)              | Accepted                       | Do not add finance-write APIs, schemas, tools, or provider clients.                               |

## Phase 0 package glossary

The Phase 0 request and starter layout use `@jarvis/schemas` and `@jarvis/domain`. The existing
architecture also names future `packages/contracts` and `packages/brain` boundaries.

- `@jarvis/schemas` is the current, narrow shared validation-contract boundary.
- `@jarvis/domain` contains only provider-neutral foundation primitives and is not a brain or
  reasoning package.
- `packages/contracts` and `packages/brain` are deliberately deferred until their documented
  responsibilities exist. A future split or rename that changes dependency boundaries requires an
  ADR.

## Deferred decisions

No Phase 0 code resolves the following production decisions:

- Tested messaging image digest and cache choice.
- Object storage and raw-data retention periods.
- Production encryption-key custody and rotation procedure.
- Single-user recovery method, domains, monitoring backend, and backup restoration process.
- Provider-specific scopes, account allowlists, plans, and connection timing.

## Foundation constraints

All provider integrations are disabled in this phase. The API and worker health checks report only
bootstrap configuration plus the explicit `not_initialized` state for deferred dependencies; they
do not claim database, queue, connector, or model readiness.
