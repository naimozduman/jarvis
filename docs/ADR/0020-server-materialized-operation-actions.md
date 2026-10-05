# 0020: Server-materialized actions for validated planning operations

Status: accepted by explicit owner instruction, 2026-09-29. Local implementation and one isolated synthetic Luna end-to-end test only. Deployment and owner WhatsApp replies remain disabled.

## Decision

A valid `flexible_delta_v2` proposal with `schedule_existing_commitment` bindings deterministically produces one server-owned `internal.plan.update` action. The model neither supplies nor authorizes that action. The action payload references the immutable, validated proposal and day plan; the proposal's server-created commitment binding retains the canonical commitment ID, title, priority, role, class, source and validated time range. Its idempotency key derives from the canonical Brain request and plan proposal. A redundant model `internal.plan.update` intent is ignored for this operation path so it cannot create a second action.

The normal action pipeline persists the action, evaluates the existing policy, records approval or denial when appropriate, and invokes the existing transaction executor only when policy allows it. Current policy treats an owner-authorized `internal.plan.update` as `LOW_RISK_INTERNAL`, so the explicit authenticated-owner Case 3 request is allowed immediately. This creates no new authority; missing owner authorization, denial, or an approval requirement still prevents application.

The executor still locks and re-reads the canonical day plan and each bound commitment, rejects changed or terminal/protected commitments, duplicate scheduling and current overlap, revalidates constraints, and commits transactionally. After execution, the Brain repository re-reads the applied proposal and exact planned blocks. Only an executed and verified operation produces success wording. Approval stays pending, policy/validation denial is rejected, and a missing verification receipt is uncertain. Decision execution evidence records proposed action origin, policy result, execution, and verification separately. Replays continue through the request and action idempotency boundaries and cannot create a second action, execution, or block.

## Validation

Provider-free tests cover deterministic action derivation without a model apply intent, policy denial, unverified execution wording, truthful responses, replay, and existing anchor/overlap protections. The isolated PostgreSQL integration test verifies canonical operation application and post-apply reread. The frozen Case 3 Luna run is documented under `outputs/case3-operation-apply-v7-20260929`; it used one Gateway generation, policy allow, one action, one execution, one 17:30–18:00 canonical block, and one verified success response. No routing, reasoning, model, budget, prompt, schema, anchor behavior, admission setting, delivery setting, or deployment changed.
