# Research notes

Research date: August 23, 2026

This file records the sources used to choose the build structure. Features, prices, policies, and releases change. Codex must verify current official documentation before implementing a version-sensitive feature.

## Codex project structure

### AGENTS.md

Source: https://developers.openai.com/codex/guides/agents-md

Finding: Codex reads `AGENTS.md` before work. It builds an instruction chain from the repository root toward the current directory. The default combined project instruction limit is 32 KiB.

Decision: Keep the root `AGENTS.md` concise. Put detailed workflows in skills and docs.

### Skills

Source: https://developers.openai.com/codex/skills

Finding: A skill is a folder containing `SKILL.md` with required `name` and `description`. Repository skills are loaded from `.agents/skills`.

Decision: Include narrow project skills for WhatsApp, connectors, security, data, deployment, and evals.

### Custom agents

Source: https://developers.openai.com/codex/agent-configuration/subagents

Finding: Project custom agents live in `.codex/agents/*.toml` and require `name`, `description`, and `developer_instructions`. Subagents are useful for parallel exploration and review.

Decision: Include read-only explorer, researcher, architect, security, and eval agents, plus focused implementers. Keep one implementation owner per change.

### MCP

Source: https://developers.openai.com/codex/mcp

Finding: Trusted projects may define MCP servers in `.codex/config.toml`. Codex supports Streamable HTTP and STDIO, OAuth, tool allowlists, and approval modes.

Decision: Configure official documentation and optional infrastructure MCPs. Prompt for write operations.

## OpenAI models

Sources:

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models/gpt-5.6-luna

Finding: GPT-5.6 uses Sol, Terra, and Luna routes. Model availability and Codex defaults change over time.

Decision: Runtime model routes are environment-configurable. Write-capable Codex custom agents inherit the parent model to avoid stale hardcoding. Read-only research agents may use Luna or Terra.

## Evolution API

Sources:

- https://github.com/evolution-foundation/evolution-api
- https://github.com/evolution-foundation/evolution-api/releases
- https://github.com/evolution-foundation/evolution-api/issues/2110
- https://github.com/evolution-foundation/evolution-api/issues/2647
- https://github.com/evolution-foundation/evolution-api/issues/2326
- https://github.com/evolution-foundation/evolution-api/issues/2270

Findings:

- Evolution API supports a Baileys-based WhatsApp Web connection and official WhatsApp Cloud API.
- The repository lists stable 2.3.7 as the latest stable release, while 2.4.0 release candidates were marked for validation and included licensing changes.
- Open issues report unique messages incorrectly discarded as duplicates, inbound messages missing webhook emission, state degradation, and LID identifier changes.

Decision:

- Use a dedicated number.
- Pin an exact stable image and digest after a staging spike.
- Never use `latest`.
- Start with one replica and Redis disabled.
- Add independent idempotency, reconciliation, health monitoring, and fallback channels.
- Treat Evolution as replaceable transport.

## Railway

Sources:

- https://docs.railway.com/networking/private-networking
- https://docs.railway.com/volumes
- https://docs.railway.com/volumes/backups

Findings:

- Services in one environment communicate through private internal DNS.
- Volumes provide persistent service storage.
- Volume backup features are available according to plan and configuration.

Decision: Run API, worker, Evolution, and Evolution data services in one Railway project with private networking. Attach the Evolution session volume and test restoration.

## Vercel

Sources:

- https://vercel.com/docs/monorepos
- https://vercel.com/docs/frameworks/full-stack/nextjs

Finding: Vercel supports monorepo projects and first-class Next.js deployment.

Decision: Deploy only `apps/web` to Vercel. Keep the durable worker on Railway.

## Neon

Sources:

- https://neon.com/docs/connect/connection-pooling
- https://neon.com/docs/introduction/branching
- https://neon.com/docs/extensions/pgvector

Findings: Neon provides pooled Postgres connections, branching, and pgvector support.

Decision: Use a separate Neon project as canonical brain storage. Use pooled application connections, branches for tests, pgvector plus full-text search, and sanitized preview data.

## Background jobs

Source: https://github.com/timgit/pg-boss

Finding: pg-boss provides Postgres-backed jobs, cron scheduling, retries, concurrency controls, and dead-letter behavior.

Decision: Use pg-boss to avoid adding another queue system in V1. Keep handlers idempotent for external side effects.

## Google Gmail

Sources:

- https://developers.google.com/workspace/gmail/api/guides/push
- https://developers.google.com/workspace/gmail/api/guides/sync

Findings:

- Gmail push uses Cloud Pub/Sub.
- Mailbox watches must be renewed at least every seven days, with daily renewal recommended.
- Notifications contain a history ID and require `history.list` to fetch changes.
- Notifications may be delayed or dropped, so periodic synchronization is required.

Decision: Use read-only Gmail, daily watch renewal, durable history cursor, and reconciliation.

## Google Calendar

Source: https://developers.google.com/workspace/calendar/api/guides/push

Findings:

- Calendar sends HTTPS notification headers, not changed event bodies.
- Notification channels expire and do not renew automatically.
- The application should use a channel token and fetch actual changes.

Decision: Renew channels before expiration, store sync tokens, verify channel identity, and deduplicate event updates.

## Plaid

Sources:

- https://support.plaid.com/hc/en-us/articles/16194695660311-Can-I-use-Plaid-for-free
- https://plaid.com/docs/account/billing/
- https://support.plaid.com/hc/en-us/articles/39994173227159-What-is-the-Plaid-Trial-plan
- https://plaid.com/docs/link/
- https://plaid.com/docs/transactions/
- https://plaid.com/docs/liabilities/
- https://plaid.com/docs/api/webhooks/webhook-verification/

Findings:

- Eligible new US and Canada Plaid teams created on or after April 15, 2026 may use a free Trial plan with up to ten production Items.
- The Trial bundle includes Transactions and Liabilities, and most major OAuth institutions including Chase.
- Pay-as-you-go has no minimum commitment. Exact rates are visible in the Plaid Dashboard.
- Plaid webhook verification uses signed headers.

Decision: Use Plaid as the first read-only provider behind an adapter. Confirm Mercury coverage during setup. Never request Transfer.

## WHOOP

Sources:

- https://developer.whoop.com/docs/developing/oauth/
- https://developer.whoop.com/docs/developing/webhooks/

Findings:

- Offline scope provides refresh-token access.
- v2 webhooks use UUID record IDs.
- WHOOP retries failed webhook delivery five times over about one hour.
- WHOOP recommends a successful response within one second, signature validation, asynchronous processing, and reconciliation.

Decision: Use v2, validate raw-body signatures, enqueue, acknowledge quickly, fetch the referenced record, and reconcile.

## Apple Health

Sources:

- https://developer.apple.com/documentation/healthkit
- https://developer.apple.com/documentation/healthkit/executing-observer-queries
- https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:)

Findings:

- HealthKit is a device repository requiring user authorization.
- Observer queries monitor changes.
- Background delivery requires the native entitlement and device testing.
- Access may be limited or denied, so missing data must not be interpreted as zero.

Decision: Build HealthKit only in the future native iOS app. Upload normalized deltas and permission freshness.

## Authentication

Source: https://better-auth.com/docs/plugins/passkey

Finding: Better Auth provides a passkey plugin based on WebAuthn and FIDO2.

Decision: Use passkey-first single-user authentication with public registration disabled after bootstrap.

## Community and issue research boundaries

GitHub issues were used to identify operational risks, not to establish guarantees. Open issues may be environment-specific, outdated, or unresolved. Every version-sensitive decision requires a staging test against the exact deployed release.
