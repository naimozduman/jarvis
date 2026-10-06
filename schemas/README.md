---
title: "Draft Contract Boundary"
document_id: "schemas::README"
status: "active"
authority_class: "orientation"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
---

# Do not replace active runtime contracts

schemas/drafts contains candidate design contracts. Each has explicit JSON Schema dialect, absolute identity, wire version, contract version and draft lifecycle. None is imported by application code through this pack.

The canonical registry is governance/SCHEMA_REGISTRY.json. Follow docs/SCHEMA_EVOLUTION.md before promotion. Trace actual packages/contracts imports rather than assuming the legacy JSON representation owns runtime validation.

Shape tests are in tests/contracts/fixtures. Semantic reference checks are in tools/jarvis-v5/reference_controls.py. They do not grant approval, resolve owner identity or implement database concurrency. The independent production enforcement path remains a later mission gate.

Model ActionIntent has no ownerId, approval, policy or idempotency authority. ProposedAction and ExecutionAuthorization are server-owned contracts. Required fields belong at the correct lifecycle stage.
