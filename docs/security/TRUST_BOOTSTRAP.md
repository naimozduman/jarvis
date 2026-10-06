---
title: "V5 Trust Installation"
document_id: "docs::TRUST_BOOTSTRAP"
status: "active"
authority_class: "protected"
owner_role: "governance_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Bootstrap after the audit, before unsupervised promotion

M00 establishes the real source/credential/test baseline in an isolated audit context. It does not require a signing key. M01 installs the accepted gate using owner authority unavailable to the builder. No frontmatter or local passing check performs that installation.

## Separate contexts first

Follow BUILDER_ISOLATION. The reasoning host and candidate test worker lack owner keys, provider writes, migrations, deployment/admin credentials and bypass rights. The trusted recorder and verifier never execute arbitrary candidate code with their tokens. Actual rootless-worker and host/connector observations are required. The offline launcher does not certify the networked Codex host.

## Install trust roots

1. Record repository identity, exact accepted base, tool digests, current branch/ruleset configuration and deployment triggers. Preserve actual application CI.
2. Owner reviews and installs the reviewed V5 gate code and TRUST_POLICY v2 in a protected baseline or external gate repository. Every path is protected by default; only narrow inert evidence exceptions remain. This is explicit initial bootstrap, not a candidate self-approval under the old gate.
3. Generate/enroll an owner Ed25519 public key using owner-signing.mjs in a context unavailable to the builder. The supplied signer is software PEM-based, not a hardware-token integration. Keep private keys, recovery copies and rotation procedure outside the worktree and builder account.
4. Review actual E-APP-REGRESSION test entrypoints, coverage and invariant mapping from M00. Enroll purpose-scoped evidence signers and pinned verifier profiles in EVIDENCE_POLICY. See VERIFICATION_EVIDENCE for exact fields and wire formats. Empty profiles or keys remain a promotion blocker.
5. Install the required check with trusted origin and restricted bypass. Prevent force pushes/deletion of protected refs. Protect the gate, keys, workflow configuration and deployment environments. An arbitrary same-name workflow result is not an independent check.
6. Ensure only the owner-controlled final promotion path is able to merge or deploy. It re-runs admission against current base/head and current evidence age immediately before promotion. Old green statuses do not expire automatically. Changed base/head invalidates detached approvals and requires re-verification.

## Prove the installed boundary

Run these tests against synthetic changes in the actual installed integration, not production side effects:

- An ordinary unsigned code edit fails, including API/database/config/UI/adapter/worker and a new unknown executable path.
- Removing a policy call from a dispatch path fails even with unchanged policy module text.
- A candidate changes both checker and policy; the accepted checker still requires exact approval.
- Executable-mode or nested-file tricks do not inherit the inert operational exemption.
- An existing accepted ADR/migration/progress record rewrite fails even with an ordinary change signature.
- An owner-authorized exact change with authenticated successful selected suites and fresh review passes. One byte/head/base/expiry change fails.
- Invented runRef, forged signature, changed workflow source, skipped required step, old rerun attempt, mismatched artifact, missing review and stale selected review fail.
- A future unrelated planned eval does not block an unrelated foundation change. Activating its capability does add requirements.
- Bypass/admin or unprotected deployment triggers cannot promote the candidate outside this path.

Record exact tool/policy/key IDs, external verifier revision, run/artifact references, actual settings observations, operator and timestamp. Never record private keys or tokens. Map-only bootstrap updates must be small reviewed prerequisite changes, not bundled unverified implementations.

## One-owner residual trust

The ultimate administrator still has power to replace trust roots. Do not invent an independent second human. Distinct credentials and purpose-scoped signatures make authority explicit but do not prove owner attention or semantic test quality. A stolen owner/verifier key or compromised trusted recorder defeats its boundary.

If required checks or reliable final admission are unsupported in the hosting arrangement, retain supervised implementation and an owner-controlled external release gate. Do not relabel the example workflow as an installed protection. No GitHub setting was changed while packaging V5.

## Integration example

integration/github/governance-gate.yml reads accepted BASE code on pull_request_target or PR evidence comments. It collects exact current PR objects, performs data-only checks and corroborates separately signed evidence. Candidate code does not run in the privileged job. GitHub's workflow/status behavior, token scopes and check origin must be smoke-tested in M01. The final merge/deploy controller is an installation requirement, not supplied automation.

Official references: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target and https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
