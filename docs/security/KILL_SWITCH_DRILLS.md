---
title: "Independent Stop Paths and Drills"
document_id: "docs::KILL_SWITCH_DRILLS"
status: "active"
authority_class: "protected"
owner_role: "release_operator"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Stop new effects, reconcile existing ones

The V3 nine-domain list is a design requirement, not proof of nine implemented switches. The existing generic policy kill check is retained. J5-M18 must wire every enabled executor to its actual kill domains before release.

## Paths

Provide an authenticated first-party stop control backed by an independent admin path, plus a local bridge/process stop reachable without WhatsApp or the model. A public secret URL is not an acceptable kill control. An env-var flip that requires redeployment is not presumed immediate. Measure propagation and test outages.

Use durable stop state with monotonic epoch. New dispatch checks epoch immediately before the side effect. Leases and queued work from older epochs do not regain authority after restart. Keep safe read-only inspection and outcome reconciliation available. Revoking a send credential must not erase the evidence needed to resolve an uncertain send.

## Drill matrix

Test global stop and each enabled domain separately: proactive delivery, model work, executor dispatch, connector ingestion, finance observation, health ingestion, WhatsApp send, Night Mode and device control. Also test partial states, an offline bridge, a queued action, stale cached lease, already-dispatched effect and unavailable Core.

Externally orchestrated staging drills use synthetic accounts/data and a tested restore path. Audit trigger, actor, scope, old/new epoch, measured propagation, forbidden effects count, reconciliation and restoration. Run before each affected release. Monthly drill cadence is a proposed operational policy after external writers exist. Absence of required fresh drill evidence blocks enabling that writer.

The drill runner must not depend on JARVIS's own scheduler or transport. Never schedule unapproved destructive production drills. A report with a passed checkbox is not a drill.
