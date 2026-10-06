---
title: "Maintain the dedicated-account WhatsApp bridge boundary."
document_id: ".agents::skills::evolution-whatsapp::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "integration_specialist"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "evolution-whatsapp"
description: "Maintain the dedicated-account WhatsApp bridge boundary."
version: "5.0.0"
---

# Purpose

Maintain the dedicated-account WhatsApp bridge boundary.

## Scope and handoff

Primary role: `integration_specialist`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Reverify actual upstream advisory, version, license and image evidence.
2. Keep primary personal account unpaired and identify owner through enrollment.
3. Reject untrusted alias/history/protocol ingress.
4. Test uncertain sends, expiry, reconnect and notification-only high-impact approvals.

## Read
- `docs/integrations/EVOLUTION_VERSION_GATE.md`
- `docs/integrations/WHATSAPP_ARCHITECTURE.md`
- `docs/integrations/WHATSAPP_IDENTITY.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Retained detailed engineering guidance

Follow the current root authority and relevant V5 requirements when older wording differs.

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
