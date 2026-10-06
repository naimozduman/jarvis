---
title: "Operate protected-promotion and evidence boundaries."
document_id: ".agents::skills::governance-enforcement::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "governance_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "governance-enforcement"
description: "Operate protected-promotion and evidence boundaries."
version: "5.0.0"
---

# Purpose

Operate protected-promotion and evidence boundaries.

## Scope and handoff

Primary role: `governance_reviewer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Load rules and verifier from the trusted base or external checkout.
2. Read candidate files as data, never execute under privileged identity.
3. Require exact-head owner signature for protected diffs.
4. Demonstrate checker tampering and changed-head rejection; distinguish local check from deployed protection.

## Read
- `docs/security/TRUST_BOOTSTRAP.md`
- `docs/security/DOCUMENTATION_GOVERNANCE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Current installation boundary

Exact-head signatures and independent promotion apply to the future installed trusted-gate path. Imported policies, example workflows and tools are currently reference designs with no enrollment evidence. The direct owner-authorized supervised documentation reconciliation proceeds under root authority without claiming a signed mission or promotion receipt. Do not treat the uninstalled example gate as a new approval blocker.
