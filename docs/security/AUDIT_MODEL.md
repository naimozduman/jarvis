---
title: "Audit Model V5"
document_id: "docs::AUDIT_MODEL"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Purpose

JARVIS should answer “why did you do this?” from durable evidence.

## Append-only principle

Meaningful decisions and side effects append audit records. Corrections create new linked entries instead of rewriting history.

## Audit record

Record safe metadata for:
- owner,
- actor type/ID,
- trigger,
- target type/ID,
- correlation/causation,
- policy result,
- authority source,
- approval reference,
- capability,
- model/prompt versions when relevant,
- executor,
- result,
- verification,
- rollback/reconciliation status,
- timestamps,
- source references.

## Agent work

Agent jobs log:
- assigned goal,
- scoped capabilities,
- context manifest reference,
- budgets,
- checkpoints,
- artifacts,
- proposed actions,
- final evidence.

Do not store hidden model reasoning.

## Privacy

Audit stores references, hashes, safe categories, and bounded summaries instead of full private payloads where possible.

Never include credentials, full intimate messages, raw health/finance records, private attachment bodies, or chain-of-thought.

## Explainability

A future control-center view should link:
trigger -> selected context -> decision -> policy -> approval -> execution -> verification -> memory write.

This is operational provenance, not a generated story.

## V5 evidence custody
Audit model/agent decisions, mode switches, lease creation/use/revocation, enrollment, budget reservation/overrides, stops and outcome reconciliation. Store prompt content fingerprints and source versions, not hidden reasoning. A hash chain detects local sequence tampering only when periodic anchors are held independently. Do not claim tamper-proof audit from a hash chain editable by the same database administrator. Audit-watch and independent anchors are a later implementation gate before unattended high-impact expansion.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Audit model

## Append-oriented record

`jarvis.audit_events` is the durable audit ledger for meaningful JARVIS mutations. The initial
migration creates a PostgreSQL trigger that rejects `UPDATE` and `DELETE` on this table. Corrections
are represented by a new, linked audit event rather than rewriting history.

Each record has:

- owner, actor type, optional actor ID, action, target type and target ID;
- occurrence time, correlation ID, optional causation ID, source, and reason;
- previous/resulting state references containing identifiers, version, and/or content hash rather
  than raw private records; and
- structured metadata after sensitive-field redaction.

## Recorded Phase 1 mutations

The canonical pipeline records event receipt, job queueing, processing start/finish or ignore,
deterministic handler proposals, policy evaluation, approval requests, policy denial, and completed
internal action effects. Commitment status history, action execution/result rows, and job records
provide the linked operational details. All audit writes are inside the transaction that establishes
the related state transition.

## Privacy rules

The safe-audit helper recursively redacts fields classified as secret, credential, token,
authorization, message body, finance, health, or sensitive metadata. Audit payloads must not contain
raw OAuth tokens, provider credentials, full messages/emails, attachment data, health samples,
financial data, or model prompts. The same rules apply to logs, errors, fixtures, and commits.

Audit access is owner-scoped. A future viewer may inspect the ledger but may not mutate it, and
external providers never receive a direct audit-write bypass.
