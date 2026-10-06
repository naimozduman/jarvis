---
title: "AI Gateway Boundary"
document_id: "docs::VERCEL_AI_GATEWAY"
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

# Role

An AI Gateway is one possible model transport. It does not own JARVIS state or model identity.

## Contract

The adapter:
- receives a bounded context/request,
- uses strict structured output where supported,
- disables hosted storage when feasible,
- returns normalized usage/error metadata,
- never owns conversation continuity.

## Authentication

Gateway credentials or platform identity remain server-side. Direct-provider keys and gateway credentials are separate.

## Routing

Use logical JARVIS routes from `MODEL_RUNTIME.md`. Exact provider/model IDs require a live compatibility probe before production use.

Do not infer support for:
- structured output,
- tool use,
- context size,
- reasoning controls,
- free-tier status

from model naming alone.

## Cost policy

The former zero-cost-only admission strategy is superseded by `COST_AND_MODEL_POLICY.md`.

Still preserve:
- hard spend guards,
- explicit route configuration,
- no silent paid fallback,
- usage reconciliation,
- fail-closed handling when cost/route status is unknown.

## Compatibility test

A candidate Brain model must prove:
- exact schema compliance,
- required output size,
- stable error handling,
- acceptable latency/cost,
- idempotent replay at the JARVIS layer.

Catalog listing alone is not enough.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Vercel AI Gateway boundary

October 5, 2026: this document retains technical boundaries and dated operational reports. The reconciliation candidate received safe Git and static checks only; deployment IDs, prior test results and release commands below retain their original dates and scope. Read `docs/INDEX.md` and `DEFERRED_VALIDATION.md` at the repository root before implementation or validation. No production state was queried and no release operation was performed in this phase.

## Adapter contract

The Vercel AI Gateway adapter uses the OpenAI-compatible Responses endpoint
`https://ai-gateway.vercel.sh/v1` with invocation-local Vercel OIDC identity resolved by the entrypoint and passed explicitly to the adapter. It preserves the
existing structured decision schema and sends `store: false`; it does not adopt hosted response or
conversation storage as canonical JARVIS state.

The adapter explicitly disables the OpenAI client's automatic HTTP retries (`maxRetries: 0`).
One canonical model attempt issues one Gateway HTTP request, including on connection and retryable
provider failures. Any later attempt requires a separately admitted canonical operation. This does
not pin a provider, select another model, or change Gateway-managed routing.

