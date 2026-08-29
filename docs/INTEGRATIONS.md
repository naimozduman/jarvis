# Integrations

## Phase 1 status and future interface

No provider SDK, network client, OAuth flow, webhook route, credential, or connected account is
implemented in Phase 1. `packages/integrations/src/ports.ts` declares the provider-neutral
`ConnectorPort` lifecycle boundary only. A future connector must verify its delivery, resolve a
trusted owner, emit a canonical event, use encrypted-secret storage, go through policy/approval,
append audit records, and reconcile state; it must not write JARVIS domain state directly.

| Future interface | Planned phase | Phase 1 state |
| --- | --- | --- |
| Evolution API / WhatsApp | 3 | Replaceable connector port only. |
| Gmail / Google Calendar | 5 | Connector ports only. |
| Plaid, WHOOP, Iron & Intervals, food logging | 6 | Connector ports only. |
| iOS / HealthKit | Later | Device/client and connector port boundary only. |
| Hermes | Later | Restricted executor boundary only. |
| Telegram / Poke | Later unless explicitly reprioritized | Channel identifiers/port boundary only. |
| OpenAI reasoning | 2 | Deliberately absent from the integration package. |

## Shared connector contract

Every connector implements:

- `beginConnection`
- `completeConnection`
- `refreshAuthorization`
- `disconnect`
- `syncInitial`
- `syncIncremental`
- `ingestWebhook`
- `reconcile`
- `getHealth`
- `listSelectableResources`
- `applySelection`

Every connector provides an admin card and audit events.

## Evolution WhatsApp

Mode: dedicated JARVIS account through Evolution API and Baileys.

V1 permissions: send to the single allowlisted user, receive from that user, download approved media, inspect connection state.

Do not use Evolution's built-in chatbot or OpenAI integration. Webhook events go to JARVIS.

Special controls:

- Exact image tag and digest.
- One replica.
- Session volume.
- Separate database.
- Redis feature flag.
- Sender allowlist.
- LID and phone identifier mapping.
- Webhook and outbound idempotency.
- Connection and message reconciliation.

### Phase 3 implementation status

`@jarvis/integrations-evolution` now owns the concrete Evolution boundary. It sends only an already-persisted, owner-bound delivery through `MessagingTransport`; it has no Brain or canonical database dependency. Incoming traffic uses a verified per-instance JWT, strict schema parsing, sender normalization, and canonical ingress. V1 accepts direct owner messages only. Group, broadcast/newsletter, status, untrusted, malformed, protocol, history-sync, resend, and self-echo traffic is rejected before the Brain.

Evolution `2.3.7`, `2.4.0-rc2`, `latest`, and floating branch images are not supported because of the Baileys `rc9` vulnerability. The source-build contingency is non-production-only and requires immutable digest evidence; see `EVOLUTION_VERSION_GATE.md`. No real Evolution instance or WhatsApp account is required in CI.

## Telegram

Mode: official Bot API.

Purpose: direct fallback, approvals, operational alerts, and test channel. Use webhook secret validation. Restrict the bot to one chat ID.

## Google

### OAuth

Use server-side OAuth with offline access and encrypted refresh tokens. The application owns its Google Cloud project and consent screen.

### Gmail

V1 scope: read-only. Start with recent synchronization. Use Pub/Sub notifications and `history.list`. Renew `watch` daily. Run periodic reconciliation because notifications may be delayed or dropped.

### Calendar

Use selected calendars. Store sync tokens. Create a separate notification channel with an opaque verification token. Replace channels before expiration. Notifications contain change signals, so fetch actual event changes before updating state.

## Plaid

Use Plaid Link inside the Connectors page. Eligible new US or Canada teams may begin on the current Trial plan with up to ten production Items. Confirm current plan and institution access during setup.

Products:

- Transactions.
- Balance when needed.
- Liabilities for credit card due data.
- Recurring Transactions only if available on the selected plan and useful.

Never request Transfer. Verify webhook signatures. Persist access tokens encrypted. Use update mode for broken Items. Default account selection to Chase and Mercury only.

Provider abstraction allows later support for SimpleFIN, BankSync, a direct Mercury read-only adapter, or another aggregator after a coverage and security review.

## WHOOP

Use OAuth with offline scope. Use v2 webhooks and v2 fetch endpoints. Validate HMAC signatures against timestamp plus raw body. Acknowledge within one second and enqueue fetch work. Reconcile periodically.

## Apple Health

No web-only connector. Implement in `apps/ios` through HealthKit. Request individual data types and show permission freshness. Use observer queries and background delivery on device.

## Iron & Intervals

Use a narrow internal HTTP API with a service identity, explicit methods, idempotency, and audit. No shared database connection.

## Nutrition app

Use the same internal API pattern. Define the contract before implementation.

## OpenAI

Use the Responses API directly from the worker. The OpenAI API key stays on Railway. Do not call OpenAI from the browser. Use strict output schemas, bounded retries, prompt versions, cost tracking, and model-route configuration.

## Hermes executor

Optional later. Treat as a restricted worker for tasks without usable APIs. It receives one task packet and a minimal tool allowlist. It does not receive master database access, raw finance credentials, Google refresh tokens, or the constitution editor.
