# Vercel serverless runtime

## Project boundary decision

The Phase 3.6B provisioning descriptions below are historical. As of 2026-09-07,
`jarvis-api-staging` has a live Production deployment with green non-model readiness. The
Phase 3.6C.2 identified missing canonical generation enforcement and generic job expiry. The
Phase 3.6C.3 repository repair now supplies the reviewed code and expand migration, but the cloud
release gate remains incomplete until that migration and the revision-aware code are deployed and
the failed cloud scenarios are rerun. See [the gate report](progress/phase-3-6c-2.md) and
[ADR 0015](ADR/0015-canonical-job-generation-and-expiry.md).

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
pg-boss worker, timer, local filesystem store, sticky-process cache, or Evolution client. The
separate Vercel Fastify entrypoint is responsible only for the listener Vercel captures.

```text
request / Convex callback
  -> Vercel API composition
  -> canonical Neon repositories and lease checks
  -> optional opaque Convex command after canonical commit
  -> response
```

Canonical execution decisions are reconstructed from Neon: job status, job leases,
event processing, delivery availability, expiry, bridge lease capability, retry time, connection
presence, and delivery completion. Process memory may optimize nothing essential and cannot be a
source of truth. The reviewed Phase 3.6C.3 code persists and atomically checks a Neon-owned
dispatch generation at lease acquisition, completion, and failure. Convex receives that opaque
generation but never creates a canonical revision. The nullable `execution_deadline` is an
explicit latest-start boundary for a job; it is distinct from a worker lease, outbound delivery
freshness, and a commitment deadline. Generic work remains durable by default. These changes are
repository evidence only until the reviewed migration and all runtime revisions are deployed.

## Deployable Fastify entrypoint

The API remains Fastify; it is not rewritten as a Next.js API. Vercel's supported Fastify backend
entrypoint is `apps/api/server.ts`. It is the sole file that matches Vercel's filename-and-Fastify
import entrypoint detection; the reusable inner application composition lives in
`apps/api/src/http-app.ts` specifically to avoid a competing `src/app.ts` entrypoint. The
entrypoint follows Vercel's Fastify contract and calls `app.listen({ port: 3000 })` after
registering the adapter:

```text
Vercel Fastify application entrypoint
  -> server.ts Fastify app
  -> registerVercelFastifyAdapter()
  -> createVercelApiRuntime()
  -> inner Fastify app.inject(canonical path)
  -> response, then runtime.stop()
```

Vercel captures the outer Fastify listener and runs the application as one Function. The adapter
preserves the established `/api/*` public prefix while mapping it back to the existing canonical
Fastify surface. For example,
`/api/health/ready` invokes Fastify `/health/ready`, and
`/api/internal/orchestration/jobs/:jobId/run` invokes the existing authenticated callback route.
The adapter uses Fastify's in-process injection API. Apart from the entrypoint's required captured
listener, it never starts a TCP listener, a worker, or a durable scheduler. Vercel owns HTTP
delivery.

`/api/health/live` validates only the safe application configuration and Fastify entrypoint; it
does not wait for Neon. `/api/health/ready` composes the request-scoped canonical runtime and
verifies Neon. Its pool uses a five-second initial-connect deadline so a missing or unreachable
runtime credential fails closed as a sanitized unavailable response rather than consuming the
Function's full duration.

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

These are independent server-only values. They are neither printed nor committed. The operator
configured the cloud values before the Phase 3.6C.2 tests; that test pass read Convex environment
names only and did not change configuration.

## Deployment status and next gate

The `jarvis-api-staging` Production deployment `dpl_E8PqY4DrfsGoVNvTSnbRCure6AKS` is READY, with
`apps/api` as its root and the Fastify framework. Its stable alias is
`https://jarvis-api-staging.vercel.app`. The alias serves application health and authenticated
callbacks directly; the immutable deployment URL is protected by Vercel authentication.

On 2026-09-07, liveness and readiness returned HTTP 200 with configuration, database, and queue
passing and model `not_configured`. An authenticated Convex callback, its duplicate, and a
canonically cancelled job were exercised against Neon with synthetic fixtures only. The
Convex callback base must include `/api` because its dispatcher appends `/internal/...`; the
successful cloud callback verifies that the operator's configured path resolves correctly.

The next gate is review of the Phase 3.6C.3 canonical-generation/expiry repair, then its ordered
cloud release: apply the reviewed Neon expand migration, deploy revision-aware Vercel and Convex
code, reconcile pending canonical rows into opaque schedules, and rerun stale-generation,
duplicate, cancellation, and expiry scenarios. The requested runtime commit and push remain on
hold until all required non-AI checks pass. This repair did not change `DATABASE_URL`, apply a
cloud migration, configure model IDs, call AI Gateway or OpenAI, enable BYOK, purchase credits,
enable auto-top-up, start Evolution, or pair WhatsApp.
