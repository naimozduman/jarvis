# Canonical event model

## Purpose

The `jarvis.events` table is the durable, provider-neutral boundary between an incoming fact and
later internal work. It is the canonical receipt of a delivery; it is not a channel transcript,
queue row, or model prompt. The typed ingress envelope lives in
`@jarvis/contracts/incomingEventEnvelopeSchema`.

## Ingress contract

An incoming event contains:

| Field | Meaning |
| --- | --- |
| `eventType` | Versioned semantic type, for example `internal.commitment.create.v1`. |
| `source` | `web`, `whatsapp`, `telegram`, `ios`, `poke`, `system`, or `internal`. |
| `sourceEventId` | Optional provider delivery identity when one exists. |
| `idempotencyKey` | Required stable key supplied or constructed by the trusted adapter. |
| `occurredAt` | UTC instant at which the source says the event occurred. |
| `payload` | Versioned JSON data, retained only in canonical storage. |
| `schemaVersion` | Envelope schema version. |
| `correlationId` / `causationId` | Request and causal-chain identifiers. |

The untrusted ingress shape deliberately has no `ownerId`. An authentication or connector adapter
must establish an owner-scoped principal first, and the API derives the owner from that principal.
An external provider therefore cannot select an arbitrary owner by putting an ID in JSON.

## Receipt and idempotency

The API validates the envelope before any durable write. In one database transaction it:

1. inserts the canonical event;
2. relies on unique `(owner_id, idempotency_key)` and, when present,
   `(owner_id, source, event_type, source_event_id)` constraints to detect duplicates;
3. creates the matching JARVIS `jobs` projection and pg-boss transport row when processing is
   required;
4. appends `event.received` and `job.queued` audit records; and
5. only then allows acknowledgement to the caller.

A duplicate returns the existing event and creates neither another job nor another action. Queue
delivery remains at-least-once, so deterministic handlers and future executors also use their own
operation idempotency keys.

## Processing lifecycle

```text
validated envelope
       |
       v
received -> queued -> processing -> processed
                   |                 |
                   |                 +--> action proposed -> policy -> internal execution
                   |                                      \-> approval request
                   |
                   +--> ignored (no registered deterministic handler)
                   +--> failed (recorded by a future worker failure path)
```

Phase 1 registers only deterministic internal handlers for creating/completing commitments and
scheduling reminders. It does not call a model or a provider. Processing records the event status,
safe summary, policy result, action state, and audit chain in the same logical transaction.

## Future adapters

Evolution API, Gmail, Google Calendar, Plaid, WHOOP, Iron & Intervals, food logging, iOS/HealthKit,
and Hermes must each map their verified delivery into this envelope. They must not write domain
tables directly, bypass policy, or treat their own state as JARVIS truth. Their adapters will supply
source identity, idempotency, schema versioning, source-specific verification, and reconciliation;
the event pipeline stays provider-neutral.
