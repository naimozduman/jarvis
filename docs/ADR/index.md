# Architecture decision index

This index is navigation for the accepted architecture decisions. It does not replace an ADR or
create a new production decision.

| ADR                                                                        | Status                         | Current implication                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| [0001 — split Vercel, Railway, and Neon](0001-stack.md)                    | Accepted                       | Keep web, API, and worker independently buildable; CI makes no deployment or database connection.            |
| [0002 — Evolution as a replaceable transport](0002-evolution-transport.md) | Accepted with operational risk | Do not add a messaging transport client, session state, or provider credentials before Phase 3.              |
| [0003 — one runtime orchestrator](0003-single-orchestrator.md)             | Accepted                       | Do not implement an agent loop, specialist runtime agents, or a model call before Phase 2.                   |
| [0004 — finance remains read-only](0004-read-only-finance.md)              | Accepted                       | Do not add finance-write APIs, schemas, tools, or provider clients.                                          |
| [0005 — data-first phase sequence](0005-phase-sequence.md)                 | Accepted                       | Use one canonical Phase 0–6 sequence across plans, prompts, and progress reports.                            |
| [0006 — contracts boundary](0006-contracts-boundary.md)                    | Accepted                       | Use `@jarvis/contracts` for canonical runtime contracts; preserve `@jarvis/schemas` as a compatibility shim. |
| [0007 — Postgres durable jobs](0007-postgres-durable-jobs.md)              | Accepted                       | Use Drizzle plus pg-boss with a transactional JARVIS job ledger; do not create a timer-only queue.           |

## Package glossary

The Phase 0 starter used `@jarvis/schemas` and `@jarvis/domain`. Phase 1 establishes the documented
contracts boundary while leaving the future brain boundary deferred.

- `@jarvis/contracts` owns provider-neutral Zod contracts and inferred public types.
- `@jarvis/schemas` is a deprecated compatibility re-export; it owns no divergent contracts.
- `@jarvis/domain` contains deterministic domain primitives and interfaces, not a brain or
  reasoning package.
- `@jarvis/brain` remains deliberately deferred until Phase 2.

## Deferred decisions

Phase 1 does not resolve the following production decisions:

- Tested messaging image digest and cache choice.
- Object storage and raw-data retention periods.
- Production encryption-key custody and rotation procedure.
- Single-user recovery method, domains, monitoring backend, and backup restoration process.
- Provider-specific scopes, account allowlists, plans, and connection timing.

## Current foundation constraints

All provider integrations remain disabled. The API and worker health checks distinguish process
liveness from durable-system readiness; they never claim connector or model readiness before those
systems are configured.
