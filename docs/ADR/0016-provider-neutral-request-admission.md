# 0016: Separate context selection, provider capacity and spend admission

Status: accepted by explicit owner instruction, 2026-09-29. Implementation is local; deployment is not authorized by this change.

The context assembler's approximately 6,000-token budget controls selection of dynamic owner/context records. It is not the size limit for the full provider request. Instructions, owner input, the context envelope, strict schema and request options add material overhead. An earlier repair incorrectly reused that selection budget as a universal provider input cap and depended on a Gateway endpoint that returned 404.

Gateway does not expose the OpenAI native `/responses/input_tokens` endpoint. Its adapter must not probe it or obtain a direct provider credential for counting. A native counter can be used only when verified for the already-approved route. The existing direct adapter has an explicit native-counter profile; a counting failure falls back to conservative text admission without retry or provider switching.

For the exact supported text/JSON request shape, `utf8-text-json-v1` estimates input as:

`ceil(Buffer.byteLength(JSON.stringify(assembledRequest), 'utf8') * 2) + 4096`

The factor and framing reserve are deliberately conservative application policy, not exact tokenization or provider-published constants. The serialized body includes the strict schema, instructions, complete input envelope and request options. No constitutional/security text is truncated to fit. Unknown additional controls, tools or structured media input require a separate verified accounting method and otherwise fail closed.

Admission records persist exact bytes, hash, method/version, safety factor, framing reserve, dynamic context estimate/budget, full input upper estimate, output reserve, context window, worst-case cost and the model profile snapshot. Existing nullable JSON audit columns suffice; no new migration is required.

Capacity and cost are independent: input upper estimate plus combined-output reserve must fit the smallest context window among the unchanged route's providers; the uncached input estimate and maximum billable output are priced conservatively and evaluated against existing JARVIS spend/call limits. Rate metadata includes provider, regional and service-tier maxima without enabling those options. Unknown rates/window/extra fees or stale profiles fail closed. Conservative arithmetic rounds upward. This change does not raise the configured daily or model budgets.

The model profile contains model ID, provider scope, context/output capacity, rate bounds, reasoning setting, requested output control, output semantics, verification state/time and sources. Luna's named Gateway contract specifies a combined output cap including reasoning. Muse remains blocked because the recorded synthetic response reported 2,599 output tokens against 2,500 requested; the new input estimator does not repair that contradiction. Reverification, not a larger cap or fixed overshoot allowance, is required.

Exact post-call Gateway receipts remain authoritative. Provider total output, reasoning, non-reasoning and explicitly reported visible tokens are distinct. Usage above admission is retained, suppresses materialization and invalidates the canonical accounting profile. Replay rehydrates persisted results without another admission or generation. The accepted plan-delta and conversational-outcome logic are unchanged.

Validation covers unavailable Gateway counting without invoking it, offline/native admission, byte/framing arithmetic, context/spend separation, missing metadata, unsupported modalities, profile/output violations, actual input exceeding estimate and replay. The frozen synthetic regression must retain original prompts/schema/context and use Luna medium first; Muse medium is considered only after Luna admission and generation complete. No deployment, route selection, WhatsApp enablement, fallback or extra model is authorized.

Rollback: revert the admission implementation and its metadata types together. There is no new database migration. Retain audit JSON; do not delete benchmark records. Rolling back is not authority to bypass cost guards or restore context-only request accounting.

Sources: [Gateway Luna model](https://vercel.com/ai-gateway/models/gpt-6-luna), [Gateway Muse model](https://vercel.com/ai-gateway/models/muse-spark-1.3-contributor), [Gateway endpoint catalog](https://ai-gateway.vercel.sh/v1/models/openai/gpt-6-luna/endpoints), [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting), and the frozen synthetic cost/usage receipts in the diagnostic artifact store.
