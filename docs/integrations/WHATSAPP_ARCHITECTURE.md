---
title: "WhatsApp Architecture V5"
document_id: "docs::WHATSAPP_ARCHITECTURE"
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

## Current source topology

Telegram, the official dedicated Meta Cloud bridge and retained legacy Evolution/local bridge are distinct adapters around one canonical conversation/outbox. Their presence is not current enablement proof. [Current implementation](../architecture/CURRENT_IMPLEMENTATION.md) and [messaging/Handoff](../integrations/MESSAGING_AND_HANDOFF.md) supersede the original pack's local-Evolution-only current-path description.


# Boundary

WhatsApp is a surface/transport. It never owns JARVIS state, memory, Brain logic, or authority.

Evolution is one replaceable implementation behind a provider-neutral messaging boundary.

## Retained legacy Evolution path

```text
WhatsApp
 -> local Evolution
 -> local bridge normalization
 -> authenticated Vercel ingress
 -> canonical Neon event
 -> opaque Convex wakeup
 -> Brain/policy
 -> canonical response + outbound delivery
 -> opaque Convex signal
 -> local bridge requests canonical lease/content
 -> Evolution send
 -> result back to Neon
```

Private message content does not belong in Convex.

## Ownership

- Neon: conversations, normalized messages, Brain state, delivery intents/results.
- Evolution: WhatsApp session/auth/infrastructure state only.
- local bridge: private transport execution boundary.
- Vercel: canonical request-scoped processing.
- Convex: opaque wakeup metadata.

## Inbound

Only verified owner direct-message traffic enters the Brain in V1.

Webhook/provider payload never selects canonical owner identity.

## Outbound

The model does not supply phone/JID, endpoint, or credential. Canonical owner-target binding and deterministic policy choose the destination.

## Failure

Evolution loss means channel loss. It must not erase canonical state. Re-pairing does not create a new JARVIS identity.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# WhatsApp transport architecture

## Boundary

WhatsApp is a transport, never the Brain. Evolution is one replaceable implementation of the
provider-neutral `MessagingTransport` contract in `@jarvis/contracts`.

```text
WhatsApp
  -> Evolution API (session and infrastructure state only)
  -> @jarvis/integrations-evolution
  -> canonical ingress / idempotency transaction
  -> jarvis.event.process
  -> ConversationTurnService / Brain
  -> persisted response + deterministic delivery policy
  -> durable outbound delivery + pg-boss job
  -> @jarvis/integrations-evolution
  -> WhatsApp
```

The Brain imports neither Evolution HTTP types nor a provider client. It emits a canonical response
or a generic reminder intent. The transport worker is the only layer that receives a
`MessagingTransport` implementation, and it does so only after the response/reminder and delivery
intent are durable.

## Contracts and packages

| Layer | Responsibility | Cannot do |
| --- | --- | --- |
| `@jarvis/contracts/messaging` | Canonical messages/events, transport port, state and outbox schemas | Expose JIDs, QR values, keys, or provider payloads |
| `@jarvis/integrations-evolution` | Verified Evolution HTTP, webhook parsing, identity resolution, mapping, health, pairing control | Read/write canonical DB, call the Brain, choose an owner |
| `apps/api` | Fast webhook verify/parse/normalize/ingress/acknowledge | Call a model, download media, or send a reply synchronously |
| `apps/worker` | Process canonical events, invoke Brain for eligible owner text, apply delivery policy, dispatch jobs | Trust provider ownership, reconstruct a raw JID, bypass durable work |
| `@jarvis/database` | Canonical message/connection/rejection/outbox/media-metadata records and transactional job projection | Store Evolution sessions/auth files or call Evolution |

The V1 transport kind is `evolution_whatsapp`; a later Telegram, web push, or iOS adapter
implements the same transport contract without changing Brain or reminder logic.

## Canonical state vs. Evolution state

Neon/JARVIS PostgreSQL owns conversations, normalized messages, plans, reminders, commitments,
memory, model decisions, audits, connection records, delivery intents, and delivery results.

Evolution owns only its own infrastructure database/cache and Baileys authentication/session files.
Destroying Evolution can require re-pairing but must not delete or mutate canonical JARVIS state.

## Connection/readiness semantics

Connection states are explicit: `disconnected`, `connecting`, `qr_required`, `connected`,
`degraded`, `reconnecting`, `logged_out`, `blocked`, `unknown`, plus disabled/unconfigured and
version-gate states. Core API/worker readiness remains separate from transport health. A healthy
core never claims WhatsApp is connected merely because the process is alive.
