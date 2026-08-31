# Convex orchestration

## Role

Convex is an opaque wake-up coordinator only. It is not a canonical database, a model runtime, a
message store, or a WhatsApp transport. Neon remains canonical for events, jobs, conversations,
messages, outbound deliveries, leases, attempts, retry timing, and completion state.

The coordinator stores only bounded scheduling data:

- canonical job ID, correlation ID, trigger type, generation, schedule time, dispatch count, and
  safe error category; and
- outbound delivery ID, signal sequence, opaque timing, and signal state.

Convex must never store message bodies, prompts, Brain context, constitution text, memories, health
or finance records, private conversation history, provider credentials, raw phone/JID values, or
WhatsApp session state. The bridge subscription maps an explicit content-free projection rather
than returning a Convex document wholesale.

## Canonical-job lifecycle

```text
Neon event/job transaction commits
  -> Vercel sends opaque { jobId, correlationId, generation, triggerType, scheduledAt } to Convex
  -> Convex schedules one callback
  -> Convex calls authenticated Vercel /internal/orchestration/jobs/:jobId/run
  -> Vercel rehydrates and leases the Neon job
  -> Vercel records completion/failure in Neon
  -> Convex records only callback disposition / bounded retry schedule
```

Generation and correlation IDs reject stale callbacks. A duplicate callback rehydrates the
canonical job and receives `already_completed`, `stale`, or `cancelled`; it does not execute the
handler twice. A retry is scheduled only after the canonical executor returns an explicit,
bounded `retry_allowed` disposition.

## Opaque transport signal lifecycle

```text
canonical Neon outbound delivery exists
  -> Vercel schedules canonical delivery job
  -> callback publishes opaque { deliveryId, sequence, createdAt }
  -> local bridge subscribes to pending opaque signals
  -> bridge obtains a lease and content from Vercel/Neon, not from Convex
  -> bridge reports a result to Vercel/Neon
  -> retry callback schedules a future opaque signal, or bridge acknowledges the signal
```

A signal can be `scheduled`, `pending`, `acknowledged`, or `cancelled`. Retrying a delivery updates
or replaces its opaque signal by delivery ID and sequence. This means repeated signals, callback
replays, and a failed first acknowledgment cannot manufacture a second message send: Neon lease
state is the authority.

## Authentication and caller authority

| Direction | Route / mechanism | Authority |
| --- | --- | --- |
| Vercel to Convex | `/internal/schedule`, `/internal/cancel`, and transport-signal endpoints | `JARVIS_VERCEL_TO_CONVEX_SECRET`; accepts only opaque server-derived fields. |
| Convex to Vercel | `/internal/orchestration/jobs/:jobId/run` | `JARVIS_CONVEX_TO_VERCEL_SECRET`; Vercel loads the canonical job itself. |
| Convex to local bridge | content-free `listPendingForBridge` subscription | local bridge token; returns only delivery ID, sequence, creation time, and `pending`. |

Neither Convex HTTP handlers nor scheduled functions take an owner identity, provider command,
message content, Brain instruction, or external URL from a caller.

## Code generation gate

Convex source follows the generated-guideline artifact under `convex/_generated/ai/`. Generated
API files are not handwritten. The supported local command is:

```text
pnpm convex:codegen
```

On this worktree it correctly stopped because `CONVEX_DEPLOYMENT` was not configured. No login,
deployment, account selection, cloud project, or paid plan was created to bypass that gate. Once a
reviewed, safe deployment exists in Phase 3.6B, run codegen against it and review the generated
output before any cloud wiring or provider request.
