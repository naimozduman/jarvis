# ADR 0012: Zero-cost stateless runtime

## Status

Accepted in Phase 3.6 repository work. No cloud resource is created or configured by this ADR.

## Context

The earlier staging design used long-running Railway API/worker processes with pg-boss and an
eventual Evolution service. That design required recurring hosted runtime costs and had a
long-running-worker correctness model that does not fit the desired zero-cost deployment boundary.

## Decision

Adopt a zero-cost architecture for the next runtime phase:

- Vercel runs stateless API/callback composition only.
- Convex coordinates opaque callbacks and transport signals only.
- Neon remains canonical for all job, event, delivery, lease, and completion semantics.
- AI calls may use Vercel AI Gateway only behind Vercel OIDC and an exact deployment-time
  Free Tier catalog allow-list. The current proof is public metadata `data[].tags` containing the
  exact value `free`; provider price fields are not eligibility proof.
- Free Tier calls consume only Vercel's included allowance. A canonical-Postgres-backed guard uses
  a current account snapshot, exact reported Gateway receipts, and a pessimistic next-call bound;
  missing accounting fails closed below the allowance.
- Direct paid OpenAI, Gateway API-key routing/BYOK, auto top-up, credit purchases, and automatic
  paid fallback are blocked whenever `JARVIS_ZERO_COST_MODE=true`.
- The WhatsApp transport lives only in an operator-owned local bridge, never in Vercel or Convex.

The Railway staging approach is **abandoned / superseded by the zero-cost architecture**. Its code
and documentation are retained as historical evidence rather than deleted or silently repurposed.

## Consequences

- Serverless correctness cannot depend on process memory, long-lived workers, local timers,
  sticky instances, or local filesystem state.
- A model name, provider, `-free` suffix, cache price, or zero list price cannot be treated as
  Free Tier evidence; unavailable eligibility metadata means no request.
- A provider list price need not be literal zero for Free Tier eligibility. Conversely, a zero list
  price without the current eligibility tag does not permit a request.
- Quota/rate exhaustion and unknown Gateway cost receipts are explicit unavailable outcomes; they
  never justify a paid route, credit purchase, auto top-up, or fallback model.
- The prior long-running Railway/pg-boss runtime may remain available for historical/local
  repository contexts, but it is not the Phase 3.6 deployment target.
- Cloud provisioning, environment configuration, catalog verification, and provider invocation
  require separate Phase 3.6B review.

## Supersedes

This supersedes the Railway runtime portion of [ADR 0001](0001-stack.md), while retaining its
general separation of web presentation, canonical database, and runtime concerns.
