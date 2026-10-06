---
title: "Preserve product invariants without duplicating security policy."
document_id: ".agents::skills::jarvis-product-rules::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "jarvis-product-rules"
description: "Preserve product invariants without duplicating security policy."
version: "5.0.0"
---

# Purpose

Preserve product invariants without duplicating security policy.

## Scope and handoff

Primary role: `architecture_planner`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Own product intent and user experience, not security implementation review.
2. Reference canonical invariant IDs and accepted PRD decisions.
3. Keep goals, observations, moods, plans and actual outcomes distinct.
4. Hand threats/credentials/authorization to security-and-privacy.

## Read
- The selected requirement IDs from `governance/PRODUCT_SPEC.json`; consult the relevant `docs/product/JARVIS_PRD_V5.md` section only when product scope changes, not the entire file on every task.
- `docs/security/DOCUMENTATION_GOVERNANCE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Retained detailed engineering guidance

Follow the current root authority and relevant V5 requirements when older wording differs.

---
name: jarvis-product-rules
description: Use for any JARVIS product behavior, planning, memory, accountability, reminders, permissions, personality, or cross-domain decision work. Do not use for generic infrastructure tasks with no product behavior.
---

# JARVIS product rules

Read `CODEX_START_HERE.md`, follow `CODEX_START_HERE.md`, and read the relevant accepted
ADR before changing behavior. `docs/product/JARVIS_PRD_V5.md` owns current V5
requirements; `docs/architecture/DECISION_ENGINE.md` owns compatible decision-engine
contracts. Archived earlier PRDs/plans supply historical context. Current explicit
owner decisions resolve conflicts. See
`docs/INDEX.md` for evidence and authority boundaries.

## Non-negotiable invariants

- Behavior changes intervention tactics. It never silently rewrites constitutional goals.
- No response never means completion.
- Fixed external commitments outrank flexible work.
- Safety, security, legal limits, and permissions outrank user convenience.
- An explicit hard override is accepted after consequences are explained, unless a safety or permission boundary blocks it.
- Hypotheses stay separate from facts.
- Important automated decisions include a concise reason and supporting evidence.
- High-impact actions require approval.
- The system never invents source data.
- Every state-changing action is auditable and idempotent.

## Implementation workflow

1. Identify the affected domain objects and source of truth.
2. Define the triggering event and required context.
3. Define deterministic policy checks before model reasoning.
4. Define the structured decision output.
5. Define permitted tools and approval requirements.
6. Define state changes, follow-ups, and audit records.
7. Add success, conflict, ghosting, stale-data, and hard-override tests.

## Stop conditions

Stop and ask for a product decision when a change would alter the constitution hierarchy, permit autonomous external communication, permit money movement, weaken deletion, or turn an AI hypothesis into authoritative state.
