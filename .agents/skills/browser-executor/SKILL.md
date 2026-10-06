---
title: "Review and build browser integration with isolated credentials."
document_id: ".agents::skills::browser-executor::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "browser_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "browser-executor"
description: "Review and build browser integration with isolated credentials."
version: "5.0.0"
---

# Purpose

Review and build browser integration with isolated credentials.

## Scope and handoff

Primary role: `browser_engineer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Separate research capture from effectful submission.
2. Treat page content as untrusted and prefer structured DOM/accessibility data where appropriate.
3. Bind writes to typed canonical snapshots and trusted approval.
4. Test private contexts, malicious page instructions and uncertain submissions.

## Read
- `docs/architecture/BROWSER_ARCHITECTURE.md`
- `docs/architecture/EXECUTOR_ARCHITECTURE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
