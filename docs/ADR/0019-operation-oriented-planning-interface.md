# 0019: Versioned operation-oriented planning interface

Status: accepted by explicit owner instruction, 2026-09-29. Local implementation and isolated synthetic comparison only. No deployment or owner WhatsApp activation.

## Decision

Supersedes ADR 0018's schema-only/no-prompt-change experiment for newly generated proposals. Keep the server contract flexible_delta_v2 and its unchanged canonical anchor/overlap validator. Add prompt module planning-flexible-delta-v2@3.0.0, included whenever planning is available. It explicitly defines existing schedules as read-only constraints, forbids reproducing any existing block, states that omission preserves state, and instructs the model to propose only requested changes around constraints.

The model plan envelope now contains operations and a separate newFlexibleBlocks array. schedule_existing_commitment accepts only commitmentId, startsAt and endsAt. An owner-scoped repository resolves the visible, known canonical commitment; metadata is never extracted from prose or reconstructed by the model. The server supplies title, priority, provenance, role=commitment and class=commitment_linked, derives duration from timing, and records server-only commitmentSchedules bindings. Fixed, terminal, missing, wrong-owner, duplicate or already-scheduled commitments in the current plan are rejected. This narrow interface schedules unscheduled commitments; it provides no reschedule/delete/protected mutation operation.

New free-form blocks carry only title and timing. They require a distinct trusted owner-intent title allowlist from current state, default empty. The model cannot grant this authorization. Duplicate titles and exact existing-state collisions are denied in addition to unchanged overlap validation; no fuzzy normalization is used. This is an authorization boundary, not an inference that arbitrary free text proves novelty. Current production compositions provide no such allowlist, so free-form creation stays denied until a trusted caller explicitly supplies one.

Application locks the day plan, then re-reads and locks each bound commitment. Metadata/status/protection changes or concurrent scheduling reject the proposal before writes. The canonical validator still checks live anchors and overlaps. Proposal JSON is immutable; application records its delta separately. Existing conversational reconciliation and response/action replay are unchanged.

## Compatibility and audit

The model wire envelope intentionally rejects obsolete proposedBlocks emissions. Existing persisted proposal bodies remain the same full canonical PlanProposal representation and retain legacy read compatibility. The optional server-only commitmentSchedules field requires no SQL migration or history rewrite. Existing v2 records without bindings keep existing validation; new operation-derived proposals contain bindings. Invalid model emissions remain non-executable in the existing bounded output audit. Protected mutations remain unavailable regardless of identity or requested wording.

## Validation and comparison

Provider-free tests cover canonical ID/time resolution and metadata, prompt provenance, omission/preservation, restatement and unauthorized free-form rejection, unavailable protected edits, duplicate scheduling, real overlap, truthful pending/rejected wording, replay, immutable proposal history, and apply-time canonical races. Isolated PostgreSQL tests exercise lookup scope, transactional operation apply, original JSON retention and action replay.

Frozen synthetic Case 3 runs once each on openai/gpt-6-luna medium and meta/muse-spark-1.3-contributor medium, even if Luna fails. Both receive identical updated instructions/schema and byte-identical original input/context, anchor and controls. Live Gateway capability/profile checks, provider-aware conservative admission, existing limits, exact receipts and one-call locks remain in force. No fallback, extra model, tuning between candidates, routing/default/reasoning/budget change or external action is authorized. Evidence is stored outside the repository under outputs/case3-operations-v5-20260929.

## Recorded outcome

Both one-call candidates passed schema and plan validation with the identical commitment operation for 2099-04-07 17:30–18:00 UTC, no anchor emission and no free-form blocks. Neither proposed an apply action, so both persisted “The plan change is proposed and has not been applied.” Muse's raw “Scheduled” claim was reconciled to pending. Replay produced identical responses and no extra model calls. Exact combined Gateway charge was $0.001566825. Evidence: outputs/case3-operations-v5-20260929/RESULTS.md outside the repository. No winner/default was selected and no deployment occurred.
