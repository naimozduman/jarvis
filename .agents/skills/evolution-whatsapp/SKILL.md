---
name: evolution-whatsapp
description: Use when implementing, deploying, upgrading, debugging, or testing Evolution API, Baileys WhatsApp transport, QR pairing, inbound webhooks, outbound messages, media, LID identifiers, or channel recovery.
---

# Evolution WhatsApp transport

Treat Evolution API as replaceable transport. Never put product memory, planning, permissions, or personality inside it.

## Required design

- Use a dedicated JARVIS number, never the user's primary account.
- Run one Evolution replica for one instance.
- Pin a tested stable image digest. Do not deploy `latest` or a release candidate.
- Keep the Evolution database separate from Neon.
- Persist the session on a mounted volume.
- Authenticate inbound callbacks and restrict network exposure.
- Normalize every provider payload before domain processing.
- Build the idempotency key from provider instance, event type, and provider message identifier. Add a payload fingerprint fallback.
- Support phone-number and LID identifiers without assuming one stable JID format.
- Acknowledge the webhook quickly, enqueue processing, and return success before reasoning.
- Reconcile recent messages after reconnects and suspicious gaps.
- Track connection state, last inbound event, last outbound success, queue delay, and duplicate rate.
- Keep web and Telegram fallback paths operational.

## Upgrade workflow

1. Read upstream release notes and migration notes.
2. Review unresolved issues for webhooks, duplicates, sessions, and identifiers.
3. Test a backup restore and QR re-pair in staging.
4. Run inbound text, outbound text, voice, media, reconnect, restart, duplicate, and LID cases.
5. Promote manually.
6. Keep the previous image digest and rollback instructions.

## Forbidden shortcuts

- No direct model call from Evolution's built-in chatbot integrations.
- No product-state writes from raw webhook handlers.
- No multi-replica deployment against one Baileys session.
- No secrets in logs.
