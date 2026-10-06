---
title: "Maintain explicit versioned runtime prompt assemblies."
document_id: ".agents::skills::runtime-prompts::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "runtime_prompt_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "runtime-prompts"
description: "Maintain explicit versioned runtime prompt assemblies."
version: "5.0.0"
---

# Purpose

Maintain explicit versioned runtime prompt assemblies.

## Scope and handoff

Primary role: `runtime_prompt_engineer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Read PROMPT_REGISTRY and inject shared invariants through the compiler.
2. Keep source status draft until actual runtime migration.
3. Version content changes and validate size across full assemblies.
4. Run whole-assembly behavioral evals and preserve content fingerprints.

## Read
- `docs/architecture/PROMPT_ARCHITECTURE.md`
- `docs/missions/BRAIN_EVALS.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
