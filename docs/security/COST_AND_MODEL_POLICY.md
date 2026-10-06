---
title: "Budget Admission and Model Routing"
document_id: "docs::COST_AND_MODEL_POLICY"
status: "active"
authority_class: "protected"
owner_role: "backend_implementer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Spend requires admission before work

The existing repository has a ModelBudgetGuard. Preserve it. V5 does not claim budgets are absent because source is outside this overlay. J5-M02 classifies the subsystem and J5-M05 traces every caller and the actual accounting source, including concurrency and process restarts.

## Owner decision versus proposal

A prior owner conversation mentioned an initial $50 AI budget. The $60 plan in earlier assistant replies was not approved. governance/OWNER_DECISIONS.json preserves these distinctions. templates/v5/policies/runtime-budget.proposed.json offers a $50 monthly / $5 daily / $1 default-job profile and a $2 optional-analysis confirmation threshold. They are proposals. `enabled` is false and `ownerApprovalRef` is null. No .env overwrite is included.

## Required admission contract

Use integer USD micro-units. Atomically reserve the conservative upper bound across job, daily, monthly and provider budgets before each metered call. All concurrent workers share durable reservation state. Include retries, background jobs, voice/STT/TTS and tool charges. Monthly period uses an explicit billing timezone; owner-local quiet-hour policy is separate. An upper bound needs a verified rate card and provider-specific accounting semantics.

Settle reservations with exact receipt or conservatively retained maximum. Unknown cost is not zero. Requests with unknown outcomes retain reservations until reconciliation. Do not blindly release after timeout or restart. Reject new paid work if no safe bound or reconcilable receipt exists. Provider-side limits are defense in depth; verify whether they halt or only alert.

## Exhaustion

At the hard cap reject new paid calls, preserve durable work and defer nonurgent jobs. A deterministic status response and explicitly approved non-billable route may remain available if privacy and capability requirements hold. No paid fallback, top-up, secret budget edit or weakened receipt requirement. Re-evaluate stale jobs before resuming.

The proposed warning levels are 70% and 90%; 100% is an admission boundary. They are UX defaults, not evidence of cost saved. Productive heavy use and repeated no-progress retries are separate conditions.

## Runaway work

Every agent job declares calls, tokens/output, dollars, elapsed time and retry bounds. Repetition/no-progress trips the job breaker even with monthly money left. Fingerprint normalized operations/results and track progress tokens. Do not reattempt an uncertain side effect as a new operation key.

## Override

A temporary increase is exact-job, extra-amount and expiry bounded, recently reauthenticated, auditable and outside builder authority. Global ceiling changes need the owner policy promotion path. No blanket 24-hour delay is imposed as an unapproved personal restriction. A cooling-off feature is optional owner policy, never silently inferred from the time of day.

## Gate

Reference tests exercise reservation arithmetic and unknown accounting but are not the database implementation. Live paid expansion remains blocked until tests prove atomic multi-worker reservation, restart recovery, provider reconciliation, per-job breaker and exact-scope override on the actual gateway path.

## Reconciled request admission and pending aggregate ledger

The later provider-neutral request-admission contract retains the approximately 6,000-token dynamic selection budget separately from complete provider request capacity and conservative spend. Current text/JSON admission includes serialized instructions, owner input, schema/options/framing and combined output safety. Gateway HTTP retries stay disabled. Unknown/stale metadata, pricing or output accounting fails closed; an unsupported Gateway token-count endpoint is not a fallback. Both slug-qualified ADR 0016 records and ADR 0017 retain scope.

ModelBudgetGuard and canonical exact completed Gateway cost/unknown-accounting protections remain. They do not prove durable multi-worker atomic reservation or accurate aggregate period inputs: multiple current processing paths initialize daily/deep estimates to zero. Preserve current safeguards and implement/prove reserve/settle/reconciliation before paid autonomous expansion. UTC storage and owner IANA-timezone boundaries apply to accounting rollover; outstanding liabilities cannot disappear at midnight.

The September 29 Muse output-profile revision uses verified full output/shared-context safety bounds while retaining the requested control; it creates no new default, budget or provider grant. typesafe-ai/jev remains an owner-recorded future routing/evaluation candidate only, with no runtime integration or authority role. [Current implementation](../architecture/CURRENT_IMPLEMENTATION.md) owns the actual gap map.
