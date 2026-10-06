---
title: "Multi-Agent Architecture"
document_id: "docs::MULTI_AGENT_ARCHITECTURE"
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

# Timing

Multi-agent comes after a single-agent Core is reliable.

Multiple agents multiply both capability and failure modes.

## Roles

Potential bounded workers:
- Research,
- Developer,
- Browser,
- Business/operations,
- Security/reviewer,
- future Council/advisory personalities.

## Shared topology

Agents do not maintain independent owner truths.

They share:
- canonical job IDs,
- Core-provided context manifests,
- app/source references,
- capability scopes,
- budgets,
- durable results.

## Delegation

Core decomposes work into jobs with explicit output contracts. Agents may run in parallel when dependencies permit.

## Agent-to-agent communication

Prefer durable job/result exchange through Core rather than free-form private conversations. If agents debate, the transcript is evidence, not authority.

## Council

A future Council may offer distinct perspectives. Council roles are advisory personas over shared facts. They do not get separate memories about the owner and do not vote away owner authority.

## Boardroom

A scheduled Boardroom may summarize unresolved decisions, compare perspectives, and record owner outcomes. It should not manufacture fake certainty or autonomous governance.

## Safety

Each worker receives the minimum tools needed for its job. No “all tools for every agent” default.
