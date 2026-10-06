---
title: "V5 self-review and limitations"
document_id: "DOCS_SELF_REVIEW"
status: "active"
authority_class: "evidence"
owner_role: "security_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# V5 self-review

## Checks performed while building this candidate

The existing V4.1 toolkit was retained and its tests rerun after relocation. The new V5 tools received negative cases for forged/missing prerequisites, wrong mission and topic, changed source content, invalid clocks, stale epochs, missing key possession, operational-key-only recovery, unknown requirements, symlinked context, oversized required context and stale handoff writes. Schema tests exercise all retained draft contracts.

The first Node run exposed a KeyObject-versus-PEM signing input incompatibility in the new shared signer. The signer was corrected to accept a valid private KeyObject or PEM rather than weakening the tests. The failed run remains an iteration record, not a successful release result.

Additional review fixed three fail-closed details: invalid verifier clocks now reject old promotion/evidence signatures, epoch overflow is rejected, and key rotation rejects full history rather than silently dropping old revocations. Repository-mode structural validation permits separately evidenced enrollment while standalone pack mode still rejects pre-enrolled owner defaults.

## What remains outside this evidence

The package has not been applied to the local repository. Only six focused pinned source files and metadata were read. Existing source findings need actual-path tests before migration. This is not a code audit of every package or deployed service.

A signed mission receipt attests to a verifier's evidence review. It does not make an untrustworthy verifier honest. Installed trust, independent credentials, current-head enforcement, real image provenance, database reservations, key custody, recovery administration, approval UX, restores and kill drills need the assigned mission's evidence.

The mission runner prepares context after admission. It does not sandbox an arbitrary networked coding-agent session. A builder using its own copy of a validator is still doing a development check, not trusted promotion.

The key-transition verifier outputs proposed public state. A privileged installer must enforce monotonic compare-and-swap outside the worktree. Recovery-root replacement is deliberately not an operational-key capability. Loss of every recovery/admin root has no invented fallback.

The context budget measures UTF-8 bytes, not exact model tokens. Semantic prompt conflicts, incomplete user requirements and judgment quality still require behavioral evidence. A complete registry is not proof that every dynamic application consumer was discovered.

## Release boundary

Use VALIDATION_REPORT and its exact logs for final results. No review timestamp was fabricated from file-generation time. Budget values, privacy retention, notification density, recovery custody and authority expansion remain owner decisions. This package provides the engineering system for implementing and verifying those decisions, not their approval.
