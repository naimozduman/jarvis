# Approval model

## When approval is created

The event pipeline persists a proposed action and policy evaluation before asking for approval.
`HIGH_IMPACT` always requires it. `CONTROLLED_WRITE` requires it unless an owner policy explicitly
denies that operation. The result is a pending `approval_requests` row and an
`awaiting_approval` proposed-action state, with a corresponding `approval.requested` audit event.

An approval request includes the owner, action type and risk through the linked proposal, request
and expiration time, requesting decision provenance, resolving actor/result fields, correlation ID,
and a SHA-256 snapshot hash of the exact action identity, type, owner, payload, and risk class.

## Enforcement

An executor must call the approval guard immediately before a high-impact side effect. The guard
rejects requests that are not approved, expired, owned by another identity, or whose snapshot hash
does not match the action it is about to perform. Constant-time token comparison helpers exist for
authenticated secret material; normal approval comparisons are structured database/state checks.

Approval is intentionally specific. Approving one action does not authorize a changed payload, a
retry with a different destination, or a different external operation.

## Phase 1 limit

Phase 1 stores and enforces the boundary, but provides no high-impact executor at all. There is no
external messaging, email sending, appointment cancellation, deletion, purchase, finance write, or
data-exposure executor. Phase 2 must preserve this gate; later connector phases may only add an
executor after its policy rule, approval UX, audit/reconciliation behavior, and tests are approved.
