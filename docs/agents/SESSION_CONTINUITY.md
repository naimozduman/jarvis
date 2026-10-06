---
title: "One current handoff and preserved history"
document_id: "DOCS_SESSION_CONTINUITY"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# One current handoff

`governance/STATE.json` is the one mutable engineering handoff. It is descriptive only. It points to provider observations and the reconciliation map rather than duplicating their values. `docs/agents/WORKING_STATE.md` is a manually maintained navigation summary. It must agree with the descriptive handoff; it is not rendered by the current documentation manager. The full PRD and previous chat history are not the current mission state.

The adopted descriptive handoff uses stateVersion 2 and the current schema shown in STATE.json. Maintain it with ordinary reviewed file edits, compare the previous file hash before overwriting, and record command/evidence references and omitted checks. `tools/jarvis-v5/state.py` remains a reference for the original standalone version-1 schema and must not update the current handoff. Its cooperative local-lock design is retained for a future reviewed updater; it neither provides distributed consensus nor authenticates claims. A stale lock requires operator inspection.

Before the V5 convention is adopted, all reports go to approved scratch. After adoption, save branch/base/head, dirty files, command/evidence references, blockers and next safe step. Do not include secrets, raw personal messages or live connection strings.

Append milestone and incident evidence to the existing progress record structure. Preserve accepted old entries and migrations byte-for-byte. A newer handoff never retroactively edits history. A builder reports ready_for_verification. Only the independently trusted process issues mission completion and promotion evidence.
