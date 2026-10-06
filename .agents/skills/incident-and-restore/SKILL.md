---
title: "Contain incidents and restore canonical state"
document_id: "_AGENTS_SKILLS_INCIDENT-AND-RESTORE_SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "release_operator"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "incident-and-restore"
description: "Contain incidents and restore canonical state. Use for the corresponding review, implementation or recovery task."
version: "5.0.0"
---

# Contain incidents and restore canonical state

Use when the task concerns contain incidents and restore canonical state.

Lead: `release_operator`. Supporting specialists use the same exact registry names.

Read `AGENTS.md` first, then `docs/security/INCIDENT_RESPONSE.md`, `docs/security/DISASTER_RECOVERY.md`, `docs/missions/OPERATIONS_HEALTH.md`.

Contain admission before cleanup. Preserve evidence. Restore with writers off and a new epoch. Reconcile external effects rather than replaying them. Reenable a verified canary only under owner control.

## Evidence and stop

Record exact input hashes, commands, outputs, negative tests and limitations. Missing trusted prerequisites stop implementation, not a sanitized audit. Do not enable a provider or grant authority to make a check pass. The skill teaches a procedure; it is not permission.
