---
title: "Integrate bounded worker runtimes without delegating Core authority."
document_id: ".agents::skills::agent-runtime::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "agent_runtime_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "agent-runtime"
description: "Integrate bounded worker runtimes without delegating Core authority."
version: "5.0.0"
---

# Purpose

Integrate bounded worker runtimes without delegating Core authority.

## Scope and handoff

Primary role: `agent_runtime_engineer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Bind jobs to generation, owner, capability and finite resource envelope.
2. Return normalized outcomes, never framework-owned truth.
3. Connect stuck/repetition detection to resource admission.
4. Test restart, cancellation, uncertain effects and expiring delegation.

## Read
- `docs/agents/AGENT_RUNTIME.md`
- `docs/agents/MULTI_AGENT_ARCHITECTURE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
