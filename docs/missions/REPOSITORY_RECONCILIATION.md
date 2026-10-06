---
title: "Existing code reconciliation and takeover"
document_id: "DOCS_REPOSITORY_RECONCILIATION"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Existing code reconciliation

The job is to evolve the current repository, not implement a new skeleton beside it. The six focused source observations in `governance/RECONCILIATION.json` are evidence at one pinned commit. They are not a full repository audit or a statement about the current local dirty tree.

## Existing foundations to preserve

The inspected source contains deterministic policy denial, a generic kill flag, a real model budget guard, prompt composition, context limits, and explicit Brain/transport/orchestration/bridge CI steps. Do not remove or replace these to fix an audit claim that they do not exist.

## Concrete repair targets

The inspected prompt fingerprint depends on IDs and manually set versions, not prompt bytes. The inspected context estimate covers selected record text, not the full serialized request. ConversationTurnService accepts an optional guard, defaults supplied usage values to zero, and returns on an already existing request without resuming absent decision/response work. Those are static code observations. Reproduce actual caller and crash behavior before declaring a production defect or changing it.

## Disposition procedure

For each package or cross-cutting boundary, record current source/commit and consumers. Assign keep, repair, migrate, replace, retire or unresolved. Keep requires relevant test evidence, not aesthetic preference. Repair preserves the established interface where practical. Migration declares both producer and consumer wire versions and the point of no return. Replace requires a concrete incompatibility and transition plan. Retire requires consumer evidence. Unknown local or live state stays unresolved.

Start with governance tooling adoption, then bounded Brain and infrastructure reconciliation. Do not simultaneously change schema, prompt loader, orchestration and authentication without intermediate checkpoints. Compare old/new behavior in dry-run or read-only shadow mode; shadow execution never duplicates effects.

## Inert planning tool

`reconcile.py --pack <pack> --source <sanitized-source> --output <scratch-plan.json>` compares actual bytes and lists collisions. Source-missing records remain unresolved because sanitization may omit a file. It does not write to the source, run imports, execute Git hooks or contact providers. It never replaces root package/lock/workspace/environment files.

## Integration branch

An approved per-file plan distinguishes new candidate, identical, collision and supporting input. Preserve current AGENTS rules until the protected baseline transition is accepted. Never overwrite enrolled trust/evidence/mission policies with the pack's disabled proposals. Preserve all accepted ADR numbers and inspect the index before numbering any V5 proposal. Old pack path removal is not repository deletion authorization.

## Completion evidence

Record exact source checkpoint and dirty-state digest, selected dispositions, code/data compatibility tests, migration authorization, rollback boundary and unresolved questions. A V5 document is a proposed target, not proof old code is wrong. The trusted promotion path decides which candidate becomes authoritative.
