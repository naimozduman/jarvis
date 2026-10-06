---
title: "Life Ledger V5"
document_id: "docs::LIFE_LEDGER"
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

The Life Ledger answers “what happened?”

It is a normalized historical timeline, not a pile of permanent personal facts.

## Candidate event classes

- location/place episodes,
- travel segments,
- app/work sessions,
- music/media,
- workouts,
- meals,
- photos/media references,
- conversations/call summaries,
- calendar activity,
- purchases/bills,
- business sessions,
- JARVIS decisions/interventions.

## Sources

Events retain source references and confidence. Raw source data may remain in the originating app or local vault.

## Episodes

High-volume events are grouped into human-useful episodes and daily/monthly summaries.

## Promotion

Ledger history does not automatically become memory. Stable patterns become candidates through memory policy.

## Correction

Correct the source or ledger event with provenance. Regenerate derived episodes/summaries instead of leaving known false history.

## Privacy

Allow source-specific retention and sealed/private periods. Sensitive source access may require reauthentication.

## V5 replay and correction contract
Every derived event has a derivationKey bound to owner, source record/version set and derivation algorithm version. Enforce uniqueness in canonical persistence. Reprocessing the same sources returns the same logical event; a correction creates a new revision and supersedes affected projections. Store source coverage and sensitivity. Deletion/tombstones propagate to episodes, search and promoted memory. The key is not computed by the model.
