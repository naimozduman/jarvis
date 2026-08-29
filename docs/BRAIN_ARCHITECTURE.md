# Brain architecture

## Purpose

`@jarvis/brain` is the Phase 2 intelligence layer. It turns a bounded, owner-scoped context packet into a validated `BrainDecision`; it is not a database client, connector client, tool runtime, or source of durable truth.

PostgreSQL remains canonical for messages, brain requests, manifests, model runs, decisions, memory candidates, plans, reminders, overrides, approvals, actions, and audit history. OpenAI responses are one-turn computations only.

## Request lifecycle

1. A local/test channel persists the inbound message and starts an idempotent `BrainRequest`.
2. The repository loads owner-scoped candidates and `ContextAssembler` emits a bounded `ContextManifest`.
3. `PromptAssembler` chooses versioned policy modules for the request purpose.
4. A deterministic router and budget guard choose `fast`, `standard`, or enabled `deep`.
5. `ModelGateway` returns a strict model intent, a safe failure, or `not_configured`.
6. The model result is parsed again, checked against manifest record IDs, and materialized with server-owned IDs, owner scope, and timestamps.
7. The safe decision, candidates, plan/reminder proposals, and clarification are persisted.
8. Action intents become allowlisted `ProposedAction` records and pass the Domain policy/approval/execution/audit transaction. The model never calls an executor.
9. A local outbound response record and safe telemetry are persisted. No external transport exists.

Duplicate requests return the existing request/decision reference and do not perform another model call or action.

## Package boundary

`@jarvis/brain` depends on contracts, the narrow database repository port, Domain action pipeline, security policy boundary, and observability port. The database package does not import the brain. The OpenAI SDK appears only in `model/openai-responses-gateway.ts`.

## Persistent provenance

Brain-specific persistence uses `brain_requests`, `context_manifests`, `context_manifest_records`, `model_runs`, `brain_decisions`, and `brain_decision_evidence`. The tables record safe summaries, record references, route/model metadata, token/cost metadata where available, validation state, and execution results. They do not store full prompts, provider payloads, raw provider reasoning, API keys, or hidden chain-of-thought.
