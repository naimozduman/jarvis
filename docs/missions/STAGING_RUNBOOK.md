---
title: "Staging Runbook V5"
document_id: "docs::STAGING_RUNBOOK"
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

# Before

1. review `CURRENT_IMPLEMENTATION.md`,
2. confirm target commit/branch,
3. confirm migration status,
4. verify secret names without printing values,
5. keep Evolution/model writes disabled unless the test requires them.

## Core smoke

- liveness,
- readiness,
- Neon read/write using synthetic fixture,
- Convex callback,
- duplicate callback,
- stale generation,
- cancellation,
- expiry.

## Brain smoke

When authorized:
- one structured request,
- schema valid,
- manifest evidence valid,
- cost receipt present,
- replay returns same canonical decision without duplicate model/action.

## WhatsApp smoke

Only after gate:
- dedicated JARVIS number,
- owner direct message,
- rejected non-owner fixture,
- canonical inbound,
- Brain response,
- outbound lease,
- one send,
- provider result,
- reconnect/expiry scenario.

## After

Record results and date. Remove temporary credentials/fixtures where required. Do not leave broad debug logging enabled.

## V5 required gate additions
Before any enabled writer, execute KILL_SWITCH_DRILLS against synthetic staging records and the actual deployed dispatch path. Verify policy epoch revocation and reconciliation after partial completion. Record one release evidence file per commit/environment with verifier, time, result and artifact references. Live probes require current provider observations; old healthy snapshots are not proof.
