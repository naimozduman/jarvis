---
title: "Promote wire contracts without prose/import drift."
document_id: ".agents::skills::schema-evolution::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "schema-evolution"
description: "Promote wire contracts without prose/import drift."
version: "5.0.0"
---

# Purpose

Promote wire contracts without prose/import drift.

## Scope and handoff

Primary role: `architecture_planner`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Trace active producers and consumers before touching schemas.
2. Separate architecture generation from contract wire version.
3. Map schema, types, migrations, prompts, skills, templates, fixtures and telemetry.
4. Prove compatibility and promotion evidence; keep drafts out of active imports.

## Read
- `docs/architecture/SCHEMA_EVOLUTION.md`
- `docs/architecture/DATA_MODEL.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
