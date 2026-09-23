# ADR 0016: request-scoped Vercel OIDC and bounded canonical recovery

- Status: Accepted
- Date: 2026-09-23
- Scope: Phase 3.6D.1 runtime identity and recovery of one already-committed staging job

## Context

The stateless Vercel runtime previously loaded `VERCEL_OIDC_TOKEN` directly from the process
environment during composition. Vercel's supported runtime mechanism is the official
`@vercel/oidc` helper, which resolves identity for the current Function invocation. The first
authorized staging conversation also committed its event and job to Neon before the opaque
Vercel-to-Convex publication was rejected at the coordinator authentication boundary. Creating a
second ingress would violate canonical idempotency and obscure the first request's history.

## Decision

The Vercel entrypoint resolves OIDC identity once per non-liveness Function invocation with
`getVercelOidcToken()`. It passes that identity explicitly into a disposable runtime composition.
The composition creates an invocation-local environment view and deliberately overrides any
ambient `VERCEL_OIDC_TOKEN`; it never mutates `process.env`. A missing identity leaves the model
adapter not configured. Local and test processes do not ask the helper for a development token;
they may enable the boundary only by injecting an explicit test resolver.

The token is not logged, persisted, returned, stored in Neon, or reused across invocations.
Liveness remains independent of OIDC, Neon, and model composition.

Recovery of the already-committed Phase 3.6D.1 job is a one-off staging operation in source. It
has no caller-supplied selector and hard-codes the authorized job, source event, synthetic owner,
and generation. It reloads Neon and requires queued status, zero attempts, no lease, and no
completion before regenerating `canonicalJobSignal()` and publishing it. It performs no canonical
mutation, creates no ingress/event/job, and cannot invoke Brain. Convex's existing job/generation
guard makes a repeated opaque signal idempotent at the coordinator boundary.

## Consequences

- Gateway composition uses Vercel platform identity without a Gateway key, OpenAI key, or manually
  configured OIDC variable.
- Each Function invocation receives a distinct identity input and cannot inherit identity from a
  previous request.
- Provider-free local behavior remains deterministic.
- The special recovery executable is safe only while the exact canonical preconditions still
  hold; any drift refuses publication.
- The failed Vercel-to-Convex shared-secret boundary must be synchronized before the reviewed
  recovery operation runs.
