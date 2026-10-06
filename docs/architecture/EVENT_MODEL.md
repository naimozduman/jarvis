---
title: "Event Model"
document_id: "docs::EVENT_MODEL"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Principle

Every meaningful observation enters JARVIS as a typed event or explicit durable state transition.

An event says what was observed, where it came from, and when. It does not silently claim the observation is a permanent fact.

## Envelope

Core fields:
- event ID,
- owner ID,
- event type,
- source,
- source event/record ID,
- occurred time,
- received time,
- schema version,
- idempotency key,
- correlation and causation IDs,
- sensitivity,
- payload hash,
- payload or source reference,
- processing state.

## Sources

Sources may include:
- WhatsApp,
- web,
- Android,
- browser,
- voice,
- Gmail,
- Calendar,
- first-party apps,
- health connectors,
- finance connectors,
- device agents,
- scheduled jobs,
- agent workers.

## Ingestion

1. authenticate source,
2. size/shape validate,
3. normalize,
4. persist immutable envelope,
5. deduplicate,
6. enqueue or schedule canonical processing,
7. acknowledge.

## App events

First-party app events identify app ID, app schema version, source record reference, and data owner. Core should ingest decision-relevant summaries rather than duplicate huge raw records by default.

## Device/world-state events

High-volume events may update ephemeral World State instead of creating permanent ledger records. Promotion policy decides what is retained.

## Event to memory

Events may support a memory candidate. They never directly rewrite constitution or durable memory merely because they occurred.

## Replay

Processing is replay-safe. Replaying an event does not create a second commitment, message, action, or external effect.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

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

## Phase 3 verified transport ingress

Evolution webhooks enter only at `POST /webhooks/evolution`. The API enforces request size and JSON content type, verifies the reviewed per-instance JWT convention, parses an allowlisted provider envelope, normalizes it into a provider-neutral transport event, binds owner scope from server configuration, and invokes this same canonical transaction. It returns `202` after a new durable receipt or `200` for a duplicate; it does not synchronously invoke the model, download media, or send an outbound message.

The event idempotency key derives from trusted provider identifiers after normalization. Provider payload `ownerId` is not read. Rejected traffic receives a redacted transport-rejection record and does not become a canonical Brain event. History/protocol input is rejected rather than reclassified as an owner command.
