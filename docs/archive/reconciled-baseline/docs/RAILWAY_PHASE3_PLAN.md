# Railway Phase 3 deployment plan

> **Historical status — abandoned / superseded by the zero-cost architecture.** This document is
> retained as architectural history for the former Railway API/worker staging plan. Phase 3.6 does
> not revive, deploy, or mutate this approach; the current runtime is documented in
> [VERCEL_RUNTIME.md](VERCEL_RUNTIME.md) and [CONVEX_ORCHESTRATION.md](CONVEX_ORCHESTRATION.md).

This is a design and readiness document only. Phase 3 does not deploy Railway, pair a phone, create secrets, or activate Evolution.

## Intended project layout

Project: `jarvis-core`

| Service | Responsibility | Exposure |
| --- | --- | --- |
| `jarvis-api` | Fastify API and verified webhook ingress | Public only for protected JARVIS/API routes as required |
| `jarvis-worker` | pg-boss event, reminder, outbound, reconciliation workers | Private |
| `evolution-api` | Dedicated WhatsApp transport, one replica | Private Railway networking only |
| `evolution-postgres` | Evolution-only provider infrastructure state | Private |
| `evolution-redis` | Evolution cache if the reviewed source configuration requires it | Private |
| Neon | Canonical JARVIS PostgreSQL | Outbound DB connection only |
| Vercel (future) | Web control center | Separate future phase |

Use Railway private service DNS (for example `evolution-api.railway.internal`) between JARVIS and Evolution wherever Railway supports it. Do not expose the Evolution control plane on a public URL. If a callback needs an externally reachable JARVIS endpoint, it should terminate at `jarvis-api` and be protected by the Evolution per-instance webhook JWT; Evolution itself remains private.

## Deployment prerequisites

1. Complete every evidence item in [EVOLUTION_VERSION_GATE.md](EVOLUTION_VERSION_GATE.md).
2. Build/push one immutable, reviewed source-build image by digest. Do not use `latest`, a tag without digest, or a floating branch.
3. Configure Evolution storage/volume for session state separately from Neon and constrain it to one transport replica unless a reviewed session-coordination design exists.
4. Add secrets only through Railway's secret mechanism after an owner-approved deployment review. No value belongs in source, compose, image layers, logs, or build artifacts.
5. Set Evolution `SERVER_PORT` to the Railway-assigned port convention used by the reviewed source; validate its HTTP bind behavior in staging. Do not assume the upstream default `8080` satisfies Railway automatically.
6. Deploy core API/worker independently. Their readiness must remain meaningful when Evolution is disabled or disconnected.

## Rollout and rollback

Start disabled with an internal-only health/version proof. Enable webhook registration for the small allowlist, then pair through authenticated admin UI, then enable owner-only inbound and outbound. Observe connection, rejection, queue, delivery, and error-category telemetry without message bodies or phone numbers. Rollback means disable transport/outbound, retain canonical state, and investigate/re-pair; it never deletes JARVIS brain data.
