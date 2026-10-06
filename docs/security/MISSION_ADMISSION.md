---
title: "Mission admission and signed completion"
document_id: "DOCS_MISSION_ADMISSION"
status: "active"
authority_class: "protected"
owner_role: "governance_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Mission admission and signed completion

## What the tool does

`tools/jarvis-v5/mission_gate.mjs` is a data-only eligibility checker. It verifies signed receipts against a trusted mission policy, a content-derived mission definition, repository identity, trust epoch, receipt validity, and Git ancestry of the receipt checkpoint. It executes no mission commands and makes no network requests. A trusted runner must call it before admitting work. It cannot stop an unrestricted human or shell from ignoring its result.

## Definitions versus execution state

`governance/ROADMAP.json` owns proposed mission definitions and dependencies. `governance/STATE.json` records current descriptive work. Neither proves a mission completed. Completion receipts name the mission definition digest, exact source checkpoint, evidence digest, trusted signer, purpose and expiry. A changed definition or current trust epoch requires revalidation. A result from another branch without ancestry is not a prerequisite.

Definition digests include the mission object excluding display-only runState/completedRunRef, mission text, required reading hashes and exact referenced product requirements. They do not hash their own generated outputs.

## Admission modes

Audit: J5-M00 accepts sanitized input and produces scratch reports, even before a signing key exists. Its eligibility is not an isolation certificate.

Bootstrap preparation: J5-M01 allows only owner-side installation planning and dummy-key checks. It cannot claim installed governance merely by running. After actual installation, the independently trusted verifier signs bootstrap evidence including isolation, protected merge, independent verification, recovery rehearsal and current-head admission controls.

Implementation: J5-M02 onward requires enrolled trusted mission signers, a current bootstrap receipt and receipts for all transitive prerequisites. J5-M00 is retrospectively verified as source-preservation evidence during bootstrap. Receipt checkpoints must be the current head or trusted Git ancestors. The checker never trusts a candidate's ancestors list. It reads Git objects through a fixed read-only command.

## Installing the policy

`governance/MISSION_POLICY.json` ships disabled. Its copy in the candidate is not an enrolled root. The operator pins a separate trusted policy and reviewed checker. Receipt signing happens in the verification/owner context, never in the builder. Keep repository promotion signatures, mission-completion signatures and runtime action approvals distinct.

## Completion and expiry

The builder emits ready_for_verification and evidence references. The verifier proves those references and signs the receipt. Do not sign a runRef-shaped string without verifying the run. The supplied generic evidence protocol continues to verify exact workflow and artifact evidence; a mission receipt signs the resulting evidence digest.

The receipt lifetime is a trusted installation policy, not a promise that old software remains safe. Revalidate after a relevant source, model, policy or deployment change even within that lifetime. No completed mission authorizes unrelated future live effects.

## Trusted entry and receipt commands

The installed controller uses `mission_runner.py` as its entry: this calls `mission_gate.mjs` before producing a context packet. It does not launch a networked agent or run implementation commands. Granting workbench access only after this check is an operator/runner integration requirement, not a capability of a candidate-side script.

After independently verifying evidence, the verifier prepares an exact receipt payload and previews it through `owner_record_signing.mjs --kind mission --payload RECEIPT_PAYLOAD.json`. Signing additionally requires the isolated private-key path, `--confirm-digest` and an exclusive output path. A trusted-bootstrap receipt must include the five actual installation control results. The supplied signer provides cryptographic binding, not factual verification of booleans supplied to it.

A definition change or expiration requires review and a new receipt over existing qualifying evidence. It never instructs Codex to repeat a completed database migration or WhatsApp pairing ceremony merely to refresh a date.
