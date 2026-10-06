---
title: "Identity Enrollment and Per-Action Authentication"
document_id: "docs::AUTHENTICATION_BOUNDARY"
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

# Single owner, server-bound principal

Client-supplied owner IDs are consistency fields, not authentication. Resolve owner from trusted session/service identity and compare every target owner. A bridge token grants only its configured bridge/connection scope, not owner-facing approval authority. Cross-owner negative tests apply even in a one-owner database.

## Initial owner bootstrap

Do not bootstrap owner identity from the first caller. An operator-controlled one-use enrollment secret is installed out of band, with short expiry and no logging. Establish the first passkey over the first-party origin, verify WebAuthn challenge, RP/origin, signature and user verification, consume the bootstrap secret, and disable public enrollment. Recovery uses owner-controlled offline recovery material, revokes old sessions and is audited. A new surface does not create a second owner.

## WhatsApp binding

1. Recently reauthenticated owner opens the first-party enrollment view.
2. Server creates an unpredictable, one-use challenge tied to owner/session/connection with expiry.
3. Owner sends it from the intended personal sender to the dedicated JARVIS transport account. Do not pair the personal account to the automation bridge.
4. Local adapter verifies provider ingress and challenge observation. Enrollment reconciles both authenticated first-party session and verified sender challenge, not an arbitrary alias field.
5. Store an opaque identity reference. Derive stable local references with versioned HMAC using a secret identity key, or use random IDs plus encrypted mapping. Unsalted phone hashes are not anonymization. Keep keys separate from the database, version normalization and support rotation.
6. Enroll LID aliases only through separately verified linkage. Audit safe references and enrollment method, never raw identifiers or challenge secrets.

## High-impact resolver

HIGH_IMPACT approvals and lease enrollment require fresh step-up, proposed maximum age 5 minutes. Validate owner, device/session, method, challenge and exact action. Possession of an unlocked WhatsApp thread is insufficient. UI and API both enforce the rule. A JSON authMethod field alone is not evidence.

## Unavailable owner

Absence, travel, missed heartbeat or device outage never grants authority. Preserve read/monitor/draft and bounded internal work. Defer external work without valid specific authority. Recovery and deliberate awake override use a first-party control, not a model's inference that the owner seems present.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Owner-only authentication boundary

## Phase 1 decision

JARVIS is single-owner in V1, but internal services do not trust an arbitrary client-supplied owner
ID. Every authenticated request must resolve to an `AuthenticatedPrincipal` with a verified owner
UUID, client identity, scopes, and authentication method. Owner-scoped authorization helpers reject
any requested target owner that does not match that principal.

This is deliberately an ownership boundary, not a premature multi-tenant role system. Tables retain
owners, identities, devices, sessions, trusted clients, and passkey credential records so additional
verified identities can be modeled later without rekeying personal data.

## Supported callers

| Caller | Phase 1 boundary | Deferred implementation |
| --- | --- | --- |
| Web control center | Browser/session principal contract | Actual web UI and passkey ceremony in Phase 4. |
| Future iPhone app | Device/trusted-client principal contract | Native app and device attestation in a later phase. |
| Internal API/worker | Service principal with narrowly declared scopes | Deployment identity/configuration when services are deployed. |
| Future JARVIS MCP access | Trusted-client principal and scope boundary | MCP transport and consent flow. |

The fail-closed authentication adapter rejects a request until a real verifier is supplied. No Google
login, social login, email provider, or production cookie/session flow is enabled in Phase 1.

## Future WebAuthn plug-in

`passkey_credentials` holds public WebAuthn credential material only; `auth_sessions` holds a token
digest, expiration, revocation data, and optional trusted device. The future passkey implementation
plugs in at the API authentication adapter:

1. authenticate the WebAuthn assertion or registration ceremony;
2. resolve its verified credential to `identity` and `owner` records;
3. issue or rotate a session whose raw token is only delivered through the approved transport and
   whose digest is stored in `auth_sessions`; and
4. construct the same owner-scoped principal consumed by API handlers, policy, audit, and services.

Provider credentials use the separate encrypted-secret storage interface. Plaintext OAuth tokens or
connector credentials must never be stored in ordinary database fields, logs, audit data, tests, or
commits.