For the current platform interface, see Vercel's [AI Gateway documentation](https://vercel.com/docs/ai-gateway),
[SDKs and APIs reference](https://vercel.com/docs/ai-gateway/sdks-and-apis), and
[authentication guidance](https://vercel.com/docs/ai-gateway/authentication-and-byok). These links
are operator references only; Phase 3.6 made no live request.

## Authentication boundary

- The adapter uses the invocation-local `VERCEL_OIDC_TOKEN` view only when `JARVIS_MODEL_PROVIDER=vercel-ai-gateway`; ambient process state is not authority.
- It never reads or sends `AI_GATEWAY_API_KEY`.
- `OPENAI_API_KEY` belongs to the separate direct OpenAI adapter and is forbidden in zero-cost mode.
- Secrets remain server-side only and are not returned in health, logs, errors, Convex records, or
  local bridge traffic.

## Current public Free Tier catalog — 2026-09-02

The corrected public-catalog verifier successfully queried Vercel metadata using the exact
eligibility proof `data[].tags` contains `free`. It found **15** exact Free Tier IDs:

```text
fish-audio/s1
fish-audio/s1-free
fish-audio/s2-pro
fish-audio/s2-pro-free
fish-audio/s2.1-pro
fish-audio/s2.1-pro-free
fish-audio/transcribe-1
fish-audio/transcribe-1-free
inclusionai/ling-3.0-flash-fin
inclusionai/ling-3.0-flash-fin-free
minimax/minimax-m2.7
minimax/minimax-m2.7-free
minimax/minimax-m3
minimax/minimax-m3-free
poolside/laguna-s-2.1-free
```

Eight Fish Audio entries are speech/transcription rather than plausible Brain routes. The seven
language candidates and public metadata relevant to JARVIS are:

| Exact ID | Provider / modality | Context / max output | Reasoning and tool metadata | Structured JSON proof | Status |
| --- | --- | --- | --- | --- | --- |
| `inclusionai/ling-3.0-flash-fin` | InclusionAI, text → text | 262,144 / 32,768 | `reasoning`, `tool-use`; `tools`, `tool_choice`, `reasoning`, `include_reasoning` | Not exposed per model | Candidate only |
| `inclusionai/ling-3.0-flash-fin-free` | InclusionAI, text → text | 262,144 / 32,768 | Same public tool/reasoning parameters | Not exposed per model | Candidate only |
| `minimax/minimax-m2.7` | MiniMax, text → text | 204,800 / 131,000 | `reasoning`, `tool-use`, implicit caching | Not exposed per model | Candidate only; nonzero list price |
| `minimax/minimax-m2.7-free` | MiniMax, text → text | 196,608 / 196,608 | `reasoning`, `tool-use` | Not exposed per model | Candidate only |
| `minimax/minimax-m3` | MiniMax, text/image/PDF → text | 512,000 / 512,000 | `reasoning`, `tool-use`, vision, file input, implicit caching | Not exposed per model | Candidate only; nonzero list price |
| `minimax/minimax-m3-free` | MiniMax, text/image → text | 1,048,576 / 1,048,576 | `reasoning`, `tool-use`, vision | Not exposed per model | Candidate only |
| `poolside/laguna-s-2.1-free` | Poolside, text → text | 262,144 / 32,768 | `reasoning`, `tool-use` | Not exposed per model | Candidate only |

The catalog proves current provider availability, exact Free Tier eligibility, modalities, context
limits, and shown reasoning/tool parameters. It exposes no exact per-model structured-output
compatibility field. Vercel documents `text.format` structured output but notes compatibility
varies by model. This phase forbids a live inference call, so structured JSON compatibility is
**unproven** for every candidate and no route is configured.

The later logical candidates, pending a separately authorized structured-output compatibility probe,
are `fast=minimax/minimax-m2.7`, `standard=minimax/minimax-m3`, and
`deep=minimax/minimax-m3`. They are candidates only, not configured routes. The two MiniMax base
IDs demonstrate the corrected semantics: each has nonzero public list pricing and Vercel's current
exact `free` eligibility tag.

## Zero-cost route admission

A zero-cost adapter call is admitted only if all conditions hold:

1. The provider is Vercel AI Gateway.
2. `JARVIS_ZERO_COST_MODE=true`.
3. The selected exact route ID is configured rather than `not_configured`.
4. The exact route ID is present in `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS` from the deployment-time
   catalog verifier. Its only proof is Vercel's current public `data[].tags` exact value `free`.
5. The Vercel OIDC token is available at runtime.
6. A current-month account-usage snapshot, canonical exact-cost receipts, and a conservative route
   rate-card upper bound exist and leave room below the configured Free Tier credit guard.

Otherwise the adapter produces an explicit `not_configured` result with the safe
`zero_cost_model_unverified` or `not_configured` category, or a `provider_unavailable` result for
missing/unknown/exhausted Free Tier accounting. It does not call an alternative model, direct
OpenAI, BYOK, a paid Gateway path, purchased credits, or auto top-up.

## Failure semantics

| Condition | Model gateway result | Side effect |
| --- | --- | --- |
| No configured free model | `not_configured` | No provider request. |
| Missing, malformed, stale, or changed catalog eligibility | `not_configured` | No provider request. |
| Nonzero provider list price with current `free` eligibility | Eligible for guard evaluation | No inference until the guard also permits it. |
| Missing Vercel OIDC identity | `not_configured` | No provider request. |
| Missing/stale accounting, unknown receipt, or guard threshold reached | `provider_unavailable` | No request, purchase, or fallback. |
| Gateway quota/rate limit or provider outage after admission | `unavailable` | No synthetic completion or paid fallback. |
| Invalid structured result | `invalid_model_output` or `incomplete_output` | No untyped model action enters policy. |

The Brain/policy workflow remains responsible for durable state transitions. A model adapter result
does not itself send a WhatsApp message, alter a job lease, or change a delivery state.
