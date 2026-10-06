---
title: "Local WhatsApp Bridge"
document_id: "docs::LOCAL_WHATSAPP_BRIDGE"
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


# Purpose

The local bridge keeps raw WhatsApp session state and Evolution execution off Vercel/Convex.

## Outbound

`opaque signal -> bridge -> authenticated lease request -> Neon eligibility/lease -> private intent -> local send -> result -> Neon`

Convex never sees private content.

## Inbound

`local provider event -> local strict normalization -> authenticated Vercel ingress -> canonical event -> opaque job wakeup`

## Lease

The server returns delivery content only after:
- bridge authentication,
- owner/connection match,
- freshness,
- canonical conditional lease,
- attempt/reconciliation checks.

The lease token is short-lived and scoped.

## Uncertainty

Provider exception after a possible send becomes reconciliation-required. The bridge never guesses “not sent” and retries on its own.

## Exposure

Default local-only. No public tunnel is a product requirement.

## Secrets

Evolution API/session/JID/QR material remains local and out of Convex, browser code, and model context.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Local WhatsApp bridge

## Purpose

The local WhatsApp bridge is the only place a future Evolution transport client may run. It is an
injectable, loopback-only runtime—not a Vercel function and not a Convex action. Phase 3.6 creates
the boundary and deterministic tests only; it does not run Evolution, create a session, expose a
public webhook, generate a QR code, or pair WhatsApp.

The bridge starts fail-closed until Phase 3.6B operator-owned composition supplies all three
verified ports:

1. a content-free Convex signal subscription;
2. an authenticated `VercelBridgeApiClient`; and
3. a version-gated local Evolution port.

## Outbound flow

```text
Convex opaque signal
  { deliveryId, sequence, createdAt, state: pending }
       |
       v
local bridge (connected only)
       |
       | authenticated lease request: delivery ID + bridge ID
       v
Vercel local-bridge API
       |
       | atomic owner-scoped Neon lease, freshness, retry, and reconciliation checks
       v
canonical Neon delivery + message
       |
       | private intent returned only to the lease holder
       v
local Evolution send
       |
       | authenticated accepted/retryable/terminal result callback
       v
Vercel -> canonical Neon delivery state
       |
       +-- optional opaque Convex retry signal
```

Convex never receives the returned intent or content. It only knows the opaque delivery ID and
signal timing. Vercel never owns the raw WhatsApp session or sends through Evolution.

## Trusted API surface

All endpoints below require a constant-time-checked bearer credential. Owner and connection scope
come from server configuration, never from a request body.

| Endpoint | Bridge request | Server action |
| --- | --- | --- |
| `POST /internal/local-bridge/deliveries/:deliveryId/lease` | `bridgeId` | Atomically acquire canonical lease; return intent only if fresh and eligible. |
| `POST /internal/local-bridge/deliveries/:deliveryId/result` | `bridgeId`, lease token, validated send result | Check token/owner/expiry and record accepted, retryable, terminal, or reconciliation state. |
| `POST /internal/local-bridge/signals/:deliveryId/:sequence/ack` | no private payload | Acknowledge content-free Convex signal. |
| `POST /internal/local-bridge/heartbeat` | bridge ID, safe connection state/category | Persist canonical transport presence, not provider session data. |
| `POST /internal/local-bridge/events` | normalized owner-only inbound envelope | Canonically ingest into Neon and then schedule an opaque job. |

The lease token is a one-time, random capability. It is stored with a short expiry on the Neon
delivery record and must match both `bridgeId` and canonical owner scope on the result callback.

## Idempotency and uncertainty

- A duplicate Convex signal sees the existing Neon lease, completed delivery, or terminal state;
  it cannot receive a second concurrent delivery body.
- A duplicate accepted result returns a canonical terminal/completed disposition instead of sending
  again.
- If the Evolution call throws after it may have started, the bridge reports a retryable failure
  requiring reconciliation. It does not speculate that the message was absent and it does not
  automatically resend it.
- If Neon commits a retryable result but Convex scheduling is temporarily unavailable, Vercel
  returns `503`. Repeating the exact result callback safely repairs the opaque retry signal.
- If the local bridge is offline, it acknowledges nothing and retains no message payload. Convex
  replays pending opaque signals after reconnect; Neon freshness is checked at lease time.

## Local-only exposure

`createLocalBridgeRuntime` defaults to loopback behavior and exposes a local Evolution ingress
hook only when an injected normalizer exists. There is no public tunnel requirement in the
repository architecture. Evolution-specific API keys, Baileys state, QR material, session files,
phone number, and raw JID remain local/provider concerns; none enters Convex or Vercel.

See [OFFLINE_TRANSPORT.md](OFFLINE_TRANSPORT.md) for freshness and reconciliation semantics, and
[CONVEX_ORCHESTRATION.md](../architecture/CONVEX_ORCHESTRATION.md) for the content-free signal contract.
