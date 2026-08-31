# ADR 0013: Opaque Convex orchestration and local WhatsApp bridge

## Status

Accepted in Phase 3.6 repository work. No bridge session or cloud deployment is configured.

## Context

The system needs durable cloud/local transport coordination without moving private conversation
content or a WhatsApp session into the orchestration service. A notification signal alone must not
be sufficient authority to send a message.

## Decision

- Convex stores and emits only opaque canonical job IDs and outbound delivery signal references.
- The local bridge receives an opaque signal and requests the authoritative delivery through an
  authenticated Vercel API boundary.
- Vercel loads message content from canonical Neon only after an owner-scoped, short-lived bridge
  lease is atomically acquired.
- The local bridge sends through a local Evolution port and reports the result to Vercel; Vercel
  commits canonical delivery state before scheduling any opaque retry signal.
- Bridge heartbeat/presence records a safe connection state in Neon, not session material.

## Consequences

- Convex cannot store or retrieve message bodies, prompts, Brain context, constitution/memory,
  health/finance data, private history, provider credentials, raw session state, phone numbers, or
  raw JIDs.
- A repeated signal cannot create a second concurrent send because Neon lease state is authoritative.
- Vercel never imports or invokes Evolution; local transport failure does not compromise canonical
  privacy or serverless safety.
- The bridge package starts fail-closed until an operator explicitly composes verified local ports.

## Related decisions

Builds on [ADR 0011](0011-evolution-version-gate-and-owner-only-transport.md) and is paired with
[ADR 0014](0014-canonical-delivery-leases-and-expiry.md).
