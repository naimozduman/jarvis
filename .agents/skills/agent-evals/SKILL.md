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
