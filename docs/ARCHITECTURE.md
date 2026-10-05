# Architecture

Historical build-kit document, retained during the October 5, 2026 reconciliation. Its original requirements, phase sequence and commands are dated implementation/history evidence. Start at `CODEX_START_HERE.md` and follow `docs/JARVIS/CODEX_START_HERE.md`; this document cannot override the current reading order or authorize an old migration, recovery, provider connection or deployment.

> **Phase 3.6 update.** The long-running Railway API/worker staging target below is retained as
> historical design context and is **abandoned / superseded by the zero-cost architecture** for
> the next runtime phase. Current execution uses a stateless Vercel API, opaque Convex scheduling,
> canonical Neon records, and an operator-owned local WhatsApp bridge. No service is deployed by
> this repository change.

## System boundary

JARVIS is one persistent system with several interfaces. WhatsApp, web, Telegram, and future iOS are channels. They do not own state.

## Phase 1 present state

The diagram below is the target architecture, not a statement that every component is active today.
Phase 1 implements only the provider-neutral core: canonical PostgreSQL persistence, pg-boss job
transport, deterministic event handling, ownership/authentication boundary, policy, approvals,
audit, health/readiness contracts, and connector ports. The model/runtime brain is Phase 2; WhatsApp
is Phase 3; the control-center UI is Phase 4; Gmail and Calendar are Phase 5; and health, finance,
training, nutrition, and other connectors are Phase 6. No target-provider client or external account
is connected in this phase.

```text
                         +-----------------------+
WhatsApp -> Evolution -> |                       |
Web chat --------------> |      JARVIS API       | -> durable events -> Neon
Telegram --------------> |                       |                     |
Google/Plaid/WHOOP ----> | webhook and OAuth     |                     v
                         +-----------------------+               JARVIS Worker
                                                                      |
                                                                      v
                                                               OpenAI Responses
                                                                      |
                                                                      v
                                                           Policy and tool execution
                                                                      |
                                                                      v
                                              Calendar, Gmail, finance, health, apps
```

## Runtime components

### apps/web

Next.js control center on Vercel. It owns presentation, authenticated user interactions, connector setup, approvals, and audit inspection. It does not run the durable scheduler.

### apps/api

Long-running TypeScript HTTP service on Railway. Fastify is the preferred framework. It owns:

- Authentication integration and sessions.
- Public application API.
- OAuth callbacks.
- Provider webhooks.
- Web and channel message ingress.
- WebSocket or server-sent event updates to the control center.
- Fast validation, persistence, enqueue, and acknowledgement.

### apps/worker

Long-running Railway service. It owns:

- pg-boss workers.
- Scheduled reminders and rituals.
- Provider reconciliation.
- Context assembly.
- Model routing.
- Structured decision processing.
- Policy checks.
- Tool execution.
- Outbound messages.
- Dead-letter review and replay.

### Evolution API

A pinned third-party Docker image with one replica, private Postgres, optional Redis, and a persistent volume. It owns WhatsApp session and transport state only.

### Neon

Canonical application database. Use pooled connections for server workloads. Use branches for migration and staging tests. Do not copy raw sensitive production data into previews.

## Package boundaries

### packages/contracts

Zod types, JSON schemas, event envelopes, decision contracts, tool contracts, and versioning.

### packages/database

Drizzle schema, migrations, typed repositories, transaction helpers, encryption metadata, and pg-boss setup.

### packages/brain

Prompt composition, context retrieval, decision hierarchy, negotiation logic, message scoring, memory policies, model routing, and eval hooks.

### packages/integrations

Provider adapters with a shared lifecycle:

- connect
- disconnect
- refresh authorization
- ingest webhook
- sync
- reconcile
- report health
- map provider records to canonical contracts

### packages/security

Permissions, approvals, token encryption, webhook verification, prompt-injection boundaries, audit events, data classification, and user allowlists.

### packages/observability

Correlation IDs, structured logging, metrics, traces, cost accounting, provider health, and alerts.

## Canonical data flow

1. Receive.
2. Authenticate.
3. Validate.
4. Persist raw envelope.
5. Deduplicate.
6. Enqueue in a transaction.
7. Acknowledge.
8. Normalize provider data.
9. Update domain state.
10. Decide whether reasoning is required.
11. Assemble minimal source-backed context.
12. Request structured model output.
13. Validate output.
14. Run permission policy.
15. Execute allowed actions with operation keys.
16. Persist results and follow-up jobs.
17. Deliver user-visible output.
18. Reconcile external state later.

## Why one runtime orchestrator

A single orchestrator reduces latency, token duplication, hidden state, and conflicting actions. Specialist prompts and deterministic modules provide separation without free-form agent conversations. Codex build agents are separate from the runtime design.

## Infrastructure map

| System | Responsibility | Public exposure |
|---|---|---|
| Vercel | Web and PWA | Yes |
| Railway API | API, OAuth callbacks, webhooks | Yes, protected |
| Railway worker | Jobs and reasoning | No |
| Evolution API | WhatsApp gateway | Private except protected manager/callback needs |
| Evolution Postgres | Transport database | No |
| Evolution Redis | Optional cache | No |
| Neon | Canonical brain | Connection restricted by credentials |
| Object storage | Attachments and voice | Signed access only |
| OpenAI | Reasoning and transcription | Outbound API only |

## Failure model

Every external dependency is expected to fail.

- Channel failure does not stop jobs.
- Webhook failure is repaired by reconciliation.
- Unknown external write responses are checked before retry.
- Model schema failure retries with bounded attempts, then falls back to a safe message or human review.
- Connector revocation degrades affected features and never fabricates stale data.
- Evolution failure routes status to web and Telegram.

## Phase 3 WhatsApp transport implementation

The Phase 3 vertical slice implements the WhatsApp path as a replaceable transport boundary:

```text
verified Evolution webhook -> normalized canonical event -> event job -> owner-text Brain turn
-> persisted response / generic reminder intent -> deterministic owner delivery policy
-> canonical outbox + pg-boss -> leased transport worker -> Evolution adapter
```

`@jarvis/integrations-evolution` is the only package that knows Evolution routes, webhook JWT behavior, JIDs, LIDs, or QR/session control. `apps/api` binds `ownerId` from trusted configuration, not from a provider JSON field. `apps/worker` calls a provider-neutral port only after a response is persisted and delivery has passed policy. The adapter cannot mutate canonical PostgreSQL or call the Brain, and the Brain cannot call Evolution.

The new canonical tables hold normalized messages, redacted rejections, connection state history, outbound delivery state, and media-fetch metadata. Evolution Postgres, Redis, and session volume remain infrastructure state and are never a substitute for Neon canonical truth. Core readiness and transport health are deliberately separate. See `WHATSAPP_ARCHITECTURE.md` and `EVOLUTION_VERSION_GATE.md` for the active constraints.
