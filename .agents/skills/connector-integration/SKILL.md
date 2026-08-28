---
name: connector-integration
description: Use for OAuth, API, webhook, polling, reconciliation, connector admin pages, token storage, sync status, and disconnect flows for Google, Plaid, WHOOP, Telegram, Iron & Intervals, nutrition, and future providers.
---

# Connector integration workflow

## Before coding

- Verify the current provider documentation and supported scopes.
- Record the source, version, environment, rate limits, webhook behavior, and sandbox limits.
- Define one provider adapter behind a domain interface.
- Define the provider-owned source of truth and the JARVIS-owned normalized state.

## OAuth

- Use authorization code flow.
- Use state and PKCE where supported.
- Request minimum scopes.
- Encrypt refresh and access tokens at rest.
- Never send tokens to the model or browser logs.
- Record token expiry, scope set, account identity, and last successful refresh.

## Webhooks

- Verify signatures using raw request bytes.
- Reject stale timestamps when the provider supports them.
- Return success quickly after durable enqueue.
- Deduplicate before side effects.
- Store the original event reference and a redacted diagnostic payload.
- Retry with bounded backoff and dead-letter status.

## Reconciliation

Webhooks are signals, not the only source of truth. Add provider-specific polling or cursor reconciliation. Track last cursor, last complete sync, latest provider timestamp, and any coverage gap.

## Admin connector page

Every connector card shows disconnected, connecting, syncing, healthy, stale, error, or revoked state. It includes scopes, connected identity, last sync, next scheduled sync, recent errors, reconnect, test, and disconnect controls.

## Tests

Cover OAuth state mismatch, expired token, refresh failure, duplicate webhook, reordered webhook, missing webhook, stale cursor, provider outage, disconnect, and deletion.
