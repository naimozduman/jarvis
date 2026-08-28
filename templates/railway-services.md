# Railway service template

Create one Railway project named `jarvis-core` with a staging and production environment.

| Service | Source | Public | Persistent state | Replicas |
| --- | --- | --- | --- | --- |
| jarvis-api | `apps/api` | Yes, webhook/API domain | None | 1 initially |
| jarvis-worker | `apps/worker` | No | None | 1 initially |
| evolution-api | Pinned Docker digest | Pairing/admin endpoint only while required | Session volume | Exactly 1 |
| evolution-postgres | Railway Postgres | No | Managed volume | 1 |
| evolution-redis | Railway Redis, optional | No | Managed | 1 |
| hermes-executor | Later isolated service | No | Temporary workspace only | 0 or 1 |

Use `*.railway.internal` private addresses for service-to-service traffic. Keep the public API surface limited to authenticated web APIs and verified provider webhooks.

## Required checks

- `jarvis-api`: `/health` and `/ready`.
- `jarvis-worker`: heartbeat row and queue-lag metric.
- `evolution-api`: connection-state probe plus last successful message timestamp.
- Databases: backup status and connection saturation.

## Deployment order

1. Confirm backup freshness.
2. Apply canonical database migrations.
3. Deploy API.
4. Deploy worker.
5. Run smoke checks.
6. Deploy web to Vercel.
7. Upgrade Evolution separately through its staged runbook.
