# ADR 0014: Canonical delivery leases and expiry

## Status

Accepted in Phase 3.6 repository work. The schema migration is repository-only until an approved
Neon migration action exists.

## Context

A local bridge can reconnect after a delay or lose the result of a provider request. Sending an old
reminder after a computer returns online, or retrying after an uncertain provider call, is unsafe.
Neither Convex signal delivery nor transport silence provides proof of a message result.

## Decision

Neon owns a delivery lifecycle with server-derived freshness policy, atomic lease acquisition,
lease owner/token/expiry, bounded attempts, canonical retry time, terminal state, and an explicit
`requiresReconciliation` uncertainty flag.

- Normal conversational responses remain eligible for 24 hours with at most three automatic
  attempts.
- Time-sensitive reminders expire after 15 minutes with at most two automatic attempts.
- Critical alerts expire after 10 minutes with one automatic attempt and require an explicit
  follow-up/escalation policy after uncertainty.
- Local bridge leases last 120 seconds. A lease expiry or potentially dispatched provider request
  requires reconciliation rather than automatic resend.
- Result callbacks must prove the unexpired canonical lease token and bridge owner before changing
  delivery state.

## Consequences

- No transport reconnect can silently resurrect an expired delivery.
- Lease contention and duplicate signals safely produce unavailable/already-handled results.
- Retry signals are derived only after a canonical retry state commits.
- Completion is never inferred from missing callback, signal acknowledgment, or transport silence.

## Related decisions

This decision supplies the canonical state semantics used by [ADR 0013](0013-opaque-convex-local-bridge.md).
