# Vercel serverless runtime

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

| Route | Caller | Result |
| --- | --- | --- |
| `POST /internal/orchestration/jobs/:jobId/run` | Convex | Authenticates opaque callback, loads/leases Neon job, returns safe disposition. |
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
catalog-verifier allow-list entry.

## Deployment status

This document describes repository composition only. Phase 3.6 did not create a Vercel project,
set Vercel variables, invoke the gateway, deploy a function, or run an external request.
