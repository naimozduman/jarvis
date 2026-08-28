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
