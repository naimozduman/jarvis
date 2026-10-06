---
title: "Reconcile existing JARVIS code"
document_id: "_AGENTS_SKILLS_REPOSITORY-RECONCILIATION_SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "architecture_planner"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "repository-reconciliation"
description: "Reconcile existing JARVIS code. Use for the corresponding review, implementation or recovery task."
version: "5.0.0"
---

# Reconcile existing JARVIS code

Use when the task concerns reconcile existing jarvis code.

Lead: `architecture_planner`. Supporting specialists use the same exact registry names.

Read `AGENTS.md` first, then `docs/missions/REPOSITORY_RECONCILIATION.md`, `governance/RECONCILIATION.json`.

Inventory actual source and dirty work. Classify each subsystem with evidence. Preserve active interfaces and tests. Make one bounded migration/repair proposal. Never infer deployment state from a pack file.

## Evidence and stop

Record exact input hashes, commands, outputs, negative tests and limitations. Missing trusted prerequisites stop implementation, not a sanitized audit. Do not enable a provider or grant authority to make a check pass. The skill teaches a procedure; it is not permission.
