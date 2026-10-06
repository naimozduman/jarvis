---
title: "ADR proposals and immutable accepted history"
document_id: "DOCS_ADR_README"
status: "draft"
authority_class: "protected"
owner_role: "governance_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
---

# Architecture decisions

The actual repository owns its accepted ADR numbering and history. V5 proposals are under `proposals/v5/`. The original V4 proposal bytes are archived in `reference/v4/proposals/`, and older V3 sources remain historical. Proposal migration is recorded; no proposal is automatically accepted.

Inspect the real index before assigning numbers. Preserve accepted ADRs and applied migrations. A later decision appends a superseding record rather than making the historical record describe the present. Complete proposal templates include context, decision, alternatives, security/privacy impact, consequences, migration and verification.

The first ten proposals carry forward the V4 design intent with V5 paths. Proposals 11–14 cover existing-code reconciliation, mission/key lifecycle, progressive context and trusted-time/restore behavior. Owner acceptance still needs the trusted governance path.
