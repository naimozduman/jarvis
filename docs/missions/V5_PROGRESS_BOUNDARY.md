---
title: "Progress and Session Evidence"
document_id: "docs::progress::README"
status: "active"
authority_class: "evidence"
owner_role: "release_operator"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

Preserve all existing milestone and investigation entries byte-for-byte. Add a dated milestone record for a completed reviewed gate or meaningful incident investigation. Ordinary session continuity lives in governance/STATE.json and its generated docs/agents/WORKING_STATE.md view.

Each progress record names exact source commit, environment, commands, outcomes, limitations and evidence references. Readiness claims expire with the observed deployment, not with the prose file. Never store secrets, raw private conversations or real health/finance fixtures.

Templates: templates/v5/session-handoff.json, templates/v5/mission-run.json and templates/release-record.json. A newly written record is a claim until independently verified; it does not grant approval or complete a roadmap mission by itself.
