---
title: "World State"
document_id: "docs::WORLD_STATE"
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

World State represents what is true right now or recently enough to matter.

It is intentionally separate from long-term memory and historical Life Ledger.

## Examples

- current location/place class,
- travel/driving state,
- local time/weather context,
- current calendar block,
- foreground app/category,
- device lock/battery/connectivity,
- headphones/media,
- active workout,
- current task/session,
- device availability.

## Expiry

Every world-state value has freshness/expiry. Stale state is not silently treated as current.

## Local processing

High-volume device signals should be filtered locally. Core receives decision-relevant state, not an endless raw sensor stream.

## Promotion

A world-state item becomes a Life Ledger event only under retention rules. Repeated events may support a memory candidate, but not automatically.

## Conflict

Multiple device sources may disagree. Store source and freshness and expose conflict rather than choosing silently.
