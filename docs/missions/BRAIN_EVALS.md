---
title: "Brain Evaluation Coverage"
document_id: "docs::BRAIN_EVALS"
status: "active"
authority_class: "protected"
owner_role: "test_evals"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Preserve the existing suite

The actual repository CI observed at the source checkpoint explicitly runs brain:evals, and its Vitest configuration also discovers Brain .test.ts files. V5 does not remove or duplicate that suite to fix a nonexistent omission.

## V5 additions

Map invariant IDs to tests for facts versus hypotheses, epistemic state versus sensitivity, ignored-message handling, meaningful commitment completion, owner overrides, source coverage, context budgeting, prompt-content fingerprints, malformed output and uncertainty. Judgment cases test useful replanning, interruption selection, source reconciliation and grounded conclusions across domain apps.

The supplied eval catalog records required future cases as required_unimplemented unless an actual implementation test was observed. It never marks a behavior covered because a filename is suggested. Known baseline tests are listed with their checkpoint and must be re-run locally.

Refer to EVALS_AND_ACCEPTANCE for incident linkage, fixture-change protection and evidence custody. Code-format coverage and green historical regressions are not proof a new model follows the required judgment behavior.

## V5 selected freshness and result provenance

promotion_evidence.py reads the BASE implementation map and eval catalog. Every affected required suite needs authenticated successful platform evidence and a signed fresh exact-head coverage review. Missing application test mappings fail instead of inventing coverage. Unrelated future planned suites do not block. New control/schema activation adds its trusted requirements. See docs/security/VERIFICATION_EVIDENCE.md for exact formats, failure cases and installed-runner limits. A declaration in impact.py or a local result in validation/ is not authenticated promotion evidence.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Brain evaluation suite

The provider-free suite is located at `packages/brain/test/evals/phase-two-evals.test.ts` and runs through `pnpm brain:evals`. It uses `FakeModelGateway`, in-memory repositories, the real ContextAssembler, the real model-result materializer, the real Domain proposed-action pipeline, and the real policy evaluator.

The suite contains 49 behavior/invariant scenarios. It covers constitution preservation after missed training, no-response/ghosting, quiet mode, hard overrides and expiry, protected anchors, late wake-up replanning, minimum viable action, deadline ambiguity/conflict, stale/contradictory memory, hypothesis promotion, personality learning bounds, open loops, high-impact approval, finance denial, no external message execution, prompt injection, malformed/unknown actions, constitution-edit attempts, invented evidence, invalid dates, overlaps, reminder budget and critical bypass, owner changes of mind, context ranking/exclusion/redaction/owner scope, duplicate requests/actions, provider failure/no configuration, model-call/deep/cost limits, prompt module selection, explanation safety, telemetry privacy, registry-only behavioral interventions, observed intervention outcomes, and rejection of unavailable owner commitment references.

These tests grade transitions, policy effects, persisted intent boundaries, and invariants. They do not require exact prose from a live model or an OpenAI API key.
