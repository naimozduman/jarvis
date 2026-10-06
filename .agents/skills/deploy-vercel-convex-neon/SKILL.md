---
title: "Verify and release current deployment architecture."
document_id: ".agents::skills::deploy-vercel-convex-neon::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "release_operator"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "deploy-vercel-convex-neon"
description: "Verify and release current deployment architecture."
version: "5.0.0"
---

# Purpose

Verify and release current deployment architecture.

## Scope and handoff

Primary role: `release_operator`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Lead environment/release order. Hand migration correctness to database-and-jobs.
2. Use authorized read tools and record exact immutable deployments and freshness.
3. Keep runtime and migration credentials separate.
4. Run actual-path smoke, rollback rehearsal and enabled-domain stop drills.

## Read
- `docs/missions/DEPLOYMENT.md`
- `docs/missions/STAGING_RUNBOOK.md`
- `docs/security/KILL_SWITCH_DRILLS.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
