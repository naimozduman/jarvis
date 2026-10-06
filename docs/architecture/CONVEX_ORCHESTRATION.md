---
title: "Convex Orchestration"
document_id: "docs::CONVEX_ORCHESTRATION"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Role

Convex is an opaque wake-up coordinator.

It is not:
- canonical database,
- Brain,
- message store,
- memory store,
- WhatsApp transport,
- approval store.

Neon remains canonical.

## Allowed data

Convex may store bounded scheduling metadata such as:
- canonical job/delivery ID,
- correlation ID,
- trigger type,
- generation/sequence,
- scheduled time,
- dispatch count,
- safe error category,
- opaque signal state.

## Forbidden data

No:
- message bodies,
- prompts/context,
- constitution,
- memories,
- health/finance records,
- private conversation history,
- provider credentials,
- raw phone/JID,
- WhatsApp session state.

## Job loop

`Neon commit -> Vercel sends opaque schedule -> Convex wakes Vercel -> Vercel rehydrates/leases Neon job -> execute -> persist result -> optional bounded retry schedule`

Generation rejects stale callbacks.

## Local transport signal

`canonical delivery -> opaque Convex signal -> local bridge sees ID/sequence -> bridge asks Vercel for fresh Neon lease/content -> sends locally -> reports result -> canonical state`

Convex never carries private content.

## Authentication

Vercel-to-Convex, Convex-to-Vercel, and local-bridge identities use separate credentials/scopes.

## Failure

If Convex is unavailable, canonical state remains correct. Recovery replays opaque wakeups, not private data.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

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
