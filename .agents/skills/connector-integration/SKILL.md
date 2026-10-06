---
title: "Integrate an external provider through normalized Core contracts."
document_id: ".agents::skills::connector-integration::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "integration_specialist"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "connector-integration"
description: "Integrate an external provider through normalized Core contracts."
version: "5.0.0"
---

# Purpose

Integrate an external provider through normalized Core contracts.

## Scope and handoff

Primary role: `integration_specialist`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Document source ownership, scopes, coverage and credential boundary.
2. Verify signatures, replay limits, schema normalization and alias identity.
3. Persist and acknowledge before expensive work.
4. Test reconcile, disconnect, revoke, duplicates and stale coverage.

## Read
- `docs/integrations/INTEGRATIONS.md`
- `docs/security/AUTHENTICATION_BOUNDARY.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Retained detailed engineering guidance

Follow the current root authority and relevant V5 requirements when older wording differs.

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
