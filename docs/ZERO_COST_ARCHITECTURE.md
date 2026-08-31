# Zero-cost architecture

## Status and scope

Phase 3.6 defines a repository-side, fail-closed zero-cost model boundary. It does **not** create
or configure a Vercel project, an AI Gateway route, a model catalog configuration, or any provider
credential. It does not make a model request.

The former Railway staging architecture is **abandoned / superseded by the zero-cost architecture**
for the next runtime phase. Its documents remain in the repository as historical records.

## Cost-safety invariants

When `JARVIS_ZERO_COST_MODE=true`, all of the following are mandatory:

| Invariant | Repository enforcement |
| --- | --- |
| No direct paid OpenAI route | Configuration rejects `JARVIS_MODEL_PROVIDER=openai-responses` and rejects `OPENAI_API_KEY`. |
| No paid Gateway key route | Configuration rejects `AI_GATEWAY_API_KEY`; the Gateway adapter only accepts a Vercel OIDC identity. |
| No model-name pricing inference | Names such as `free`, provider names, and zero rate-card placeholders are never accepted as evidence. |
| No automatic paid fallback | The only configured adapter is Vercel AI Gateway; missing or rejected routes return `not_configured`. |
| Unknown price fails closed | An exact model ID must appear in `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS`, which is produced by the public-catalog verifier. |
| Missing free model is explicit | An absent configured model becomes the non-provider identifier `not_configured`; it cannot be substituted. |

The `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS` value is an allow-list, not a price cache. It is accepted
only as the output of the target-environment catalog check. Platform secret/variable access remains
privileged; operators must not invent or manually guess this value.

## Deployment-time catalog verification

The repository command is:

```text
pnpm zero-cost:verify-models
```

It is deliberately a deployment-time gate, not a local development dependency. In zero-cost mode it
reads the public Gateway model catalog and verifies every configured route against all of these
conditions:

1. The exact configured model ID is present.
2. The catalog marks it `free`.
3. Every supplied pricing leaf is an explicit numeric `0`; absent, string, null, fractional, or
   otherwise unknown pricing fails the check.

On success it emits a candidate `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS` value for the same target
environment. On any transport, HTTP, catalog-shape, tag, or pricing uncertainty it exits nonzero.
It does not make an inference request to a model.

Phase 3.6 repository verification does not invoke this command because it would contact the
provider catalog. That is a separately authorized Phase 3.6B operator action.

## Runtime routing

```text
Vercel invocation
  -> VERCEL_OIDC_TOKEN supplied by platform
  -> exact route ID is in verified catalog allow-list?
       no  -> ModelGateway result: not_configured / zero_cost_model_unverified
       yes -> Vercel AI Gateway Responses endpoint (store: false)
```

The adapter has no code path from a rejected Gateway route to direct OpenAI, a paid Gateway key, or
an alternative model. A provider outage after a route has passed verification becomes the safe
`unavailable` result and leaves canonical state unchanged until the normal durable policy path
decides what to do.

## Configuration boundary

The relevant variables are documented in [`.env.example`](../.env.example). The important
separation is:

- `OPENAI_API_KEY` belongs only to the non-zero-cost direct OpenAI adapter and is forbidden in
  zero-cost mode.
- `AI_GATEWAY_API_KEY` is never consumed by the application and is forbidden in zero-cost mode.
- `VERCEL_OIDC_TOKEN` is platform-injected in a Vercel function. It is not a local developer
  credential and must never be committed.
- `JARVIS_VERCEL_AI_GATEWAY_{FAST,STANDARD,DEEP}_MODEL` are exact configured IDs, not pricing
  claims.
- `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS` is the explicit deployment verifier output. An empty list
  intentionally blocks all zero-cost routes.

See [VERCEL_AI_GATEWAY.md](VERCEL_AI_GATEWAY.md) for the adapter details and
[VERCEL_RUNTIME.md](VERCEL_RUNTIME.md) for the stateless execution boundary.
