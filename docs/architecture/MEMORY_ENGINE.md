---
title: "Memory Engine V5"
document_id: "docs::MEMORY_ENGINE"
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

# Memory is typed

JARVIS does not maintain one undifferentiated “memory blob.”

Durable types:
- facts,
- preferences,
- people,
- relationships,
- projects,
- observations,
- hypotheses,
- open loops,
- bounded personality traits.

Procedures live in the separate Skill Engine. History lives in Life Ledger. Subjective reflection lives in Journal.

## Candidate pipeline

`evidence -> candidate -> review/promotion -> active memory -> supersession/review`

Candidates retain source, evidence references, confidence, sensitivity, validity interval, review time, and related entities.

## Promotion rules

- Explicit owner statements are strong evidence but still source-backed.
- Model inference does not become a fact automatically.
- Observed behavior stays an observation until promotion criteria are met.
- Preferences need repeated evidence or confirmation.
- External untrusted content cannot directly create owner memory.
- One emotional interaction cannot permanently change personality settings.
- Constitution is never changed through memory promotion.

## Update correctness

Before adding a new memory, retrieve potentially conflicting existing records.

A memory update explicitly chooses:
- add,
- update/supersede,
- deactivate/delete under policy,
- no-op,
- conflict requiring review.

This borrows the useful retrieve-before-write idea from external memory systems without handing them canonical ownership.

## Retrieval

Combine deterministic filters, recency, entity links, and optional semantic search. Return provenance and epistemic type.

## Correction

Owner correction creates a durable supersession/rejection path. Derived summaries/indexes must refresh.

## Memory versus Life Ledger

“What happened on Tuesday” belongs primarily to Ledger/history.

“What is generally true about Naim or an ongoing project” may belong to memory.

## Memory versus skill

“I use this deployment process” is a procedure, not a personal fact.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Memory engine

## Structured classes

Memory remains typed: facts, preferences, people, relationships, projects, observations, hypotheses, open loops, and personality traits. The engine does not collapse them into a generic JSON blob. Candidate records remain separate from reviewed durable records.

Every candidate preserves owner, source authority, confidence, sensitivity, validity interval, review time, state, related entities, evidence references, and timestamps. Durable memory tables also retain evidence counters and review/supersession fields.

## Deterministic promotion

- Explicit owner statements are strongest evidence, but become candidates before durable use.
- Model inference is normalized to a hypothesis and always requires owner confirmation.
- Observed behavior remains an observation; it cannot become a fact or rewrite the constitution.
- Preferences need repeated evidence or explicit owner review. One frustrated message cannot set a permanent “zero reminders” preference.
- Untrusted external content cannot directly create durable memory.

`MemoryService` exposes type/entity/relevance retrieval, active facts, open loops, candidate creation/confirmation/rejection, supersession/deactivation, stale review, linking, and evidence recording. Confidence is a bounded evidence signal, never a claim of objective truth.

## Open loops and personality

Open loops carry follow-up/review time, uncertainty, related entity/commitment, and resolution state so unfinished ideas can resurface without becoming facts. Personality traits are bounded delivery preferences only. They track estimates, confidence, evidence counts, freezing, manual editing, reset, review, and learning opt-out; they cannot affect values or permissions.
