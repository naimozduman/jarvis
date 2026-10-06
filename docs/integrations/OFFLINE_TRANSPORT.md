---
title: "Offline Transport and Reconnect"
document_id: "docs::OFFLINE_TRANSPORT"
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


# Rule

Channel loss is not brain loss.

Canonical responses, reminders, commitments, and jobs survive a disconnected bridge or messaging provider.

## Retained legacy local-bridge model

Convex exposes only opaque pending signals. The local bridge requests a fresh canonical Neon lease from Vercel before receiving private content.

Convex does not store:
- message text,
- owner phone/JID,
- Brain context,
- memory,
- credentials.

## Lease safety

A lease is short, random-token bound, owner/delivery/bridge scoped, and checked again on result callback.

## Reconnect

On reconnect:
1. bridge sees opaque signal,
2. Vercel checks freshness/eligibility,
3. only eligible work receives a lease/content,
4. expired work remains expired.

## Unknown send

Lease expiry after a possible provider send means reconciliation required. Automatic resend is unsafe.

## Dependency failures

- Convex down: Neon state remains correct.
- Neon down: no send.
- local bridge down: no content leaves cloud; work waits/ages.
- Evolution down: explicit failure, never fake success.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Offline transport, delivery leases, and expiry

## Canonical source of truth

Neon is canonical for every outbound delivery decision. Convex may wake a local bridge, but it
cannot grant a lease, decide freshness, store content, change attempts, or mark a delivery sent.
No process-memory queue or timer is authoritative.

Each canonical outbound delivery persists at least:

- lifecycle state, available time, expiration time, attempt count, maximum attempts, and
  server-derived freshness policy;
- bridge lease owner, random lease token, and short lease expiry;
- accepted/provider reference, safe error category, retry/reconciliation state, and audit-linked
  correlation identifiers.

## Freshness policies

| Policy | Selection | Expiry | Maximum automatic attempts | Behavior after expiry |
| --- | --- | --- | --- | --- |
| `conversation_response` | Normal owner conversational response | 24 hours | 3 | Becomes terminal; no late reconnect send. |
| `time_sensitive_reminder` | Canonical reminder delivery | 15 minutes | 2 | Becomes terminal or requires a new reminder evaluation. |
| `critical_alert` | Explicit canonical critical intent | 10 minutes | 1 | No automatic retry after uncertainty; an explicit escalation/reconciliation policy must decide next action. |

These are server-derived values stored with the delivery. A transport silence or a computer
coming online later never implies completion, consent, or freshness.

## Lease protocol

1. The local bridge receives an opaque pending signal while connected.
2. Vercel atomically changes a fresh, eligible row from `pending`/retryable to `leased`, increases
   attempts, and stores bridge ID, lease token, and a 120-second lease expiry.
3. Only after that guarded update succeeds does Vercel join canonical message data and return the
   private delivery intent to that authenticated bridge.
4. The result callback must match owner, delivery ID, bridge ID, lease token, and unexpired lease.
5. Accepted results move to `sent`; terminal/not-configured results move to terminal failure;
   safe retryable results receive a bounded canonical `availableAfter` time and an opaque retry
   signal.

Two bridge requests cannot both satisfy the conditional update. A repeated signal only sees
`unavailable`, `already_handled`, or `expired` until canonical state changes.

## Expiry and reconciliation

| Situation | Canonical result | Automatic resend? |
| --- | --- | --- |
| Delivery expired before lease | `failed_terminal` / `delivery_expired` | No. |
| Bridge lease expires with no result | retryable plus `requiresReconciliation=true` | No; a potential provider send is unknown. |
| Result arrives after lease expiry | reconciliation-required / lease-expired | No. |
| Explicit retryable provider result with no uncertainty | bounded retry schedule | Yes, only while fresh and under attempt limit. |
| Provider exception after a possible send | reconciliation-required | No. |
| Terminal provider failure or missing transport configuration | terminal | No. |

This deliberately does not invent completion from silence. A critical alert’s post-expiry handling
is a future explicit policy decision, not an implicit late WhatsApp send.

## Offline and reconnect behavior

When local Evolution is offline, degraded, or unconfigured, the bridge keeps the content-free
signal pending and sends no request for private content. On reconnect it requests a fresh Neon
lease. The expiration and availability checks occur at that time, so a reminder cannot be revived
hours later merely because the computer restarted.

If Convex is down, canonical Neon state remains correct; a callback receives a safe unavailable
result and can be replayed. If Neon is down, Vercel returns a safe `503` and the bridge sends
nothing. If Evolution is down, the bridge reports an explicit safe failure; it never claims a
message was sent.
