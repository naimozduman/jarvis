---
title: "Build typed memory and source-backed reconstruction."
document_id: ".agents::skills::memory-and-context::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "memory_architect"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "memory-and-context"
description: "Build typed memory and source-backed reconstruction."
version: "5.0.0"
---

# Purpose

Build typed memory and source-backed reconstruction.

## Scope and handoff

Primary role: `memory_architect`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Keep epistemic state separate from sensitivity.
2. Normalize source facts and candidates with provenance and correction rules.
3. Use deterministic context selection with total-request bounds.
4. Test invalid references, old versions, deletion, contradictions and replay derivation.

## Read
- `docs/architecture/MEMORY_ENGINE.md`
- `docs/architecture/CONTEXT_ASSEMBLY.md`
- `docs/architecture/LIFE_LEDGER.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
