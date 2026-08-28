---
name: jarvis-product-rules
description: Use for any JARVIS product behavior, planning, memory, accountability, reminders, permissions, personality, or cross-domain decision work. Do not use for generic infrastructure tasks with no product behavior.
---

# JARVIS product rules

Read `docs/PRD.md`, `docs/DECISION_ENGINE.md`, and the relevant ADR before changing behavior.

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
