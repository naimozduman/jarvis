---
title: "Surfaces and Clients"
document_id: "docs::SURFACES_AND_CLIENTS"
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

A surface is a client of JARVIS Core. It does not become its own assistant.

## Surface classes

- WhatsApp
- web control center
- Android app
- browser
- desktop overlay
- watch
- realtime voice
- future iPhone

## Shared continuity

All surfaces resolve to:
- one owner,
- one canonical conversation ledger,
- one memory system,
- one permission model,
- one audit history.

A new surface may create a new presentation session, but it must not create a competing durable identity.

## Surface-local responsibilities

A surface may own:
- microphone/camera permission,
- display state,
- input buffering,
- local cache,
- offline queue,
- notification presentation,
- local privacy filtering.

It must not own:
- constitution,
- durable memory truth,
- action authority,
- long-term commitment state.

## Handoff

A user should be able to research in the browser, continue by WhatsApp, then ask by voice while driving without re-teaching JARVIS the project.
