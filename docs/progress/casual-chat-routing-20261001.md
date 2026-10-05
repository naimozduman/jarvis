# Deterministic casual-chat deployment and fast-model comparison

2026-10-01. Production project: existing `jarvis-api-staging`. Deployment:
`dpl_9frdTy15ApqGYkeL8p4kY7rYExE3`. Alias: <https://jarvis-api-staging.vercel.app>.
Baseline Git commit: `cb2284b8a6854cb8ede29ea82aebe1b5846337f9`; deployment includes
the accepted uncommitted implementation and this routing repair. No database migration or
production environment/budget change was required.

## Production behavior

Only exact whole-turn casual matches from a verified enrolled owner on a trusted private direct
Telegram or WhatsApp surface request `openai/gpt-6-luna`, low. Unknown, mixed, referential,
context-dependent, action, planning, reminder, research and tool requests retain the configured
standard medium route. No generative classifier is used.

An owner-scoped read checks unresolved canonical conflicts, open clarifications and pending
approvals independently of context selection. Missing safety data, inferred/stale/conflicting
context and high-consequence flags retain medium. Context assembly, prompts, schema, request
admission, accounting, policy, validators, actions, execution and conversational truth remain on
their existing paths. The effective low configuration is used for both admission and generation.
Routing logs contain only canonical request IDs, selected route, effort, reason category, phase
and latency. Replay returns before a new classification/model call.

The routing matrix covers casual turns, ambiguous follow-ups, sensitive requests, mixed intents,
non-owner/group surfaces, unavailable safety data and canonical safety blockers. Full CI,
build/typecheck/lint/bundle/secret checks passed. The disposable PostgreSQL two-role integration
gate passed 10/10 after restarting the stopped local test cluster. Production readiness reports
configuration, database, queue and model passing. Telegram webhook remains configured with zero
pending updates; no WhatsApp, authority, proactive, group, alternate-production-model or
deep-escalation gate was changed.

## Isolated comparison

Run `2d7c961b-73a3-435e-94a5-37f04fe730a1`. Three candidates, the same frozen 18-case
synthetic suite, one generation per case/candidate. Candidate order rotates by case. No owner
private data, transport sends, model fallback, schema weakening, candidate-specific prompt edits
or production promotion. The benchmark forces each candidate across the whole suite; many of
these ambiguous cases remain medium in production. Prompt/context content is frozen; canonical
request and conversation IDs differ for independent persistence.

| Gateway request          | Effort | Strict schema | Grounding/context review      | Model median | Model range    | Input tokens | Output tokens | Reasoning tokens | Total tokens | Exact Gateway cost |
| ------------------------ | ------ | ------------- | ----------------------------- | ------------ | -------------- | -----------: | ------------: | ---------------: | -----------: | -----------------: |
| `openai/gpt-6-luna`      | low    | 18/18         | 18/18 without observed errors | 3,229.5 ms   | 2,057–4,298 ms |       52,011 |         5,583 |            1,175 |       57,594 |        $0.00473051 |
| `openai/gpt-6-luna-fast` | low    | 18/18         | 18/18 without observed errors | 2,752 ms     | 1,885–3,921 ms |       52,063 |         5,832 |            1,191 |       57,895 |        $0.00972302 |
| `openai/gpt-5.4-nano`    | none   | 18/18         | 13/18 without observed errors | 3,547 ms     | 1,846–7,349 ms |       52,042 |         7,377 |                0 |       59,419 |        $0.01446869 |

Output totals already include reasoning; total tokens are input + output. Total paid comparison
cost: $0.02892222. Median synthetic Brain processing (not Telegram delivery) was 3,569.5 ms,
3,141 ms and 4,054 ms respectively. TTFT is unavailable because the accepted adapter is
non-streaming. No fake draft text was produced. Costs are Gateway receipts, including observed
cache effects, not rate-card estimates. One observation per case does not establish a latency SLA
or a statistically stable ranking.

Live catalogs verified strict-output parameters, reasoning settings, context windows and rates
before generation. New profiles exist only inside the protected synthetic evaluator; production
admission allowlists remain unchanged. They include regional/tier prices and enforce documented
combined output/reasoning caps against actual receipts. Luna Fast requests the fast slug; Gateway
returns the underlying `openai/gpt-6-luna` model ID. See [Fast Mode documentation](https://vercel.com/docs/ai-gateway/models-and-providers/fast-mode).

Manual qualitative review found the two Luna variants concise and grounded. Nano repeated the
current question as prior history, asserted normality for an unresolved referent, inferred report
progress from an open commitment, treated the protected work block as report time and asked for
a timezone already supplied as UTC. For `keep it simple`, it proposed an unsolicited `replan`
action. Policy denied that action; no execution occurred, and deterministic truth reconciliation
persisted a truthful rejection. Counting that task error gives 12/18 Nano turns without observed
grounding/task errors. These are documented reviewer judgments rather than calibrated quality
scores.

All three greeting replays returned `duplicate` and the original receipts. Canonical inspection
confirmed 54 model receipts, one denied synthetic action, zero action executions and zero
transport deliveries. Exact-run cleanup returned HTTP 200 and retained durable accounting/action
evidence. [Raw results, responses, per-call usage/latency, replay and review notes](casual-chat-fast-comparison-20261001.json).

Luna Fast saved 477.5 ms (14.8%) at the median for about 2.06 times the cost. Nano was slower,
costlier and less reliable in this suite. No candidate was promoted. Keep the authorized ordinary
Luna-low route; the small measured Fast benefit does not by itself establish a reason to change it.

## Outstanding live measurement

A fresh owner Telegram greeting was requested after final deployment. At the last inspection no
new authenticated owner update had appeared. The previous accepted owner canary at
2026-10-01T08:11:40.109Z used medium: model 2,962 ms, canonical ingress to Bot API acceptance
7,711 ms. Those prior timings are not evidence for the new low route. Actual new webhook-to-final
send latency remains unmeasured until one fresh owner message arrives; no automatic owner test
message or historical resend was issued.
