---
title: "Incident response and controlled reenablement"
document_id: "DOCS_INCIDENT_RESPONSE"
status: "active"
authority_class: "protected"
owner_role: "release_operator"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Incident response and controlled reenablement

## Severity and first action

Unauthorized effects, secret exposure, wrong-owner access and a failed emergency stop are containment incidents. Lost data, runaway spend, unavailable trusted verification and unresolved repeated dispatch are also explicit incidents. Do not begin by changing the prompt or deleting the failing record.

Record an incident ID, detected_at from trusted time, environment, source/artifact revision, observer and symptom. Use minimal redacted metadata. The affected execution system must not be the only way to reach the operator or stop control.

## Contain

Stop admission of the affected action class and revoke its active authorizations. Pause rather than delete queued work. Block provider credentials or disable the local bridge when needed through the independent operator path. Preserve safe read-only investigation. A global stop must not hide the unresolved effects it is intended to contain.

For possible credential compromise, rotate/revoke through the relevant provider or governance recovery procedure. Do not assume redeploying code removes a stolen credential. Treat copied secrets and existing sessions separately.

## Establish facts

Capture exact source commit, deployment artifact, policy/trust/kill/restore epochs, request and job IDs, approval snapshot, principal, provider reference, cost reservations and redacted event order. Record which clocks and observations are trusted. Preserve disputed evidence instead of rewriting it to agree with the diagnosis. Do not store hidden model reasoning as audit material.

## Reconcile

Determine whether each operation was undispatched, dispatched with known outcome or uncertain. Read provider state through a narrowly authorized investigation path. Do not retry a write to discover whether it worked. Compensation needs its own policy and approval. Let a mixed incident report partial resolution.

## Repair and verify

Create the smallest regression and a bounded fix. Run candidate tests in a credential-free environment. Independent verification names the exact source, tests, artifacts and remaining uncertainty. Security-critical tests cannot be removed to make the patch green. Relevant coverage reviews and kill/restore drills must be fresh.

## Reenable

The owner/operator authorizes a limited canary after factual containment, a verified fix and a rollback plan. Reissue required authorizations under current epochs. Observe actual outcome, then widen only within the approved scope. A fixed code defect does not itself prove old unknown effects resolved.

## Closure

Use states detected, contained, investigating, remediating, monitoring and closed. Closure requires disposition of affected actions, source-linked regression evidence or an explicit non-testable reason, owner impact, follow-up owner, and next review trigger. Outstanding unknown outcomes remain visible even if service availability is restored. Incident evidence is append-only; corrections link new records.
