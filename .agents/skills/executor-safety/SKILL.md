---
title: "Implement exact authorized side effects and reconciliation."
document_id: ".agents::skills::executor-safety::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "executor_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "executor-safety"
description: "Implement exact authorized side effects and reconciliation."
version: "5.0.0"
---

# Purpose

Implement exact authorized side effects and reconciliation.

## Scope and handoff

Primary role: `executor_engineer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Validate complete executor registration, not only capability names.
2. Reload owner, action snapshot, policy, authority, expiry, budget and stop epoch at dispatch.
3. Preserve operation keys across retries.
4. Test late result, revoked lease, concurrent use and timeout-after-acceptance.

## Read
- `docs/architecture/EXECUTOR_ARCHITECTURE.md`
- `docs/security/APPROVAL_MODEL.md`
- `docs/security/KILL_SWITCH_DRILLS.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
