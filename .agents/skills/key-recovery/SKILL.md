---
title: "Review signing key recovery and rotation"
document_id: "_AGENTS_SKILLS_KEY-RECOVERY_SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "governance_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "key-recovery"
description: "Review signing key recovery and rotation. Use for the corresponding review, implementation or recovery task."
version: "5.0.0"
---

# Review signing key recovery and rotation

Use when the task concerns review signing key recovery and rotation.

Lead: `governance_reviewer`. Supporting specialists use the same exact registry names.

Read `AGENTS.md` first, then `docs/security/KEY_LIFECYCLE.md`, `docs/security/TRUST_BOOTSTRAP.md`.

Use disposable keys first. Verify recovery independently of the lost operational key. Reject old epochs and revoked signatures. Keep private material outside builder reach. Distinguish the pure protocol test from real custody and external-state installation.

## Evidence and stop

Record exact input hashes, commands, outputs, negative tests and limitations. Missing trusted prerequisites stop implementation, not a sanitized audit. Do not enable a provider or grant authority to make a check pass. The skill teaches a procedure; it is not permission.
