---
title: "Capability and Authority Boundaries"
document_id: "docs::CAPABILITY_AND_AUTHORITY"
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

# Access is not authority

Capabilities define an operation's semantics. Executor manifests define how a concrete adapter implements it safely. Authority records define which owner allowed which scope. Model text defines none of those.

## Capability

Required contract fields: capability ID, version, declared risk, input schema reference, required scopes, reversibility, permission class and data sensitivity. The executor manifest additionally requires idempotency behavior, maximum operation age, credential boundary, observation, verification, reconciliation and kill-switch domains. Registration fails if any required field is absent.

## Lease profile

The retained draft contracts disallow accidental indefinite grants. Every active external-write lease has startsAt, expiresAt, explicit action/target/account allowlists, a positive use limit, maximum risk, source approval, policy version and revocation epoch. No wildcard target, inferred contact set or free-form scope. JSON Schema checks shape; trusted policy checks dates, duration, target subsets and cumulative usage transactionally.

The proposed default duration is 7 days with a 30-day absolute maximum for ordinary controlled writes. The baseline disallows HIGH_IMPACT authorization by lease. Night Mode leases additionally end with the enrolled sleep episode and at most 12 hours. Enrollment policy values remain pending owner acceptance and must not overwrite existing runtime configuration.

Lease creation, enlargement and renewal require recent step-up and exact preview. Renewals create new records, never extend silently. Authority is the intersection of all applicable limits, not the union of individually allowed fragments. Deny conflicting policies. Usage counters and reservations prevent concurrent workers exceeding a use cap.

## Later standing access

Read capabilities are still purpose-scoped and privacy-bounded. A standing grant is not implied by null expiry. Any future standing write class requires a separate protected ADR, explicit discriminated contract and fresh owner enrollment. No current draft schema supports it.

## Mode versus permission

EDITH and Night Mode select context and delivery, not authority. Switching modes creates an audit event but does not grant a new lease. A valid action-specific approval cannot override a prohibited capability, expired identity or active kill switch.
