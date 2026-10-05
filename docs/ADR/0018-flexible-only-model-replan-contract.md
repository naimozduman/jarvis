# 0018: Flexible-only model replans with immutable proposal history

Status: accepted by explicit owner instruction, 2026-09-29. Local implementation and isolated synthetic regression only; deployment and WhatsApp delivery remain disabled.

## Decision

Existing fixed/hard blocks are canonical server-owned constraints, visible to the model as context but absent from ordinary model mutations. The model block schema excludes the hard-anchor role and fixed/hard anchor classes. Its strict proposal schema has no preservedBlockIds, protected mutation field or model-selected contract version. No prompt prose or routing change is required.

Materialization stamps new proposals with server-only contractVersion `flexible_delta_v2`. Validation derives preserved IDs from current owner/day canonical blocks, never model claims. The v2 path does no title/time matching or protected-emission normalization. It rejects any protected block in ordinary mutations, including a flexible-looking mutation with an existing protected canonical ID. New flexible blocks are checked against all canonical blocks. Database application retains the day-plan lock and revalidates live state, including blocks that became protected after generation.

The separately defined protectedPlanMutationSchema requires canonical existingBlockId for modification/removal. It is deliberately absent from the current model and action envelopes: this phase authorizes neither operation. Schema validity alone would never confer policy authority. Both role and anchor class establish protection consistently across legacy and current validation.

Conversational truth remains unchanged: valid but unapplied proposals receive pending wording; authoritative applied state permits success; rejection and unknown execution never permit completion claims.

## Backward compatibility and audit

Persisted proposals without a contract version retain legacy read compatibility and deterministic revalidation. The legacy exact-state preservation adapter remains solely for these historical records. New model emissions cannot select this adapter or downgrade their version. Invalid protected emissions remain non-executable. Unknown versions fail strict persisted-contract parsing.

Applying a legacy proposal no longer rewrites its proposal JSON with a normalized form. The existing replanning_history metadata records the actual applied delta and contract version separately. The proposal's lifecycle state/applied timestamp still advances. No historical proposal body is backfilled or rewritten.

Migration 0010 adds nullable model_runs.output_audit JSONB. The optional runtime field preserves compatibility with older rows. It stores the model output-text SHA256, strict-schema validity/issue paths, and up to 65,536 characters of plan-proposal JSON, with an explicit truncation flag. This is owner-scoped audit evidence only, never a mutation source or normal telemetry. Provider reasoning items are excluded. Schema-invalid legacy emissions therefore remain inspectable even when rejected before materialization. Provider usage and exact Gateway receipts remain separate authoritative accounting.

The migration is additive and tested in isolated databases. Deployment is not authorized. Rollback can leave the nullable column in place for old application compatibility; retain audit evidence rather than dropping it. Proposal history needs no data migration.

## Validation and regression scope

Tests cover model-visible hard constraints plus flexible-only output, omitted anchors, forbidden ordinary protected types, unavailable protected mutations and missing IDs, protected IDs disguised as movable blocks, real overlap, valid free windows, truthful rejection, immutable legacy history, output audit persistence, and idempotent replay.

The frozen synthetic Case 3 retains exact owner message, instructions, context, canonical anchor and request controls. Only the required schema enum narrowing changes on the wire. Test tooling verifies this exact transition and records old/new schema hashes. Run Luna medium once; run Muse medium once only if Luna passes strict generation and deterministic plan validation. Retain Muse's reviewed maximum-output safety profile. No retries, prompt tuning, extra models, fallback escalation, default selection or delivery activation.

Jev remains a separate future routing/evaluation candidate; it is not part of this implementation. See AI_ROUTER_AND_COSTS.md.
