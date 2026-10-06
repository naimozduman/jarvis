---
title: "Neon Staging"
document_id: "docs::NEON_STAGING"
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

# Role

Neon/PostgreSQL is canonical durable state for JARVIS Core.

Staging must exercise the same schema and lifecycle semantics without copying unnecessary private production data.

## Credentials

Separate:
- runtime pooled credential,
- migrations credential,
- database integration-test credentials.

Do not reuse a migration credential as an application runtime credential.

## Migrations

Use reviewed forward migrations. Rehearse against disposable branches/environments before release.

Never infer a successful migration from generated SQL alone. Verify schema and critical invariants.

## Testing

Database integration tests should cover:
- idempotency uniqueness,
- leases/concurrency,
- job generation,
- expiry,
- append-only audit behavior,
- approval/action snapshot constraints,
- migration safety.

## Staging data

Use synthetic owner fixtures when possible. Do not clone raw intimate/health/finance data merely for convenience.

## Operational facts

Current project IDs, branches, and migration levels belong in `CURRENT_IMPLEMENTATION.md` or protected operator records.
