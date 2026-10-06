---
title: "Staging Migration Workflow"
document_id: "docs::STAGING_MIGRATION_WORKFLOW"
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

Database changes should be reproducible, reviewed, and recoverable.

## Workflow

1. generate migration locally,
2. inspect SQL and metadata,
3. run schema/journal checks,
4. run migration-safety tests,
5. rehearse on disposable staging branch/database,
6. run focused integration tests,
7. record evidence,
8. obtain release approval when required,
9. apply with migrations-only credential,
10. verify schema and runtime readiness,
11. deploy compatible runtime,
12. rerun smoke scenarios.

## Expand/contract

For populated environments, prefer:
- add compatible fields/tables,
- deploy readers/writers,
- backfill/reconcile,
- switch behavior,
- remove obsolete fields in a later reviewed migration.

## Secrets

Migration tooling accepts only the explicit migrations credential. No fallback to application `DATABASE_URL`.

## Failure

Stop on mismatch. Do not “fix forward” by editing applied migrations. Create a new reviewed migration or restore the disposable environment.
