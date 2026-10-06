# Staging runtime runbook

> **Historical status — abandoned / superseded by the zero-cost architecture.** Keep this former
> Railway runbook as evidence of the earlier staging design, but do not execute it as a Phase 3.6
> deployment procedure. The current repository-side runtime boundary is documented separately.

This runbook is preparation for the next reviewed Railway attempt. It does not authorize a Railway
deployment, live OpenAI request, Evolution enablement, or WhatsApp pairing.

## Required server configuration

Set values only in the deployment platform's secret/variable store. Do not put values in Git,
terminal transcripts, screenshots, source files, or this document.

| Variable | Purpose |
| --- | --- |
| `APP_ENV=staging` | Selects the real server staging environment. |
| `DATABASE_URL` | Pooled runtime connection to the canonical JARVIS Neon database. |
| `JARVIS_OWNER_ID` | A pre-created synthetic owner UUID, only if the synthetic probe route is needed. |
| `STAGING_RUNTIME_TEST_TOKEN` | Optional secret that enables the non-public synthetic probe route. |
| `OPENAI_API_KEY` | Optional model adapter secret; omission reports `not_configured`. |

Do not enable `JARVIS_EVOLUTION_ENABLED` until the separate Evolution version/digest gate is
complete. Its absence does not make JARVIS core readiness fail.

## Migration preparation

Migrations are intentionally separate from the runtime `DATABASE_URL`. An operator with approved
staging database access must inject the direct or otherwise migration-suitable connection only into
the process that runs:

```powershell
$env:JARVIS_MIGRATIONS_DATABASE_URL = '<secure platform-injected value>'
pnpm db:migrate
pnpm db:check
```

The guarded migration script never falls back to `DATABASE_URL`. Do not run these commands until
the connection is available securely and the target is confirmed to be `jarvis-staging`. Phase 3.5A
did not apply a migration.

On managed Windows, if the ordinary `pnpm db:check` wrapper encounters the documented libuv
identity error, use only the documented process-local identity workaround that invokes the identical
Drizzle schema check. Do not weaken schema validation.

## Explicit service commands

From the repository root, use the commands below rather than relying on monorepo auto-detection:

| Service | Build | Start | Health path |
| --- | --- | --- | --- |
| `jarvis-api` | `pnpm build:api` | `pnpm start:api` | `/health/ready` |
| `jarvis-worker` | `pnpm build:worker` | `pnpm start:worker` | `/health/ready` |

Both processes honor `PORT`, as injected by Railway. Local fallback ports remain `API_PORT=4000`
and `WORKER_HEALTH_PORT=4100` only when `PORT` is absent.

## Operational checks

1. Confirm `/health/live` returns `200` for the started process.
2. Confirm `/health/ready` reports `database: pass` and `queue: pass` before treating the process
   as deployable.
3. Confirm a missing model key appears as `model: not_configured`; do not send a live model request
   solely for readiness.
4. Keep Evolution disabled. Its transport endpoint should state `disabled` without affecting core
   readiness.
5. If the synthetic route is explicitly enabled, use only synthetic data. Replay the identical
   idempotency key and confirm that one canonical event/job is retained.
6. Restart API and worker independently. PostgreSQL/pg-boss state must remain; the containers close
   HTTP intake before pg-boss and database resources.

If database connectivity fails after boot, readiness becomes `503` with a dependency-state result;
the response never includes a connection string or raw driver error. A transport outage is reported
only through transport health and does not delete canonical commitments, memory, plans, or jobs.
