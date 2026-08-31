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
