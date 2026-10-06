---
title: "Media Pipeline V5"
document_id: "docs::MEDIA_PIPELINE"
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

# Principle

Raw media is large, sensitive, and expensive. JARVIS should ingest it deliberately.

## Pipeline

`source -> metadata -> local classification/filtering when feasible -> bounded extraction -> canonical source reference -> optional deeper analysis`

## Media classes

- images/photos,
- screenshots,
- audio/voice notes,
- call recordings where lawful/consented,
- video,
- PDFs/documents,
- attachments.

## Metadata first

Store useful metadata and source references before spending model tokens on raw content.

## Derived records

Analysis results include:
- source reference,
- model/tool version,
- timestamp,
- confidence,
- sensitivity,
- extraction purpose.

## Retention

Raw high-resolution data may have shorter retention than derived summaries or Life Ledger episodes.

## Sensitive sources

Relationship communications and calls may remain in dedicated encrypted archives with only bounded summaries in Core.

## Reprocessing

Keep enough provenance to re-run extraction with a better model without pretending the old result was a source fact.
