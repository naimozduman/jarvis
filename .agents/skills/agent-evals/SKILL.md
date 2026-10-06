---
title: "Design tests and judgment evaluations with incident linkage."
document_id: ".agents::skills::agent-evals::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "test_evals"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "agent-evals"
description: "Design tests and judgment evaluations with incident linkage."
version: "5.0.0"
---

# Purpose

Design tests and judgment evaluations with incident linkage.

## Scope and handoff

Primary role: `test_evals`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Map invariant IDs and actual execution paths.
2. Separate shape, policy, safety, recovery and judgment cases.
3. Protect existing expected-denial fixtures and mark live probes distinctly.
4. Record exact commit, suite, fixture/prompt versions and result artifact.

## Read
- `docs/missions/EVALS_AND_ACCEPTANCE.md`
- `docs/missions/BRAIN_EVALS.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Retained detailed engineering guidance

Follow the current root authority and relevant V5 requirements when older wording differs.

---
name: agent-evals
description: Use when adding or changing runtime prompts, decision schemas, model routing, tool behavior, memory extraction, planning, accountability, or safety policies. Also use for regression investigation.
---

# Agent evaluation workflow

## Evaluate behavior, not prose

Grade:

- Valid structured output.
- Correct source evidence.
- Correct decision hierarchy.
- Required or forbidden tool calls.
- Approval creation.
- State changes.
- Follow-up scheduling.
- Memory classification.
- Uncertainty handling.
- Audit trace completeness.

Do not grade exact wording unless a channel or policy requires specific text.

## Minimum case matrix

- Normal reminder.
- Ghosted commitment.
- Weak excuse.
- Valid hard override.
- Fixed-event conflict.
- Poor recovery with an important training goal.
- Missing evidence.
- Conflicting provider records.
- Prompt injection inside email.
- Duplicate webhook.
- Stale finance data.
- Forbidden money movement.
- External-message approval.
- Memory hypothesis that must not become fact.
- Quiet mode with a critical deadline.

## Regression process

1. Reproduce the issue with a synthetic fixture.
2. Capture the old trace and failure.
3. Make the smallest prompt, policy, retrieval, or schema change.
4. Run the full safety set plus the focused case.
5. Compare cost, latency, and tool behavior.
6. Store the result and decision in `evals/results` or the configured evaluation store.
