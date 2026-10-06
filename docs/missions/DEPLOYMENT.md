---
title: "Deployment Architecture"
document_id: "docs::DEPLOYMENT"
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


# Active topology

- Vercel: stateless API, future web control center.
- Neon: canonical PostgreSQL.
- Convex: opaque scheduling/wakeup.
- owner-controlled local runtime: WhatsApp bridge/Evolution when enabled.
- external model providers: replaceable reasoning routes.

Historical Railway plans remain in repository history but are not the active target.

## Release separation

Prefer separate checkpoints for:
- documentation/architecture,
- schema migration,
- runtime code,
- provider configuration,
- transport pairing.

This makes rollback and audit easier.

## Order

For a schema/runtime change:
1. apply compatible migration,
2. verify,
3. deploy runtime,
4. reconcile/schedule required canonical rows,
5. run smoke,
6. monitor safe health metrics,
7. checkpoint.

## Rollback

Rollback code only when schema remains compatible. Do not reverse destructive migrations casually. Use forward repair when required.

## Secrets

Provider secret stores only. Never commit real values.

## Local executors

A cloud deployment does not automatically expose local device/WhatsApp/browser executors. They authenticate back to Core and receive scoped work.
