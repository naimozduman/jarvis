---
title: "Prompt Source, Assembly and Adoption"
document_id: "docs::PROMPT_ARCHITECTURE"
status: "active"
authority_class: "protected"
owner_role: "runtime_prompt_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Explicit registry, bounded assembly

V5 candidate source modules live in prompts/runtime/modules. governance/PROMPT_REGISTRY.json specifies ID, purpose, version, content SHA-256, invariants, module byte ceiling and allowed assemblies. It owns composition, not a conceptual list with missing filenames.

A deterministic compiler injects canonical invariant text, then ordered purpose modules. One invariant is injected once. Engineering docs reference IDs; the runtime receives actual instructions rather than pointers to unread AGENTS.md. Compiled output records every module content hash, ordered IDs, invariant-registry digest, assembly digest and schema contract references.

## Existing code

The current runtime uses code-based modules in packages/brain/src/prompts/registry.ts. Its assembler fingerprints module IDs and versions. This pack does not overwrite it. Hashing IDs/versions alone does not detect text edits without version bumps; adoption must bind actual content bytes and enforce version changes. Existing promptVersion persistence is preserved and extended only through a reviewed migration.

## Budgets

Pack CI checks per-module UTF-8 byte ceilings and full assembled-instruction ceilings. These are deterministic size guards, not claimed exact model token counts. Live adoption adds the provider/model tokenizer or conservative validated estimator for the complete request: instructions, evidence, schema/tool definitions, owner text and reserved output. Required safety instructions never silently truncate. Overflow triggers bounded retrieval or explicit failure.

## Behavioral coverage

Each assembly declares test cases covering competing tasks and modes. Run whole assemblies, not only isolated module tests. LLM-based contradiction reviews are advisory; deterministic authorization remains outside prompt precedence. Pin content fingerprints in live-eval receipts and retain old assemblies for regression comparison without retaining private raw prompts.

## Adoption gate

Schema/prompt registry state remains draft until actual producers/consumers, accounting, error handling, strict output, version persistence and relevant judgment/safety evals pass. The compiler builds preview artifacts, not a new active JARVIS Brain.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Prompt architecture

Prompt behavior is split into code-versioned modules with `id`, `version`, `purpose`, `content`, and repository update date. The registry includes core identity, constitution, memory, accountability, planning, replanning, behavioral interventions, reminders, communication style, actions, uncertainty, security, and privacy.

The assembler always includes core, constitution, action, uncertainty, security, privacy, and delivery modules, then adds purpose-specific modules. It records a compact version fingerprint and module IDs, not a full prompt body.

The instructions require constitutional goals to outrank observed behavior; no-response not to imply completion; facts, observations, and hypotheses to remain separate; ambiguity to prompt one concise question when material; high-impact actions to require approval; external content to remain untrusted; valid overrides to be accepted after one consequence explanation; and personality adaptation to affect delivery rather than values.
