# 0017: Server-owned anchor preservation and verified model output bounds

Status: accepted by explicit owner instruction, 2026-09-29. Local implementation only; no deployment or WhatsApp activation.

## Canonical plan delta

Existing fixed/hard anchors are server-owned state. Every normalized replan records their canonical IDs as preserved even when the model emits an empty mutation list. The server retains omitted blocks in collision checks and the transactional apply path revalidates against live canonical state.

New replan mutations must be flexible. Existing mutations must use the model contract's `existingBlockId`, which materialization validates for owner/day scope. A uniquely matching unchanged protected block can normalize to preservation without an ID; state equality uses timestamp instants and unordered dependency IDs, and ignores only placement explanation and source provenance. Titles, priority, timing, role, anchor class, commitment linkage, duration constraints and completion state remain protected. Similar prose or coincident timing alone cannot establish identity. Changed or ambiguous protected emissions reject the entire proposal; they are not dropped to conceal a conflict.

This upsert-only replan path has no grant to modify or remove protected anchors, including cancellation. Explicit identity is necessary but does not itself grant authority. There is no implicit deletion through omission and no new deletion action or permission. An authorized future protected-edit/removal path must carry canonical identity and pass its own deterministic policy; the model cannot confer that authority here.

The conversational-outcome reconciler is unchanged. A validated proposal without an executed apply action remains pending; only authoritative applied state permits completion wording. Rejected plans cannot claim success. No prompt, schema shape, fixture, model default, routing or reasoning setting changes are required.

## Muse admission profile revision

The live Gateway catalog and Meta documentation verify Muse's meta-only route, 1,048,576-token shared input/output context, 1,048,576 maximum completion capacity, medium reasoning and strict output support. Meta documents `max_output_tokens` as reasoning plus visible output. Recorded synthetic usage of 2,599 against 2,500 contradicts reliable enforcement of that request control; this revision does not redefine it as visible-only.

Keep the requested 2,500 control, but reserve spend using the full verified model maximum output. Use the conservative complete-input estimate and maximum published prices, without discounts or a larger budget. Do not subtract the conservative input upper estimate to derive a maximum billable output: actual input could be smaller. Independent input/output maxima deliberately overcount cost.

Capacity admission records the provider's shared-context invariant: conservative input plus requested output reservation must fit, and actual input plus total output must remain inside the shared context. It does not add the full theoretical output maximum to input as if both maxima could occur simultaneously. Unknown shared-context semantics still fail closed.

Each response persists an updated profile observation inside model-run usage accounting, alongside exact Gateway cost. Requested-control overshoot is distinct from a model-maximum, shared-context, input-estimate or malformed-usage violation. The latter block materialization and future calls. Only the expressly reviewed v2 Muse requested-output violation may be superseded by the v3 profile after rechecking actual usage against the new verified safety bounds. Known pre-dispatch failures do not poison model observations; uncertain dispatched failures remain blocked.

The dynamic 6,000-token context selection budget, versioned UTF-8 input bound, existing cost/call guards and defaults remain unchanged. This supersedes ADR 0016's temporary blanket Muse block, not its input-estimation or spend rules. Existing JSON audit columns carry the added metadata; no migration is needed. Rollback must retain audit history and fail closed for Muse rather than restore the disproven requested-output safety assumption.

Sources: [Gateway Muse catalog](https://ai-gateway.vercel.sh/v1/models/meta/muse-spark-1.3-contributor/endpoints), [Gateway model page](https://vercel.com/ai-gateway/models/muse-spark-1.3-contributor), [Meta Responses](https://dev.meta.ai/docs/protocols/responses), [Meta reasoning](https://dev.meta.ai/docs/reasoning).
