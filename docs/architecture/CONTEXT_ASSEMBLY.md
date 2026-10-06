---
title: "Bounded Source-Backed Context"
document_id: "docs::CONTEXT_ASSEMBLY"
status: "active"
authority_class: "protected"
owner_role: "memory_architect"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Deterministic selection precedes reasoning

Keep the existing owner-scoped assembler and manifest persistence. Trace maxApproxPromptTokens, record/recent-message caps and excludedRecordCount at actual callers rather than assuming environment variables are unused.

Rank by owner-approved goals, active commitments, source authority, freshness, relevance, conflict and current context. Preserve known, inferred, stale, conflicting, missing and not_connected as epistemic states. Restricted is a sensitivity/access class, not a seventh epistemic value. Both dimensions are present in source records and evaluated before model access.

## Full request budget

Instructions, mandatory policy, message text, context, tool/schema definitions and output reserve all consume capacity. Byte/module guards in the pack only constrain instruction growth. Live runtime tests must protect required instructions, measure provider-token estimates and explicitly record excluded counts by reason. If mandatory context does not fit, fail or reduce optional retrieval. Do not silently drop owner/security scope.

Manifest records selected source IDs and versions, safe content hashes, reasons, stale/redacted state, exclusions, context version and assembled-prompt fingerprint. A model can cite only supplied references. Indexes are derived and obey source deletion/correction propagation.

Acceptance covers oversized source, Unicode/multilingual text, giant schema/tool catalogs, conflicting dates, cross-owner records, stale app summary, revoked source and context budget overflow. Reference pack tests are not a replacement for actual gateway request-size tests.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Context assembly

`ContextAssembler` is deterministic and owner-scoped. It starts with structured retrieval rather than embeddings and ranks records by constitutional relevance, active commitment relevance, deadline proximity, current-day relevance, source authority, confidence, recency, and visible conflict state.

The runtime configuration caps context records, recent messages, and approximate prompt tokens. Cross-owner records are discarded. Restricted records retain only a safe placeholder for the model; the `ContextManifest` records that redaction occurred without storing raw content.

Each request persists a manifest containing selected record IDs/types, rank, score, selection reasons, sensitivity/redaction state, excluded-record count, and a content-free source hash. The model can cite only IDs in this exact manifest. An invented ID or altered epistemic state invalidates the decision before durable candidates or actions are created.

The early provider-missing statement is historical. Current source includes independent protected personal-app service reads for Our Hours, Growth Stats and Iron & Intervals. Their presence does not prove automatic Brain ingestion or current connected data. Each assembled context still labels missing/not-connected/stale evidence explicitly and never invents it.
