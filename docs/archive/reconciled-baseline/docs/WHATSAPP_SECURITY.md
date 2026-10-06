# WhatsApp transport security

## Admission policy

Only a verified direct message that resolves to the configured owner identity may reach the Brain in V1. The adapter records a redacted rejection for unknown or malformed senders; group, broadcast/newsletter, and status traffic; unresolved LID identities; sender/owner mismatch; outbound echoes; malformed events; unsupported interactive/payment content; and protocol, placeholder, resend, history-sync, or system messages.

Rejected events do not create a Brain request, memory candidate, commitment, plan, reminder, or tool action. The `messaging_identity_aliases` table is an explicit future approved-contact extension but does not widen the V1 owner-only rule.

An enabled webhook composition must supply the canonical rejected-event recorder. If an untyped
runtime composition omits that required audit sink, the route fails closed as not configured rather
than accepting traffic whose rejection would be unauditable.

## Defense in depth for CVE-2026-48063

Even with a patched Baileys version, JARVIS treats Evolution/Baileys input as untrusted transport data. It requires the patched dependency gate, a per-instance authenticated callback, owner allowlisting, opaque trusted idempotency references, and explicit rejection of protocol/history classes. History sync is explicitly tagged as `history_sync`, never considered a real-time owner command, and rejected before canonical ingress. It cannot create commitments, memory, actions, or autonomous work.

No received message—delivered, read, absent, or otherwise—proves completion of a commitment. Provider observation also cannot silently edit an active constitution item or turn a hypothesis into a fact.

## Secrets and sensitive material

Never log, commit, screenshot, or send to a model:

- Evolution API key or webhook signing material.
- Baileys session/auth files, pairing QR/code, instance token, or Evolution infrastructure DB.
- Raw provider payloads, raw JIDs/phone numbers, media bytes, or full message bodies in telemetry.
- Real health, finance, private conversation, onboarding, or prompt/response material.

Canonical records use opaque references. Safe telemetry records only transport/event type, hashed provider reference, normalized message type, state, latency, retry count, and safe error category. Raw debug retention is not implemented; it is disabled by default rather than quietly retained.

## Outbound restrictions

The model supplies no phone number, JID, Evolution endpoint, or credential. It cannot call the transport. A response/reminder must be persisted first, then pass a deterministic owner-only policy that checks target binding, verified owner conversation, kill switch, version gate, connection, quiet mode, and critical bypass. General third-party `external.message.send` remains high impact and approval-gated.
