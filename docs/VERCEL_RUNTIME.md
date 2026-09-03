# Vercel serverless runtime

## Project boundary decision

Phase 3.6B selects **option B**:

- Preserve the existing Hobby project **`jarvis-web`** for the later control-center web app. It
  remains intact with zero deployments and only its two safe configuration values.
- Use one distinct Hobby project, **`jarvis-api-staging`**, for this stateless API. It was created
  empty on the authenticated Hobby team during Phase 3.6B and has zero deployments, no domain, no
  framework binding, and no project configuration. A separate deployment review must set its Vercel
  root directory to `apps/api` before any deployment.

This is the smallest clean boundary: the API needs server-only Neon and callback secrets while the
future browser application must never receive them. No extra per-feature Vercel projects are
planned, and this repository work has not deployed either project.

## Design

`createVercelApiRuntime` is an explicit, disposable serverless composition. Each invocation opens
the canonical Neon-backed repositories it needs, validates the schema/connection, serves the
request, and closes resources through the runtime boundary. It does not start an HTTP listener,
pg-boss worker, timer, local filesystem store, sticky-process cache, or Evolution client.

```text
request / Convex callback
  -> Vercel API composition
  -> canonical Neon repositories and lease checks
  -> optional opaque Convex command after canonical commit
  -> response
```

Every correctness decision is reconstructible from Neon: job status and generation, job leases,
event processing, delivery availability, expiry, bridge lease capability, retry time, connection
presence, and delivery completion. Process memory may optimize nothing essential and cannot be a
source of truth.

## Deployable Fastify entrypoint

The API remains Fastify; it is not rewritten as a Next.js API. The Vercel Web-Handler entrypoint is
`apps/api/api/[...route].ts`:

```text
Vercel /api/* Web Handler
  -> createVercelFetchHandler()
  -> createVercelApiRuntime()
  -> Fastify app.inject(canonical path)
  -> Response, then runtime.stop()
```

It maps the Vercel function prefix back to the existing Fastify surface. For example,
`/api/health/ready` invokes Fastify `/health/ready`, and
`/api/internal/orchestration/jobs/:jobId/run` invokes the existing authenticated callback route.
The adapter uses Fastify's in-process injection API; it never binds a TCP port or starts a
permanent local listener. Vercel owns HTTP delivery.

This is a supported Node.js Vercel Function pattern. See
[Fastify on Vercel](https://vercel.com/docs/frameworks/backend/fastify) and
[Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).

## Responsibilities

| Component | Vercel responsibility | Explicit non-responsibility |
| --- | --- | --- |
| Canonical job callback | Rehydrate, lease, execute registered serverless handler, and write canonical result. | Retaining a worker loop or treating Convex as the state store. |
| Event processing | Persist/rehydrate canonical event, run Brain/policy boundaries, build canonical outbox intent. | Calling Evolution or retaining a WhatsApp session. |
| Local bridge API | Authenticate bridge, acquire/load Neon delivery lease, accept result/heartbeat, schedule opaque retry signal. | Sending a WhatsApp message or exposing private content to Convex. |
| Model runtime | Use the Vercel AI Gateway adapter only when configuration and free-tier policy allow it. | Direct paid OpenAI fallback or hosted conversation state. |

The runtime refuses `JARVIS_EVOLUTION_ENABLED=true`. Evolution may exist only behind the local
bridge during later operator setup, never in a Vercel process.

## Internal routes

The deployed function exposes these existing Fastify routes beneath `/api`; all payloads are
bounded and internal routes are authenticated where composed.

| Route | Caller | Result |
| --- | --- | --- |
| `POST /internal/orchestration/jobs/:jobId/run` | Convex | Authenticates opaque callback, loads/leases Neon job, returns safe disposition. |
| `POST /internal/staging/synthetic-turn` | Explicit staging test | Bounded protected synthetic canonical conversation path, registered only when staging configuration explicitly enables it. |
| `POST /internal/local-bridge/deliveries/:deliveryId/lease` | Local bridge | Authenticates bridge and returns content only after a fresh, owner-scoped Neon lease. |
| `POST /internal/local-bridge/deliveries/:deliveryId/result` | Local bridge | Records accepted/retryable/terminal result in Neon and repairs an opaque retry signal when necessary. |
| `POST /internal/local-bridge/signals/:deliveryId/:sequence/ack` | Local bridge | Forwards only opaque acknowledgement fields to Convex. |
| `POST /internal/local-bridge/heartbeat` | Local bridge | Records canonical transport presence with no provider session material. |
| `POST /internal/local-bridge/events` | Local bridge | Ingests normalized inbound WhatsApp event into canonical Neon, then signals opaque canonical job. |

All routes use bounded, validated payloads and safe errors. No request route ever turns a raw
provider exception into a scheduling instruction.

## Readiness

Readiness distinguishes canonical database availability, opaque orchestration configuration, and
model configuration. A bridge or provider state is not conflated with canonical database health.
In zero-cost mode, readiness reports model configured only when every configured route has an exact
catalog-verifier allow-list entry, a current-month usage snapshot, and complete conservative route
rate cards. A later unknown provider receipt still blocks the next call at the canonical guard;
readiness never claims that included credits are available.

## Separate runtime database role

The manually used migrations credential is retired and must never be reused for Vercel. Before a
separately approved deployment, create a distinct server-only `DATABASE_URL` for the existing
`jarvis-staging` project / `neondb` database and configure it only on `jarvis-api-staging`.

For a Vercel serverless runtime, use Neon's pooled connection string for that runtime role (the
hostname includes `-pooler` and TLS parameters), as Neon recommends pooling for serverless
workloads. Keep an unpooled/direct credential only for migration tooling, never in Vercel. No
credential value is present in source or documentation. See Neon's
[connection-pooling guidance](https://neon.com/docs/connect/connection-pooling).

## Independent callback-secret roles

| Boundary | Configuration name | Required this phase? |
| --- | --- | --- |
| Convex → Vercel authenticated orchestration callback | `JARVIS_CONVEX_TO_VERCEL_SECRET` | Yes, when cloud orchestration is enabled |
| Vercel → Convex command boundary | `JARVIS_VERCEL_TO_CONVEX_SECRET` | Yes, when Vercel emits commands |
| Local bridge → Vercel API | `JARVIS_LOCAL_BRIDGE_TOKEN` | No; bridge and WhatsApp remain disabled |

These are independent server-only values. They are neither printed nor committed, and no value is
configured by this repository pass.

## Deployment status and next gate

The existing `jarvis-web` Hobby project is preserved. The separate `jarvis-api-staging` Hobby project
now exists but has not configured `DATABASE_URL`, callback secrets, model routes, allow-lists, rate
cards, usage snapshots, purchased credits, or auto top-up. Neither project has deployed a Vercel
function, and no model inference request has been made.

The later deployment order is: set the existing API project's root to `apps/api`; stop on any
payment/upgrade prompt; add only the server-only pooled staging credential and Convex callback
secret; rerun catalog verification; set only proven route/accounting values after a separately
approved structured-output probe; deploy; then exercise health and the protected synthetic route.
WhatsApp pairing remains outside this sequence.
