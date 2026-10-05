# AI router and costs

Responsibility: model/provider selection, local capability, cost accounting and hard limits. Permission and context boundaries apply to every tier; see [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

**Confirmed requirements:** deterministic commands, a useful local phone model, inexpensive cloud intelligence, stronger reasoning when deserved, multiple providers, manual model choice and code-enforced spending limits. S2-M0033/M0035/M0051 and the current request establish this. The exact model catalog, numeric budget and deployment are not chosen. [R055–R060]

## Routing contract

| Route              | Appropriate work                                                                                    | Admission criteria                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Deterministic code | App launch, known commands, exact lookup, date/rule checks, deduplication, policy and cost checks   | Supported operation, current authority and valid inputs; no LLM cost                            |
| Phone model        | Selected extraction/classification, private cached-text tasks, limited offline interaction          | Installed model, acceptable quality, sufficient RAM/battery/thermal state, permitted local data |
| Inexpensive cloud  | Routine summaries, briefings, drafts and light reasoning                                            | Local path inadequate or inefficient; provider allowed; bounded evidence; cost reservation      |
| Strong cloud       | Difficult reasoning, consequential planning, complex evidence reconciliation, selected Council work | Task merits capability; explicit route rationale; privacy and budget permit it                  |

“Code → local → cheap cloud → premium” is the default economy principle, not a requirement to waste four sequential attempts. A clearly difficult task can route directly to an appropriate strong model if permitted. A simple exact answer should not call any model. Routing considers capability, uncertainty, latency, privacy, network, energy, expected cost, context size and tool support.

Separate intent/plan selection from execution. Models return validated typed proposals; the execution broker applies policy. The router cannot treat “the model asked for it” as authorization. A retry/fallback is another billed action under the same parent task, not a new uncapped task.

## Provider adapters and personal chat

Support Auto plus a manual model/provider choice without changing the canonical conversation and memory. Candidate providers include OpenAI, Anthropic, Google, xAI, Perplexity and others with suitable APIs. These are provider options, not a commitment to integrate all on day one. An aggregator can be an adapter; it is not the permanent source of personal memory or the only route to a model.

Adapters report model identity/version, modalities, context/output limits, tool behavior, pricing version, streaming/cancellation semantics, usage receipts, retention controls and availability. The gateway normalizes responses and errors but preserves provider-specific uncertainty. Do not silently substitute a different provider for restricted data or a user-selected model. Offer an allowed fallback or wait.

Provider chat histories are not canonical storage. Build each turn from the current conversation plus a scoped retrieved packet. Cache reusable summaries and stable context by content hash, scope, policy and model-relevant version; invalidate after corrections or revocations. A model with a huge context window still receives only relevant evidence.

### Current Vercel AI Gateway decision

On 2026-09-29, the owner approved Vercel AI Gateway with Vercel deployment OIDC for the first
cloud Brain route. This is an adapter choice, not a provider lock-in: runtime model IDs remain
validated configuration, and an OpenAI model may be selected through Gateway without adding a
direct OpenAI credential. The Gateway adapter must retain JARVIS's strict `BrainDecision` output
schema, `store: false`, bounded context/output limits, exact provider receipt accounting, and
fail-closed no-fallback behavior.

The live Gateway catalog was checked before activation. Its then-current `free` models did not
advertise `response_format` and `structured_outputs`, which the existing strict Brain adapter
requires. They are not acceptable substitutes merely because they advertise reasoning or tool
use.

The owner subsequently approved one bounded live probe with `openai/gpt-6-luna` through the
same Gateway/OIDC adapter. The probe used the standard route, `medium` reasoning effort, an
approximately 6,000-token input bound, a 2,500-token output bound, one model call, no fallback,
and deep escalation disabled. It returned a validated strict `BrainDecision` and an exact Gateway
receipt. That proof does not authorize recurring paid use, a different model, a fallback, deep
escalation, or direct-owner messaging. See D24 and the live-probe record in
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

A later fixed three-case live quality gate used the same bounded Luna route. Its normal-question
and reminder cases passed, but its replan case produced a schema-valid decision whose persisted
plan proposal was deterministically rejected for duplicating an existing hard anchor. Therefore
the route remains unapproved for direct-owner replies; do not substitute Terra, add a fallback,
or widen authority to mask that failure. The exact evidence and required corrective gate are in
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

Developer subscriptions and consumer chat subscriptions are separate from JARVIS runtime API billing. For example, OpenAI states API use is billed separately from ChatGPT subscriptions. Never assume a Codex/ChatGPT plan finances unattended JARVIS calls. [OpenAI billing guidance](https://help.openai.com/en/articles/9039756-managing-billing-settings-on-chatgpt-web-and-platform)

## Phone model selection

### 2026-09-29 admission clarification

The owner's later explicit instruction distinguishes the existing approximately 6,000-token dynamic
context-selection budget from the complete provider request. Preserve that selection budget; do not
apply it as a universal total-request cap. Full text/JSON requests may use a versioned conservative
UTF-8 byte estimate with explicit framing allowance when the approved route has no native counter,
provided both provider context capacity and the existing spend guard are independently satisfied.
Vercel Gateway's unsupported OpenAI token-count endpoint must not be retried. Unknown pricing,
context metadata or unbounded non-text inputs fail closed. Output/reasoning semantics belong to a
verified model profile; an observed cap violation blocks the profile until reverification. These
changes do not authorize deployment, a model/route/budget change or owner WhatsApp replies.
See [ADR 0016](../ADR/0016-provider-neutral-request-admission.md) for the implemented formula and audit fields.

The owner explicitly rejected a toy local feature and wants worthwhile private/offline intelligence. More RAM is useful, but the latest preference allows 12 GB. Evaluate a compact quantized model against actual tasks before naming a permanent default; model weights, runtime, KV cache, context, vision/audio assets and ordinary apps all consume memory.

LiteRT-LM provides Android-oriented local inference tooling; llama.cpp documents Android deployment of compatible local models. These establish available implementation paths, not performance on this phone or approval of a specific model. **Confirmed tooling capability; model choice needs device testing.** [LiteRT-LM overview](https://developers.google.com/edge/litert-lm/overview), [llama.cpp Android documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md)

Benchmark candidates such as appropriately licensed Gemma/Qwen-family models where supported; these are candidates, not requirements. Test intent accuracy, name/date extraction, short summarization, abstention, time to first response, sustained speed, load time, peak memory, thermal throttling and battery. Include background Home/Beeper/navigation load and both offline/online use. Do not promise a large model size from RAM alone or leave the model permanently resident if that harms daily phone use.

Use separate assets for wake word, ASR, embeddings and TTS when that is more efficient than a general model. Install/download state, license and storage requirements must be visible. No offline promise applies until necessary assets are present and tested.

## Hard Cost Governor

This is an independent deterministic service and mandatory before paid autonomous work. A provider dashboard alert, prepaid credit or an LLM instruction is not the only spending control.

| Limit                       | Required scope                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Per task / Case run         | Total model, tool, search, media and child-agent spend for a bounded run                            |
| Daily and monthly           | Owner-wide aggregate across providers, devices, retries and agents                                  |
| Per agent / Council meeting | Allocation within the parent budget, not extra money created by delegation                          |
| Per request                 | Maximum input/output, modality duration, tool count and allowed provider/model                      |
| Agent steps                 | Hard turn/tool/recursion/concurrency ceiling                                                        |
| Time                        | Per-call timeout, run deadline and maximum delegated window                                         |
| Fallback                    | Allowed destinations, maximum retries and cumulative spend; no automatic premium upgrade beyond cap |

Before dispatch, estimate a conservative upper bound using the versioned price catalog and explicit request limits. Include uncached input unless a discount is guaranteed, maximum output, billed reasoning where applicable, audio/image/search/tool charges and known provider minimums. Reject an unbounded or unpriced paid request until it can be bounded.

Atomically reserve cost against all applicable parent/child and daily/monthly limits. Concurrent workers must compete for the same balance. A useful invariant is **settled spend + outstanding reservations + new worst-case reservation ≤ each applicable cap**. A child receives part of the parent allocation; it cannot reset the budget by changing task IDs.

At completion, reconcile actual provider usage and release only the unused verified reservation. A timeout after dispatch may still be billed: retain the unresolved reservation or conservative charge, reconcile receipts, and avoid a duplicate fallback that might repeat an external effect. Cancellation is not proof of zero cost. Log pricing version, usage units, estimates, actuals and unresolved amounts without exposing sensitive prompt content.

Define accounting timezone and month boundaries. Outstanding work remains reserved across a date boundary until settled; do not double-spend by resetting counters at midnight. Separate provider account credit from JARVIS's own budget. Credits can expire and pricing can change; stale or incomplete pricing disables affected paid routes until verified.

Missing numeric configuration means no paid dispatch, not a fabricated $50 default. The owner can configure limits once and use them as standing authority. Agents cannot raise them. Near-cap alerts are useful but admission control must already prevent overspend within JARVIS's bounded requests. It cannot cap unrelated usage on shared provider credentials or all external infrastructure bills; use separate credentials/accounts and service billing controls where available.

## Cost calculation examples

These are **illustrative arithmetic, not current model prices or approved budgets**. For token-billed text: cost = input tokens × input rate / 1,000,000 + output tokens × output rate / 1,000,000, plus other billed units.

At hypothetical rates of $0.50 input and $2 output per million tokens, 100 calls with 2,000 input and 500 output tokens each cost $0.20. At hypothetical $5/$20 rates the same work costs $2.00. Retrieval, compact context and choosing the adequate tier matter more than branding a model “cheap.”

A Council with four seats, two rounds each and one chairman synthesis has nine calls before extra tools/retries. If each call uses 8,000 input and 1,000 output tokens, that is 72,000 input and 9,000 output: $0.054 at the first illustrative rates or $0.54 at the second. Growing transcripts, research tools, premium seats, voice and long debates can change the total substantially. Reserve the complete meeting envelope and stop at its turn/deadline limits.

## Monthly operating expectations

The conversations changed from “free for now” to willingness to pay for useful operation. They do not establish a final monthly cap. The $50 example in S2-M0033 is a planning question, not authorization. Historical $3/$4/$5 trial-credit controls are not current budgets. [R058–R059]

| Cost category                                     | Planning treatment                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Existing Neon/Vercel/Convex baseline              | Check actual plan allowances, metering, current pause state and limits before projecting; do not assume free forever        |
| Small consolidated VM                             | Reserve an illustrative $10–25/month planning allowance pending real provider/region/RAM quote and workload; no GPU assumed |
| Backups/operations allowance                      | Illustrative $2–10/month for storage-related services; owner time and recovery effort are additional                        |
| Personal object storage                           | Illustrative $0–5 for modest early volume, with growth tracked separately; operations and backup copies matter              |
| Beeper                                            | Free tier may suffice; optional paid features must be verified against the needed API workflow                              |
| Model/search/speech APIs                          | Usage-based and separately governed; numeric owner cap remains Q01                                                          |
| Domain, email services, maps and other connectors | Add only when the chosen workflow needs them; not included in model token estimates                                         |

Thus the VM example suggests roughly **$12–40/month before Beeper upgrades, model/speech/search APIs, optional connectors, taxes and hardware**, purely as a planning envelope, not a quote or promise. Existing-plan operation may differ substantially.

For a concrete storage reference, R2 Standard is $0.015/GB-month with 10 GB-month free; a full-month 100 GB example is $1.35 for storage after that allowance, excluding chargeable operations and extra copies. Rates checked 2026-09-10. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Beeper's FAQ lists free use up to five accounts, Plus starting at $9.99/month and Plus Plus at $49.99/month. Feature availability varies by network, and paid app features do not prove equivalent API control. No upgrade is selected here. [Beeper FAQ](https://www.beeper.com/faq)

## Failure and acceptance

When budget is exhausted, continue deterministic/local permitted work, save unfinished tasks, show the reason and offer owner-controlled options. Do not silently switch providers, discard Cases or make the launcher unusable. A sensitive task can remain local even if cloud would be cheaper/faster.

Test parallel reservations, nested agents, unknown receipts, midnight/month rollover, cancellation after dispatch, stale prices, malformed usage, rate limits, unsupported models and unavailable local assets. Verify each fallback stays within the original privacy and budget envelope. Measure real task cost during pilots; update estimates before raising limits or adding richer Council/voice use.

## 2026-09-29 Muse output profile revision

The reviewed Muse profile now bounds spend by the full verified model output maximum while keeping the requested 2,500 output control. Its documented shared-context capacity is checked independently. Requested-control overshoot remains recorded, but only actual safety-bound violations quarantine this revised profile. This supersedes the earlier temporary blanket block and does not raise budgets or select Muse as a default. See [ADR 0017](../ADR/0017-implicit-anchor-preservation-and-model-output-bounds.md).

## Future routing and evaluation candidate: typesafe-ai/jev

Recorded by explicit owner request on 2026-09-29. `typesafe-ai/jev` is a future routing/evaluation candidate only: not a generative Brain replacement, never an authority or policy decision-maker. No dependency, model route, runtime integration or Jev evaluation call is authorized or added. Any future assessment must retain deterministic admission, permissions, validation and outcome truth. Public repository availability/capabilities were not established in this task; this is candidate registration, not a capability endorsement.
