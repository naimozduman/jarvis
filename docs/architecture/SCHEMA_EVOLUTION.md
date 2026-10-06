---
title: "Contract lifecycle and compatibility"
document_id: "DOCS_SCHEMA_EVOLUTION"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Contract lifecycle

Pack version 5.0.0 is not a runtime wire version. `schemas/drafts/` retains 15 reviewed draft contracts with stable IDs and their existing 1.0.0-draft contract versions. Moving a file does not activate or supersede the six existing repository runtime schemas.

`governance/SCHEMA_REGISTRY.json` is the contract registry. Status moves through draft, migrating, active, deprecated and retired under protected review. Each transition names producers, consumers, compatibility behavior, migrations and evidence. No adoption status comes from a folder or a self-edited frontmatter field.

## Change procedure

1. Identify the owning requirement, exact schema ID/version and current producers/consumers. Distinguish model-visible intent from server-owned action/authorization.
2. Record changes to JSON Schema, TypeScript contracts, storage, producer, consumer, runtime prompt, generated preview, skill, templates, fixtures, evals and documentation. A missing impacted class needs an explicit reason.
3. Test old-reader/new-writer and new-reader/old-writer behavior where coexistence is required. Unknown fields, absent required fields and enum additions need explicit compatibility semantics.
4. Use expand/contract storage changes and reviewed backfills. Keep the old active schema until consumers are ready. Do not loosen validation globally during a migration.
5. Promote with exact source/artifact evidence and update the registry. Activate the implementation through the deployment gate, not the pack generator.
6. Deprecate old producers with an explicit migration window, then retire only after consumer evidence. Accepted historical records remain interpretable.

Semantic JSON Schema compatibility is not proven by a hash or a required-field test. The supplied tools validate metadata, references, fixtures and version changes. Actual integration tests remain necessary. The active runtime contract types in the real repository take precedence for currently running code until an accepted migration changes them.
