# Railway staging deployment plan

## Status

The intended Railway project remains `jarvis-core-staging`. Railway provisioning is currently
blocked by the workspace free-plan resource limit. Phase 3.5A makes **no Railway API, CLI, dashboard,
or billing mutation**.

The repository now contains deterministic service commands for the next authorized attempt. Railway
documents that shared monorepos need separate service start commands, and that its health checks use
the injected `PORT`; this plan follows those requirements.

## Future service settings

| Service | Repository scope | Build command | Start command | Health check |
| --- | --- | --- | --- | --- |
| `jarvis-api` | repository root shared workspace | `pnpm build:api` | `pnpm start:api` | `/health/ready` |
| `jarvis-worker` | repository root shared workspace | `pnpm build:worker` | `pnpm start:worker` | `/health/ready` |

Do not configure a root directory that excludes workspace dependencies. No Railway configuration
file is committed because the services share the monorepo root while Railway service settings provide
the deterministic build/start boundaries above. This avoids duplicating secrets, project IDs, or
platform-owned settings in Git.

Railway's current documentation: [Deploying a Monorepo](https://docs.railway.com/deployments/monorepo)
and [Healthchecks](https://docs.railway.com/deployments/healthchecks).

## Deferred services

The future project design still reserves `evolution-api`, `evolution-postgres`, and
`evolution-redis`, but none is provisioned in this phase. Evolution services must use private
networking, their own database/session state, a pinned image digest, and the Phase 3 security gate.
They must not share the JARVIS Neon database or become public merely for internal API traffic.

## Required settings at the next authorized attempt

- Configure `APP_ENV=staging` for both JARVIS services.
- Add `DATABASE_URL` only through platform secrets.
- Add `OPENAI_API_KEY` only through platform secrets if the real model smoke test is authorized.
- Keep `JARVIS_EVOLUTION_ENABLED=false` initially.
- Set `PORT` only through Railway/runtime configuration; application code already honors it.
- Configure `/health/ready` as the deployment health path after migration and database setup are
  complete.

Do not add repository secrets, expose databases, configure a public signup route, or pair a
WhatsApp number as part of the next deployment attempt without separate review.
