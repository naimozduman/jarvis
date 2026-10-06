---
title: "Brain Architecture V5"
document_id: "docs::BRAIN_ARCHITECTURE"
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

`@jarvis/brain` converts a bounded, owner-scoped context manifest into a validated structured decision.

It is not:
- the database,
- an executor,
- a connector,
- an agent runtime,
- the source of authority.

## Brain lifecycle

1. canonical trigger/event exists,
2. create/reuse idempotent BrainRequest,
3. deterministic context retrieval,
4. build ContextManifest,
5. choose versioned prompt modules,
6. route to model under privacy/cost/latency policy,
7. receive strict structured output,
8. validate schema and source references,
9. materialize safe server-owned IDs,
10. persist BrainDecision/evidence,
11. pass action intents to policy,
12. create follow-up jobs and response.

A duplicate BrainRequest returns the prior durable result.

## Two-speed or multi-route reasoning

Routes represent task needs, not personalities:
- fast/cheap,
- standard,
- deep/frontier,
- local/private fallback where supported,
- realtime voice route where selected.

A small router or deterministic classifier may choose the route. It must not become an unrestricted tool-calling agent.

## Context discipline

The Brain sees only a bounded manifest. It does not receive the full lifetime database.

The manifest can include:
- current trigger,
- active constitution,
- commitments/plans,
- relevant memory,
- relevant skills,
- current World State,
- domain app summaries,
- recent conversation,
- source evidence,
- authority/tool summary.

## Structured decision

The decision may contain:
- response intent,
- clarification,
- plan/replan proposal,
- reminder proposal,
- memory/skill candidates,
- source/evidence references,
- action intents,
- uncertainty.

## Action boundary

The Brain proposes. Policy authorizes. Executors act.

No model output directly performs a side effect.

## Provenance

Persist route/model metadata, prompt-module versions, manifest IDs, safe token/cost telemetry, validation outcome, and evidence references. Do not store hidden reasoning.
