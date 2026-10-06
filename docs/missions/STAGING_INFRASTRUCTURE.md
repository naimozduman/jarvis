---
title: "Staging Infrastructure"
document_id: "docs::STAGING_INFRASTRUCTURE"
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

# Staging goal

Prove the real architecture with synthetic or minimally sensitive data before production authority widens.

## Components

- staging Vercel API,
- staging Neon database/runtime role,
- Convex development/staging orchestration,
- optional operator-owned local bridge,
- disabled-by-default Evolution until version gate passes,
- explicitly configured model route only for authorized probes.

## Boundaries

- staging secrets differ from production,
- no primary personal WhatsApp account,
- no raw production data copy,
- no production executor authority,
- synthetic events are clearly tagged,
- readiness distinguishes database/orchestration/model/transport.

## Evidence

Store safe smoke results in progress docs or CI artifacts. Deployment-specific secret values stay outside Git.
