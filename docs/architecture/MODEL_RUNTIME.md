---
title: "Model Runtime V5"
document_id: "docs::MODEL_RUNTIME"
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

# Model neutrality

JARVIS identity and memory do not live in a model provider.

`ModelGateway` is provider-neutral and returns strict structured output or a safe failure.

## Logical routes

Use logical routes such as:
- `fast`: low-cost/low-latency classification and simple reasoning,
- `standard`: normal JARVIS decisions,
- `deep`: complex planning/research decisions,
- `local_private`: sensitive/private fallback where supported,
- `realtime_voice`: selected speech-to-speech or streaming path.

Concrete model IDs are configuration and should be reviewed independently from architecture.

## Router

Routing considers:
- task complexity,
- structured-output/tool needs,
- privacy class,
- latency,
- context size,
- current provider health,
- budget.

The router does not grant capabilities.

## State

Provider conversation IDs and hidden state are disposable. Canonical continuity comes from ContextManifest and durable state.

## Telemetry

Record safe:
- route,
- provider/model ID,
- reasoning/effort setting,
- latency,
- token usage where supplied,
- configured cost estimate,
- validation status,
- error class.

Do not log prompts, credentials, raw provider responses, or hidden reasoning.

## Failure

Invalid schema, provider error, budget violation, or unavailable route produces no action. Preserve the event and use a safe fallback/retry path.

## Testing

Provider-free fake gateways remain required. Live model probes are gated and separately observable.

## V5 accounting and provenance gate

“Token usage where supplied” applies to telemetry fields, not permission to spend without accounting. Every paid call requires conservative pre-call reservation and a reconcilable receipt. Unknown or stale paid accounting blocks new billable work. COST_AND_MODEL_POLICY.md owns the rule. Preserve the existing ModelBudgetGuard and test each caller plus concurrent reservations before expansion.

The candidate design adds registered module content digests and ordered assembly provenance. Existing promptVersion fields remain intact. No generated preview is active until a versioned loader migration and behavioral evaluation pass. A fallback must preserve required privacy, output compatibility and authority, not merely produce text.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Model runtime

October 5, 2026: this document retains technical boundaries and dated operational reports. The reconciliation candidate received safe Git and static checks only; deployment IDs, prior test results and release commands below retain their original dates and scope. Read `docs/INDEX.md` and `DEFERRED_VALIDATION.md` at the repository root before implementation or validation. No production state was queried and no release operation was performed in this phase.

`ModelGateway` is provider-neutral. `FakeModelGateway` supplies deterministic fixtures for all standard tests. `NotConfiguredModelGateway` reports a clear `not_configured` result and no decision when the selected route has no permitted credential—for example, a direct OpenAI route without `OPENAI_API_KEY`; it does not apply to a Vercel AI Gateway route that has deployment OIDC.

The optional OpenAI adapter uses the current Responses API and strict Zod Structured Outputs. It sets `store: false`, `truncation: 'disabled'`, and reasoning context to `current_turn`; it supplies neither an OpenAI Conversation nor `previous_response_id`, and exposes no hosted tools or functions. PostgreSQL remains the continuity source.

Logical routes are configured rather than scattered; their model IDs, reasoning effort, verbosity, output caps, and price cards are validated environment values. The first bounded live Gateway/OIDC probe used standard route `openai/gpt-6-luna` with `medium` reasoning effort. It did not establish a permanent default, fallback, or deep route. Deep routing always needs explicit enablement, a remaining deep-call allowance, and the daily limit.

The runtime records route, configured/actual model ID, reasoning effort, safe status/error category, latency, token counts when the provider supplies them, cached/reasoning tokens, and a configured-price estimate. It never logs a full prompt, API key, raw provider response, encrypted reasoning item, or hidden chain-of-thought.

Dynamic context selection and full-request admission are independent. The admission profile and request-admission implementation bound complete text/JSON request bytes, framing, provider capacity, combined output and conservative worst-case spend; unknown or stale accounting fails closed. `ModelBudgetGuard` enforces configured call, deep-route and daily limits. Gateway HTTP retries remain disabled (`maxRetries: 0`), so each admitted model attempt has one HTTP request. Provider failures return a safe result and do not create a decision, candidate, or action. See the slug-qualified ADR `0016-provider-neutral-request-admission` and the retained OIDC/recovery ADR `0016-request-scoped-vercel-oidc-and-bounded-recovery`.
