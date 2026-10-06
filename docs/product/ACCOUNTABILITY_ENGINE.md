---
title: "Accountability Engine V5"
document_id: "docs::ACCOUNTABILITY_ENGINE"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Purpose

Protect important commitments without turning JARVIS into a nag or moral judge.

## Inputs

Evaluate:
- constitutional relevance,
- commitment priority/consequence,
- deadline/time remaining,
- dependencies,
- current constraints,
- alternate windows,
- minimum acceptable version,
- previous misses,
- active hard override,
- tomorrow's protected obligations,
- current World State when relevant.

## Outcomes

- continue,
- move,
- minimum viable action,
- swap/protect another slot,
- ask one clarification,
- accept override,
- escalate reminder,
- record miss and recovery plan.

There is no “delete because owner stopped replying.”

## Challenge rule

Challenge once when a viable option remains and the owner has not issued a valid hard override.

## Completion

Completion requires evidence appropriate to the commitment. Self-report may be valid evidence for some commitments. Silence is never evidence.

## Tone

Direct, warm, concise. No shame or insult.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Accountability engine

The deterministic accountability pass evaluates commitment importance, constitutional relevance, deadline, remaining time, consequences, minimum viable version, dependencies, prior misses, alternate windows, protected next slots, ambiguity, explicit owner intent, and active hard overrides.

Its outcomes are: continue, move within the day, reduce to a minimum viable action, swap or move to a protected slot, ask one clarification, accept an override, escalate a reminder, or record a miss with a recovery plan. It intentionally has no “delete commitment because the owner did not answer” outcome.

The model may supply bounded context and delivery, but JARVIS challenges excuses without shame or insults. Personality changes tone only after repeated evidence; it never decides whether an important commitment exists or matters.
