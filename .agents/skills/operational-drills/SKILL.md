---
title: "Verify enabled controls with safe external staging drills."
document_id: ".agents::skills::operational-drills::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "release_operator"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "operational-drills"
description: "Verify enabled controls with safe external staging drills."
version: "5.0.0"
---

# Purpose

Verify enabled controls with safe external staging drills.

## Scope and handoff

Primary role: `release_operator`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Use synthetic accounts and an externally controlled drill runner.
2. Test individual domains, queued jobs, offline devices and in-flight effects.
3. Measure propagation, preserve read-only inspection and restore safely.
4. Record exact environment/commit/verifier/evidence, never a self-checked claim.

## Read
- `docs/security/KILL_SWITCH_DRILLS.md`
- `docs/missions/EVALS_AND_ACCEPTANCE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
