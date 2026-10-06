# Security and privacy

## Phase 1 implementation boundary

Phase 1 implements the owner-scoped authorization contract, safe structured logging and redaction,
correlation IDs, idempotency helpers, constant-time secret-token comparison, approval enforcement,
append-oriented audit records, and an encrypted connector-secret storage interface. It does not
enable an OAuth provider, passkey ceremony, social login, external connector, model, or external
executor. Future implementations must plug into these boundaries rather than bypass them.

## Threat model

JARVIS concentrates private data and tool access. Main threats include account takeover, stolen OAuth refresh tokens, exposed API keys, malicious email content, compromised third-party services, accidental external actions, duplicate actions after retries, insecure logs, and unofficial WhatsApp session loss.

## Identity

- One production owner in V1.
- The Phase 1 authentication adapter fails closed until a real verifier is installed.
- `owners`, `identities`, devices, passkey-credential records, sessions, and trusted clients are
  the future passkey/WebAuthn extension point; no interactive passkey ceremony is active yet.
- Public registration, social login, email-provider login, recovery UI, and device/session UI are
  deferred with the web control center and deployment work.

## Authorization

Use explicit policies, not implied single-user trust.

Risk levels:

- `READ`
- `LOW_RISK_INTERNAL`
- `CONTROLLED_WRITE`
- `HIGH_IMPACT`

Unknown actions, risk mismatches, unauthenticated ownership, and finance writes are denied. Controlled
writes require explicit approval by default. High-impact actions always require explicit approval,
and Phase 1 has no high-impact executor. Every tool declares risk, scopes, data classes,
idempotency behavior, and approval requirement.

## Token protection

- Provider secrets in platform secret stores.
- User refresh tokens encrypted with versioned keys.
- Separate encryption key from database credentials.
- Never send token ciphertext to the browser or model.
- Redact provider headers and payload fields from logs.
- Rotate service and webhook secrets.

## Webhook protection

- Preserve raw body when signature algorithms require it.
- Verify provider signature or channel token before parsing into trusted state.
- Apply replay and timestamp checks where supported.
- Persist accepted events before acknowledging.
- Enforce body-size and media limits.
- Reject unknown connector IDs and senders.

## Prompt-injection boundary

Untrusted content includes email, attachments, websites, WhatsApp messages from anyone except the allowed user, calendar descriptions, transaction descriptions, and provider metadata.

Rules:

- Label untrusted content in context.
- Never treat content as policy.
- Never expose secret-bearing tools to a model when not required.
- Validate tool parameters independently.
- Require source evidence for extracted obligations.
- Strip or isolate hidden HTML and remote content.

## Finance

- Read-only products only.
- No Transfer client or routes.
- No money movement tools in schemas.
- Account allowlist.
- Sensitive UI reauthentication.
- Mask account identifiers.
- Keep source freshness visible.

## Health

- Minimize raw records.
- Separate health summaries from routine chat context.
- Track authorization and freshness.
- Do not diagnose.
- Explain health-based training adjustments as recommendations and evidence.

## Evolution isolation

- Dedicated number.
- Separate database and credentials.
- No master application secrets inside Evolution.
- Private network path from JARVIS to Evolution.
- Manager protected.
- Session loss treated as channel loss, not brain loss.

## Logging

Allowed in normal logs:

- Correlation ID.
- Event type.
- Provider.
- Status.
- Latency.
- Record IDs.
- Error class.

Not allowed:

- Access or refresh tokens.
- Full emails.
- Full chat bodies.
- Bank transaction details.
- Health samples.
- Raw model prompts.
- Attachment contents.

## Kill switches

Provide independent switches for:

- All outbound messages.
- Model tool execution.
- Connector ingestion.
- Finance processing.
- Health processing.
- Evolution send.
- Proactive scheduling.

Read-only web access and audit inspection should remain available during a pause.

## Security release gate

Before production:

- Secret scan passes.
- Dependency audit passes or has reviewed exceptions.
- Authentication and authorization tests pass.
- Webhook signature tests pass.
- Prompt-injection evals pass.
- Finance write search returns no implementation.
- Backup restoration is tested.
- Data export and purge are tested.
- Incident runbook exists.
