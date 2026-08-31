# Vercel AI Gateway boundary

## Adapter contract

The Vercel AI Gateway adapter uses the OpenAI-compatible Responses endpoint
`https://ai-gateway.vercel.sh/v1` with a platform-injected `VERCEL_OIDC_TOKEN`. It preserves the
existing structured decision schema and sends `store: false`; it does not adopt hosted response or
conversation storage as canonical JARVIS state.

For the current platform interface, see Vercel's [AI Gateway documentation](https://vercel.com/docs/ai-gateway),
[SDKs and APIs reference](https://vercel.com/docs/ai-gateway/sdks-and-apis), and
[authentication guidance](https://vercel.com/docs/ai-gateway/authentication-and-byok). These links
are operator references only; Phase 3.6 made no live request.

## Authentication boundary

- The adapter uses `VERCEL_OIDC_TOKEN` only when `JARVIS_MODEL_PROVIDER=vercel-ai-gateway`.
- It never reads or sends `AI_GATEWAY_API_KEY`.
- `OPENAI_API_KEY` belongs to the separate direct OpenAI adapter and is forbidden in zero-cost mode.
- Secrets remain server-side only and are not returned in health, logs, errors, Convex records, or
  local bridge traffic.

## Zero-cost route admission

A zero-cost adapter call is admitted only if all conditions hold:

1. The provider is Vercel AI Gateway.
2. `JARVIS_ZERO_COST_MODE=true`.
3. The selected exact route ID is configured rather than `not_configured`.
4. The exact route ID is present in `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS` from the deployment-time
   catalog verifier.
5. The Vercel OIDC token is available at runtime.

Otherwise the adapter produces an explicit `not_configured` result with the safe
`zero_cost_model_unverified` or `not_configured` category. It does not call an alternative model,
direct OpenAI, or a paid Gateway path.

## Failure semantics

| Condition | Model gateway result | Side effect |
| --- | --- | --- |
| No configured free model | `not_configured` | No provider request. |
| Unknown / stale / nonzero catalog pricing | `not_configured` | No provider request. |
| Missing Vercel OIDC identity | `not_configured` | No provider request. |
| Gateway connection or provider outage after admission | `unavailable` | No synthetic completion or paid fallback. |
| Invalid structured result | `invalid_model_output` or `incomplete_output` | No untyped model action enters policy. |

The Brain/policy workflow remains responsible for durable state transitions. A model adapter result
does not itself send a WhatsApp message, alter a job lease, or change a delivery state.
