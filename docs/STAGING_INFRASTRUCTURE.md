# Staging infrastructure readiness

## Current state

Phase 3.5A prepares the repository for staging deployment. It does not create, modify, or deploy
Railway resources; it does not pair WhatsApp; and it does not make a model request.

The designated canonical JARVIS Neon project is:

- Name: `jarvis-staging`
- Non-secret project ID: `jolly-truth-47196608`

The current authenticated connector did not return project metadata for that identifier (it returned
`INVALID_ARGUMENT`), so this document records the supplied project reference rather than claiming a
fresh connector verification. No connection string was requested, retrieved, logged, or written to
the repository.

Railway provisioning for the proposed `jarvis-core-staging` project remains blocked by the workspace
free-plan resource limit. This phase intentionally makes no Railway mutation.

## Runtime composition

Both deployable processes now own explicit runtime containers:

```text
validated config
  -> PostgreSQL connection and minimum JARVIS schema check
  -> pg-boss start
  -> repositories, policy/approval boundary, Brain, and optional transport adapter
  -> HTTP routes or durable worker registrations
  -> listen on Railway PORT
```

`APP_ENV=staging` is a first-class server environment. It requires `DATABASE_URL` during
configuration parsing and will not use an in-memory substitute. Startup verifies connectivity and
the existence of the canonical `jarvis.events` and `jarvis.jobs` tables without applying or
generating migrations.

Development and test remain provider-free foundation environments. They can expose explicit
`not_initialized` checks when no database is configured; they do not claim durable persistence.
Production keeps its separate configuration requirements and continues to reject the untagged
Evolution source-build contingency.

## Availability semantics

| Endpoint | Meaning | Does not mean |
| --- | --- | --- |
| `GET /health/live` | The process is alive. | PostgreSQL, pg-boss, OpenAI, or WhatsApp is usable. |
| `GET /health/ready` (API) | Canonical database and API queue-enqueue path are ready. | WhatsApp is connected. |
| `GET /health/ready` (worker) | Canonical database, pg-boss, and durable event handler registration are ready. | A transport side effect has been sent. |
| `GET /health/transport/evolution` | Safe Evolution configuration/connection state. | Core canonical state is unhealthy. |

Missing `OPENAI_API_KEY` yields the explicit model check `not_configured`. The service never
fabricates a model result and never performs a billable request merely to satisfy readiness.

## Transport boundary

`JARVIS_EVOLUTION_ENABLED=false` remains the default. When false, no Evolution client, webhook
parser, or transport worker is composed. If later explicitly enabled in staging, the exact Phase 3
version gate still requires the reviewed source build, patched Baileys evidence, and an immutable
digest before the adapter can make a provider request. `APP_ENV=production` still blocks that
source-build contingency.

The JARVIS Neon project holds only JARVIS canonical state. Future Evolution PostgreSQL, Redis, and
session state must remain separate.

## Non-public staging probe

The API can register `POST /internal/staging/synthetic-turn` only when all of the following are
true:

1. `APP_ENV=staging`.
2. A trusted `JARVIS_OWNER_ID` is configured.
3. `STAGING_RUNTIME_TEST_TOKEN` is set as a platform secret.

The route accepts only bounded synthetic text and an idempotency key. It does not accept an owner,
provider payload, action, tool, or arbitrary canonical-event shape. It authenticates the bearer
token with a constant-time comparison, persists a canonical event, and returns quickly; the worker
later invokes the normal Brain/policy/persistence path. The route is absent in development, test,
and production.
