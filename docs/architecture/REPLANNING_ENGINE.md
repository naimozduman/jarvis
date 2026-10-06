---
title: "Replanning Engine V5"
document_id: "docs::REPLANNING_ENGINE"
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

# Goal

Replanning responds to reality without treating disruption as automatic failure.

## Plan data

Blocks carry:
- fixed/flexible/optional class,
- commitment link,
- duration/minimum duration,
- earliest/latest bounds,
- dependencies,
- travel/preparation,
- priority/consequence,
- completion/movement state,
- source and placement reason.

## Deterministic constraints

Code validates:
- owner/day scope,
- time ordering,
- windows,
- minimum duration,
- overlap,
- dependencies,
- protected anchors,
- travel/preparation.

Omitting a protected anchor never means delete it.

## Recovery order

1. protect fixed external anchors,
2. protect high-consequence commitments,
3. respect hard overrides,
4. recalculate remaining windows,
5. shrink/move flexible work,
6. drop optional work explicitly,
7. show tradeoffs.

## Model role

The model chooses/explains among valid options. It does not invent impossible scheduling space.

## State

Applied plan changes go through canonical action/policy/audit paths.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Replanning engine

The live-day model represents fixed blocks, hard external anchors, flexible/preferred/optional blocks, commitment-linked work, travel and preparation buffers, sleep/training windows, priority, duration, earliest/latest bounds, dependencies, completion state, source, and placement reason.

The model proposes a plan; `validatePlanConstraints` decides whether it can be applied. Validation rejects foreign owner/day-plan scope, duplicate IDs, missing half-windows, reversed times, window-bound violations, impossible minimum durations, missing dependencies, changed protected anchors, and overlapping scheduled blocks. Omitting a protected existing anchor means preserve it, never delete it.

`ReplanningEngine` evaluates valid options deterministically and states tradeoffs. An active hard override may guide flexible choices but never lets a proposal move an external hard anchor. A validated `internal.plan.update` action is applied only through the Domain policy and action transaction.
