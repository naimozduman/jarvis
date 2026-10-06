---
title: "Trusted Action Approval"
document_id: "docs::APPROVAL_MODEL"
status: "active"
authority_class: "protected"
owner_role: "security_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Exact action, trusted display, fresh identity

## Separate objects

The model emits ActionIntent. The server creates an owner-scoped ProposedAction, normalizes its arguments through a registered input contract and computes a canonical snapshot hash. PolicyEvaluation determines eligibility. ApprovalRequest or a narrow AuthorityLease refers to the server-owned action/scope. ExecutionAuthorization is minted by a trusted resolver and checked immediately before dispatch.

The model does not supply owner identity, idempotency authority, approval IDs, policy version or execution tokens. A model-reported risk is at most a hint; server registry classification wins. Never put ownerId or approved=true into model output as a security fix.

## Canonical snapshot

Bind owner, action ID, revision, action/capability, executor and credential-account reference, exact normalized parameters, targets, amount/currency when applicable, policy version, expiry and operation key. Canonical serialization must be versioned and deterministic. Hash is for integrity, not for making low-entropy private payloads confidential. Opaque references outside the trusted boundary use keyed derivation or random IDs.

## Trusted approval surface

HIGH_IMPACT approval resolves only in a dedicated authenticated first-party web/Android view. WhatsApp, voice and conversational messages notify and link there; they do not approve high-impact work. The view renders typed server-owned fields, plain escaped content, exact recipient/destination, risk, expiry, reversibility and source evidence. Full outbound message/document content is visible when it is the effect being approved. Model-authored rationale may appear separately as untrusted explanation, never as the canonical preview or button label. No model-rendered HTML.

## Resolver

Fresh phishing-resistant owner authentication is required for HIGH_IMPACT and lease creation/renewal. Proposed baseline maximum step-up age is 5 minutes. Validate authentication method, owner, session, device, challenge, origin/RP binding where applicable, action revision, snapshot, policy and expiry. Resolve via authenticated POST with CSRF/origin protection, never a GET or opaque URL possession alone. Consume a per-action nonce. Concurrent approval requests use separate records.

Editing invalidates approval. An approval request created under an old policy is reevaluated. Execution reloads revocation state and kill epoch. An already-dispatched action is reconciled instead of being silently cancelled.

## Attention load

New capabilities start denied or per-action review, never with automatic lease admission. Track created/resolved/edited/expired approvals, risk, capability, repeated targets, bursts, session age and owner-declared sleep state. Fast dwell time is an indicator, not proof of informed consent or fatigue. Alert thresholds are configurable proposals, not a universal attention test. Batch the digest, not opaque HIGH_IMPACT approvals. Never auto-widen low-risk authority to reduce prompt count.

## Verification

Reference semantic checks ship in tools/jarvis-v5/reference_controls.py and fixtures. They test contract intent, not the deployed resolver. J5-M07 and J5-M18 must prove the real authenticated resolver, read-back, expiry, owner mismatch, changed payload, replay and cancellation paths before enabling external writes.

## Source

Design informed by OWASP Transaction Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

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
