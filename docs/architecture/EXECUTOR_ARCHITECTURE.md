---
title: "Executor Contract and Dispatch State"
document_id: "docs::EXECUTOR_ARCHITECTURE"
status: "active"
authority_class: "protected"
owner_role: "executor_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Execute only a server-authorized exact operation

Every executor declares a capability and concrete executor manifest: input contract, risk, scope, credential-account boundary, idempotency semantics, operation expiry, reversibility, observe/verify/reconcile methods, kill domains and timeout. Missing declarations reject registration. MCP annotations and tool names are hints, not trusted policy.

## State machine

Proposed -> authorized -> reserved -> dispatch_started -> outcome_pending -> verified / failed / reconciliation_required. Cancellation before dispatch -> cancelled. Once dispatch starts, cancellation means cancel_requested unless the provider proves the write did not happen or supports confirmed cancellation. The result record is never discarded when speech or an agent turn ends.

Before dispatch reload owner, exact payload revision/hash, capability version, approval/finite lease, policy, resource reservation and kill epoch. Atomically acquire the execution lease/operation key. A stale worker cannot finalize a newer attempt. Exactly-once external effects are not assumed; use provider idempotency where supported and reconciliation where not.

## Stop path

Kill activation increments an epoch and blocks new dispatch/lease acquisition. Do not destroy observation credentials needed to reconcile already-started operations. Cloud admin and local bridge stop paths are independent of chat. Cached authority expires quickly and cannot resume after a revoked epoch. Target propagation time is a measured release requirement, not a promise from this document.

## Voice interruption

VOICE_ARCHITECTURE separates playback cancellation, model cancellation and action cancellation. Stop speech immediately. Stop undispatched work. Reconcile already-dispatched effects and report their true status after interruption. Never report 'cancelled' merely because the model stream closed.

## Isolation

Credentials are opaque handles resolved only by the adapter. Raw credentials never reach models, prompts, screenshots or ordinary logs. Browser automation uses a separate constrained context; logged-in browsing is not permission to submit. Shell executors require command/resource allowlists and do not inherit repository/admin secrets.

## Acceptance

Prove tampered snapshot, replay, expired identity/approval/lease, cross-owner access, revoked kill epoch, concurrent lease use, provider timeout after acceptance, late worker result and barge-in after dispatch. Tests must traverse actual production composition before a capability is enabled.
