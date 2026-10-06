---
title: "Control Loop with Admission and Outcome State"
document_id: "docs::CONTROL_LOOP"
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

# One durable path

Trigger -> authenticate -> normalize -> persist -> deduplicate -> reserve resources -> recall -> plan -> policy -> authorize -> dispatch -> observe -> reconcile if uncertain -> verify -> remember -> respond.

Before paid inference, perform durable budget admission. Before any side effect, recheck identity, owner, capability, registry risk, scope, policy version, approval/finite lease, input snapshot, operation key, available budget and kill epoch. Admission after spending is accounting, not prevention.

Model intent does not contain execution authority. Models and agent workers emit proposals and evidence references only. The server creates canonical IDs and decides effects. Foreign source content never invokes the trusted resolver.

Job state, model-turn state, action state, delivery state and playback state remain distinct. Retries preserve operation identity. Cancellation after dispatch invokes reconciliation. Inferred or incomplete evidence cannot become verified completion. A late callback rehydrates current generation and expiry from Neon rather than replaying stale instructions.

Each stage records safe provenance and explicit failure/next recovery. Pending work remains durable when owner/provider/device is unavailable. Silence never manufactures successful outcome or renewed authority.
