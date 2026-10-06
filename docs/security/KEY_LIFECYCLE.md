---
title: "Governance key lifecycle and recovery"
document_id: "DOCS_KEY_LIFECYCLE"
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

# Governance key lifecycle and recovery

## Scope and delivered mechanism

This is the governance signing-root protocol, not passkey account recovery and not a runtime permission lease. `tools/jarvis-v5/key_lifecycle.mjs` verifies a proposed transition with ordinary Ed25519 signatures and returns the next public trust state. It does not install keys, contact GitHub, change a platform account or persist the external monotonic epoch. Operator-side installation and custody remain required.

M01 must rehearse the failure paths with disposable keys before real enrollment. Do not place private keys, recovery secrets or passphrases in the repository or builder account. The supplied software signer is not a hardware-token adapter. Hardware custody is a future adapter choice, not a claim made by this pack.

## Roles and state

Operational keys sign normal promotion through their allowed purposes. Recovery keys authorize recovery and revocation through a separate path. A key fingerprint alone is not enrollment. A trusted public state names repository, monotonically increasing epoch, operational key set, recovery key set, threshold, and previous-state digest. The trusted verifier pins that state outside candidate control.

Recovery threshold is an owner-selected custody policy. The test fixtures use dummy keys. Several secrets held by one person are not several independent people. Choose storage and access for actual loss scenarios, not a fictional committee.

## First enrollment

1. Inventory repository and administrative recovery access in the safe audit.
2. On the isolated owner side, generate operational and independent recovery key material. Review public fingerprints on that side. Establish offline copies and custody instructions.
3. Rehearse normal rotation, total operational-key loss and suspected compromise using dummy keys with the same policy shape.
4. Prove that the builder cannot read signing or recovery material. Rehearse how the owner reaches the repository/platform administration without the normal builder session.
5. Pin the first public trust state and its digest in the external verifier. Record the administrative acceptance separately from the candidate repository.
6. Configure required checks and the final current-head merge path. Submit a harmless unsigned protected change and prove rejection. Only then issue trusted bootstrap evidence.

A JSON field saying enrolled is not proof of steps 4–6.

## Normal rotation

Prepare a transition naming the repository, current state digest/epoch, new public key, nonce and finite validity. Require a valid existing operational signature and proof of possession of every new key over the exact transition. The verified result revokes the old operational keys and increments the epoch. Install via compare-and-swap against the pinned old state. Verify new signatures work and old signatures fail. No grace period is implicit.

Use a separately approved protocol if overlapping operational keys are genuinely needed. Do not improvise overlap by leaving retired keys active.

## Lost operational key

Stop new protected promotions. Do not disable required checks. Use the pre-enrolled recovery threshold, independent of the lost key, plus possession proof for the replacement key. Recovery binds the exact current state digest and a fresh nonce. The verified result revokes all old operational keys and advances the epoch. Revalidate pending changes rather than reusing signatures from the old epoch.

If recovery material and administrative recovery are both unavailable, fail closed and escalate to an explicit out-of-band re-establishment of trust. There is no universal cryptographic recovery from loss of every trust root. Restore application data separately; do not pretend data backup reconstructs signing authority.

## Suspected compromise

Treat suspicion as a containment incident. Stop promotions and affected deployments through independent operator controls. Use recovery keys, not the suspected operational key, to recover. Revoke all old operational keys, advance the external epoch and invalidate pending approvals and verifier receipts scoped to the old epoch. Investigate accepted changes from the suspected exposure window. Historical signatures remain evidence of what was accepted, not current authority.

A compromised recovery key requires the separately controlled platform/root recovery procedure. The tool intentionally cannot replace the recovery key set with an ordinary operational signature. V5 does not claim resistance to an attacker holding every enrolled recovery secret or repository administrator account.

## Installation atomicity and rollback

The pure verifier returns a next-state proposal. The external trusted store must atomically compare current epoch/digest, install once, and append a signed transition record. A second installation of the same nonce or a lower epoch fails. Restoring repository files must never roll back this external epoch. Pending mission receipts require revalidation under the new trust state.

## Required dummy-key drill

Prove accepted rotation and recovery; wrong repository, changed new key, stale epoch, expired transition, missing possession signature, repeated nonce, duplicate signatures pretending to satisfy a threshold, revoked signer, operational-key-only recovery, and old-root promotion all fail. Record commands and actual operator recovery reachability. The automated test is not a custody or hardware drill.

Source basis: V4.1 review findings and the lifecycle concepts in NIST SP 800-57 Part 1 Rev. 5. This custom protocol is not a NIST-certified implementation. See `governance/RESEARCH_SOURCES.json`.

## Owner-side command path

Prepare the public transition JSON outside the builder context. Preview its exact content with `node tools/jarvis-v5/owner_record_signing.mjs --kind key-transition --payload TRANSITION.json`. After review, supply `--private-key OWNER_KEY.pem --confirm-digest DIGEST --output PROOF.json` from the owner context. Repeat for the required recovery and replacement-possession keys. Collect distinct proof objects with the unchanged payload into `{ "payload": ..., "proofs": [...] }`.

Verify using `node tools/jarvis-v5/key_lifecycle.mjs --trusted-state CURRENT_PUBLIC_STATE.json --transition REQUEST.json --output NEXT_PUBLIC_STATE.json`. A successful command returns proposed public state only. The independent installer must atomically compare the old pinned state and apply once. Never run these signing commands inside the builder worker or copy private keys into the pack.

The current verifier bounds operational-key history to 32 records and rejects a rotation that exceeds that bound rather than discarding revoked-key records silently. A separately reviewed format migration is required at that point. Emergency revocation adds no key. Nonce replay is also blocked by the external monotonic epoch, not only the bounded recent nonce list.
