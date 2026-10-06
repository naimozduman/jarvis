---
title: "Artifact retirement and removal"
document_id: "DOCS_ARTIFACT_LIFECYCLE"
status: "active"
authority_class: "protected"
owner_role: "governance_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Artifact retirement and removal

File count is not the objective. Every retained artifact needs a purpose, lifecycle and consumer. `governance/ARTIFACT_REGISTRY.json` is generated inventory with lifecycle and ownership. `governance/RETIREMENTS.json` records explicit retirement proposals and lineage, not arbitrary inferred deletions.

Lifecycle: draft, active, generated, deprecated, superseded, retired, historical. An active requirement or consumer prevents removal of its source. Generated outputs may be regenerated from their canonical source. Historical accepted ADRs, migrations and incident/progress records are preserved according to the existing immutable-history policy. Research archives remain evidence, not automatically active instructions.

Before removal: identify exact path/hash, reason, known consumers, successor if any, migration evidence and retention constraints. Update consumers first. Run link/schema/prompt/mission validation and the mapped code tests. A text search is useful discovery, not complete dynamic-loader analysis. The trusted reviewer must attest that the consumer inventory is complete for the change.

`retirement.py` performs data checks and returns eligible_for_proposal or blocked. It deletes nothing. Only a reviewed source change removes a file. The promotion gate still protects the diff. Lack of a registry entry blocks removal review instead of treating the artifact as junk.

V5 removes old pack mission/runtime entry notices because the new namespace has explicit relocation lineage. This does not delete matching files from the actual repository. Integration planning lists those as manual retirement candidates. Active app prompt/schema sources remain unchanged until their implementation migration.
