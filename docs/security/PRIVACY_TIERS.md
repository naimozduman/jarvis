---
title: "Privacy Tiers"
document_id: "docs::PRIVACY_TIERS"
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

Use local/private processing where it meaningfully reduces exposure, while retaining hosted reasoning where it materially improves JARVIS.

“Fully local” is not a product purity test.

## Locality classes

### local_only
Raw data never leaves an owner-controlled device/server except encrypted backup explicitly configured by the owner.

Examples may include raw wake-word audio buffers, selected intimate archives, credential material.

### cloud_allowed
Data may go to reviewed cloud processors for a defined purpose.

### memory_allowed
Derived content may be promoted into JARVIS memory under memory policy.

### ephemeral
Use for a current task, then delete after a short retention period.

### restricted
Needs additional purpose, policy, or reauthentication before access.

### shareable_with_approval
May leave the private system only after explicit approval.

## Preferred pattern

Local capture/filtering -> bounded normalization -> retrieve minimum necessary context -> hosted reasoning if selected -> canonical result.

## Raw versus derived

A raw source may remain local while Core stores:
- source reference,
- timestamp,
- bounded summary,
- extracted commitment,
- confidence,
- retention metadata.

## Retention

High-volume raw sensor/media data should have shorter configurable retention than compressed episodes, important events, confirmed memory, and journal entries.

## Cloud TTS/STT

Redact secrets before cloud speech services. Realtime voice may use cloud processing when the owner accepts the tradeoff, but wake detection and privacy gating should remain local where practical.

## Independent classification dimensions

Locality, sensitivity, retention and eligibility for memory promotion are separate dimensions. The historical names above are policy tags, not one mutually exclusive enum. For example, a restricted source may remain local-only while a separately authorized redacted summary is cloud-allowed. Memory eligibility never overrides local-only egress. A connector must resolve the intersection of these controls before retrieval, embedding, reasoning or speech output.
