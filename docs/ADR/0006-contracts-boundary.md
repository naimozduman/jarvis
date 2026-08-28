# ADR 0006: Establish `@jarvis/contracts` as the shared runtime-contract boundary

Status: Accepted

Date: 2026-08-28

## Context

Phase 0 intentionally used `@jarvis/schemas` as a small validation package while the architecture
reserved `@jarvis/contracts` for a future responsibility change. Phase 1 now needs stable shared
contracts for authenticated principals, events, jobs, action proposals, policy decisions, audit
inputs, and health. Leaving those contracts in a package named only for schemas would obscure its
public dependency role and diverge from the architecture.

## Decision

- Create `@jarvis/contracts` as the canonical package for provider-neutral Zod contracts and their
  inferred TypeScript types.
- Keep `@jarvis/contracts` free of database drivers, queue implementations, provider SDKs, and
  model/runtime reasoning.
- Migrate Phase 1 code to import canonical contracts from `@jarvis/contracts`.
- Retain `@jarvis/schemas` as a deprecated compatibility re-export during the transition. It must
  not define divergent versions of the same contracts.
- Do not create `@jarvis/brain` in Phase 1. The brain boundary remains Phase 2 work.

## Consequences

- Apps, security, observability, integration ports, and the database layer share one versioned
  vocabulary without importing implementation details.
- The dependency graph remains acyclic: contracts are a leaf boundary; database and security may
  consume contracts but contracts never consume them.
- Existing Phase 0 imports continue to work temporarily, with an explicit removal path instead of
  a silent breaking rename.
