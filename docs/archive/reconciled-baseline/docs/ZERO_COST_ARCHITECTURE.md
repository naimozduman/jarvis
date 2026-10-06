# Zero-cost architecture

## Status and scope

Phase 3.6B defines a repository-side, fail-closed **Vercel AI Gateway Free Tier** boundary. It
does **not** mean every provider list-price field is zero: Vercel's current Free Tier includes a
monthly Gateway allowance, and eligible models can retain provider list-price metadata while
consuming that included allowance. See [Vercel AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing).

This work does not purchase credits, enable auto top-up, make an inference request, or configure a
runtime credential or callback secret. The completed Neon migration remains a separate manual
staging operation and is not part of this model boundary.

The former Railway staging architecture is **abandoned / superseded by the zero-cost architecture**
for the next runtime phase. Its documents remain in the repository as historical records.

## Cost-safety invariants

When `JARVIS_ZERO_COST_MODE=true`, all of the following are mandatory:

| Invariant | Repository enforcement |
| --- | --- |
| No direct paid OpenAI route | Configuration rejects `JARVIS_MODEL_PROVIDER=openai-responses` and rejects `OPENAI_API_KEY`. |
| No paid Gateway key route | Configuration rejects `AI_GATEWAY_API_KEY`; the Gateway adapter only accepts a Vercel OIDC identity. |
| No model-name or price inference | A suffix, provider name, marketing label, cache rate, zero list price, or nonzero list price is never eligibility evidence. |
| No automatic paid fallback | The only configured adapter is Vercel AI Gateway; missing or rejected routes return `not_configured`. |
| Current Free Tier proof fails closed | An exact model ID must appear in `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS`, produced only from Vercel's current public metadata eligibility signal. |
| Missing free model is explicit | An absent configured model becomes the non-provider identifier `not_configured`; it cannot be substituted. |
| No paid-credit path | JARVIS has no credit purchase, auto-top-up, BYOK, or paid-tier fallback implementation; an account with purchased credits or enabled auto top-up fails deployment review. |

The `JARVIS_ZERO_COST_VERIFIED_MODEL_IDS` value is an allow-list, not a price cache. It is accepted
only as the output of the target-environment catalog check. Platform secret/variable access remains
privileged; operators must not invent or manually guess this value from a model name or price.

## Deployment-time catalog verification

The repository command is:

```text
pnpm zero-cost:verify-models
```

It is deliberately a deployment-time gate, not a local development dependency. In zero-cost mode it
reads the public Gateway model catalog and verifies every configured route against all of these
conditions:

1. The exact configured model ID is present.
2. The catalog has the documented `{ object: "list", data: [...] }` envelope.
3. The exact model has a `tags` array of strings containing Vercel's current exact Free Tier signal
   `free`.

On success it emits a machine-readable report containing the catalog URL, eligibility field/value,
all exact eligible IDs, configured IDs, verified configured IDs, and failures. On any transport,
HTTP, JSON, catalog-shape, missing/malformed eligibility field, or tag uncertainty it exits
nonzero. It does not make an inference request to a model.

Pricing fields are deliberately not parsed as eligibility evidence. The prior literal-zero pricing
predicate was incorrect because Vercel can mark a model `free` while retaining provider list prices
that consume the included Free Tier allowance.

Phase 3.6 repository verification does not invoke this command because it would contact the
provider catalog. That is a separately authorized Phase 3.6B operator action.

## Conservative included-credit guard

The provider manages the included allowance. Before each JARVIS inference attempt, the application
requires all of the following conservative accounting inputs:

```text
current-month, server-only Vercel usage snapshot
  + canonical Neon sum of exact Gateway receipts after that snapshot
  + worst-case request cost from an explicit current route rate card
  <= JARVIS_ZERO_COST_MONTHLY_CREDIT_GUARD_USD ?
       yes -> one exact verified model request
       no  -> provider_unavailable; no purchase and no fallback
```

- Vercel currently documents $5/month of Free Tier credits. The JARVIS default guard is **$3**,
  leaving a 40% reconciliation margin; its configuration maximum is $4, retaining at least a 20%
  reserve. The guard is intentionally below the included allowance, not a claim of zero price.
- `JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD` and
  `JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_AS_OF` are a server-only current-UTC-month snapshot
  pair. Missing, partial, stale, future, or unreadable accounting blocks the request.
- The canonical `model_runs` ledger adds only exact Vercel Gateway cost metadata from
  `providerMetadata.gateway.cost` (or the documented snake-case form). At the database precision
  boundary, a receipt rounds upward rather than down.
- A completed Gateway run without a safely reported receipt is a circuit breaker. It blocks the
  next zero-cost request; JARVIS never substitutes a zero, token estimate, or provider list price.
- The configured input/output rate card is a pessimistic upper bound for the next request. Missing
  or partial rates fail closed, and cached-token discounts are intentionally ignored.

The guard reads canonical Neon state, not process memory. It cannot enable auto top-up, purchase
credits, invoke BYOK, or call a paid-tier fallback API. A quota/rate limit remains ordinary
`unavailable` rather than a reason to change infrastructure.

## Runtime routing

```text
Vercel invocation
  -> VERCEL_OIDC_TOKEN supplied by platform
  -> exact route ID is in verified catalog allow-list?
       no  -> ModelGateway result: not_configured / zero_cost_model_unverified
  -> current accounting and guard allow one request?
       no  -> ModelGateway result: provider_unavailable / free_tier_unavailable
       yes -> Vercel AI Gateway Responses endpoint (store: false)
```

The adapter has no code path from a rejected Gateway route to direct OpenAI, a paid Gateway key,
purchased credits, auto top-up, or an alternative model. A provider outage or quota limit after
admission becomes the safe `unavailable` result and leaves canonical state unchanged until the
normal durable policy path decides what to do.

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
- `JARVIS_ZERO_COST_MONTHLY_CREDIT_GUARD_USD`, the paired current-month usage snapshot, and each
  configured route's input/output guard rates are server-only. They are not configured in this
  repository pass; absent values intentionally make an attempted call unavailable.
- `DATABASE_URL` for a Vercel runtime is a separate server-only pooled Neon credential. It is
  neither the removed migrations credential nor a browser or Convex value.

See [VERCEL_AI_GATEWAY.md](VERCEL_AI_GATEWAY.md) for the adapter details and
[VERCEL_RUNTIME.md](VERCEL_RUNTIME.md) for the stateless execution boundary.
