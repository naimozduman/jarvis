---
title: "Deterministic Policy Matrix"
document_id: "docs::POLICY_MATRIX"
status: "active"
authority_class: "protected"
owner_role: "security_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Policy cannot be negotiated by the model

The canonical finance prohibition is INV-FINANCE-001 in governance/INVARIANTS.json. No alternative wording in prompts, schemas or capability manifests grants an exception.

| Class | Baseline result | Additional checks |
| --- | --- | --- |
| READ | Allow only verified owner, purpose and source scope | Sensitivity, freshness, allowed destination and resource admission |
| LOW_RISK_INTERNAL | Allow registered reversible internal effect | Exact contract, evidence, owner, idempotency and audit |
| CONTROLLED_WRITE | Approval or explicitly enrolled finite lease | Target/account/type bounds, use reservation, expiry, recheck, verification |
| HIGH_IMPACT | Action-specific trusted approval and fresh step-up | Never standing lease, exact snapshot, no unattended Night Mode |
| PROHIBITED | Deny | No approval or model mode overrides denial |

Finance movement, purchases and account mutations remain prohibited in this candidate baseline. Read-only finance observations do not get classified by a broad `finance.*` prefix alone in future registries; inspect the existing runtime before changing it.

Unknown capability, owner mismatch, missing authority, changed payload, revoked permission, invalid schema, expired job/action, unsafe egress, failed resource admission or active kill domain denies dispatch. Resource admission runs before paid model/tool calls as well as before effectful execution. A cheap model is not a bypass.

Policy inputs are versioned. Bind authorization to policy version and kill epoch. Changes to the matrix, its code implementation, risk classification, test baseline or trusted validator require protected promotion. Runtime behavior is tested from registered semantics, not grepped prose.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Policy matrix

## Deterministic policy boundary

`@jarvis/security` evaluates every proposed action before any executor. The result is structured:
`allowed`, `requiresApproval`, `denied`, `reason`, `policyVersion`, and `matchedRules`. A future
model may propose an action, but model text can never make that action executable by itself.

## Phase 1 risk classes

| Risk class | Example action | Default Phase 1 result |
| --- | --- | --- |
| `READ` | `internal.read` | Allowed for a verified owner-scoped principal. |
| `LOW_RISK_INTERNAL` | Create/update a commitment, create a reminder, update internal plan state | Allowed only when the action type and declared risk exactly match a registry entry. Phase 1 executes only the registered commitment/reminder effects. |
| `CONTROLLED_WRITE` | Future calendar create/modify, archive known newsletter, write to approved app | Explicit approval by default; can be denied by owner policy. No connector executor exists in Phase 1. |
| `HIGH_IMPACT` | Send a message/email, cancel appointment, delete important data, move money, purchase, expose sensitive data | Always requires explicit approval. No high-impact executor exists in Phase 1. |

## Non-negotiable guards

- A non-owner-scoped principal is denied.
- An active owner kill switch is denied.
- An unknown action type is denied.
- A mismatch between a proposal's risk class and its registry rule is denied.
- Every `finance.*` action is denied; no money movement pathway exists.
- A controlled write never silently becomes an allowed write.
- A high-impact proposal never becomes executable merely because it was generated or retried.

The policy registry is code-versioned as `phase-1.0`. `policy_rule_overrides` provides a future
owner-scoped configuration boundary, but it is not a mechanism for providers or models to loosen
the hard guards above. Any new external operation must be registered, tested, documented, and
audited before it receives an executor.
