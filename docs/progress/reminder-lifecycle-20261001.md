# Requested reminder lifecycle repair — 2026-10-01

Status: production due-time path and completed-job replay verified on 2026-10-01 using a fresh owner-requested ten-minute Telegram reminder. Telegram acceptance is proven; device delivery/read and all failure scenarios are outside this result.

## Deployment and gates

- Existing project: `jarvis-api-staging`; existing production alias preserved.
- Deployment: `dpl_5iLPkDrwkjVZ43EzuMjFoqax34SS` (Production / Ready).
- Checkout HEAD: `cb2284b8a6854cb8ede29ea82aebe1b5846337f9`; deployment includes the accepted working tree and this repair, rather than a new commit.
- Reminder source fingerprint: `7092f7f1a2bdfc265dd992f424f9df8c1180e01707aa61546b5b54afd0abaa35` (15 implementation/dependency files).
- Full CI: 422 passed, 16 conditional integration tests skipped in the provider-free default run; formatting, lint, typecheck, build, bundle and secret checks passed.
- Trusted dedicated PostgreSQL suite: 10/10 passed with two distinct login roles against the same disposable local database.
- Focused reminder PostgreSQL suite, run explicitly in that database: 5/5 passed, including two-role concurrent due preparation, final Telegram acceptance through the existing lease/result path, stale/foreign binding rejection, quiet mode, expiry, rollback and replay.
- Migration check passed; this repair requires no migration.
- Postdeployment readiness: HTTP 200; configuration, database, queue and model passed.
- Runtime database principal's required table privileges attested without exposing credentials or the role name.
- Telegram webhook remains registered at the existing host/path, pending count zero. Telegram reports the historical category `webhook_server_error`; the fresh authenticated inbound reminder and due send below both passed. The historical provider field has not cleared and is not represented as a fresh failure.

## Functional boundary

The live failure persisted the unregistered model-native action `create_reminder`. Existing policy correctly denied it. No policy alias was added.

`reminder-intent-v2@2.0.0` exposes semantic reminder intent. Server materialization resolves subject and time from the original owner request, canonical IANA timezone and provider request instant, assigns identifiers, and constructs exactly one canonical `internal.reminder.create`. Redundant model action identifiers are retained only as non-executable evidence. Missing typed intent cannot turn success prose into an authoritative scheduled receipt.

Reminder, trigger, proposal binding and durable fire job commit together through existing policy/executor. Scheduling success requires a postcommit reread. The existing orchestration publisher dispatches the fire job and can recover publication on source-event replay. Due processing rereads canonical action/source/owner/target, honors connection/kill-switch/quiet controls, and measures existing reminder freshness from the canonical due time. One transaction creates reminder message, attempt, outbox and outbound job. Existing Telegram sender and receipt handling are unchanged.

The canonical owner Telegram destination is resolved from the exact approved mapping, participant registry and existing private conversation. Verified Telegram and WhatsApp source requests can resolve to it; internal/synthetic/unsupported sources cannot silently gain owner delivery authority. No provider recipient comes from the model.

## Required phrase evaluations

| Synthetic owner input                                | Result                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Remind me in 10 minutes to take a shower             | One server-owned reminder action; request timestamp plus 10 minutes     |
| Text me in 10 minutes and remind me to take a shower | Same canonical reminder behavior; no model-native action alias          |
| Remind me at 6:30 PM to leave                        | Owner IANA local clock converted server-side to UTC                     |
| Remind me tomorrow morning to call Kerem             | Exact-time clarification when no confirmed morning clock is established |
| Remind me about that                                 | Subject clarification when no uniquely grounded referent exists         |

Additional tests cover negated/quoted requests, unsupported date modifiers, conflicting clocks, explicit past today, nonexistent/ambiguous DST times, missing timezone, model ID/time/destination injection, unavailable destination, policy denial, uncertain verification, missing typed intent and replay.

## Live production proof — 2026-10-01

The pending two-minute example was superseded by the owner's actual fresh ten-minute request. It exercises the same production relative-time and due-delivery path and meets ADR 0022's fresh short-interval criterion. No additional reminder request, historical resend, paid model call or owner message was generated by the verification session.

Vercel's production alias still resolves to `dpl_5iLPkDrwkjVZ43EzuMjFoqax34SS` (Ready). The source event is `1186629a-f319-4c82-895f-59866635a252`. Read-only, repeatable-read canonical snapshots confirmed all ten verification checks, and the captured records were unchanged after four authenticated completed-job replays. [Content-free evidence, canonical IDs, timestamps, checks and replay receipts](reminder-live-verification-20261001.json).

| Stage                                        | UTC on 2026-10-01 | America/Chicago (CDT) |
| -------------------------------------------- | ----------------- | --------------------- |
| Original provider request instant            | 22:51:37.000      | 5:51:37.000 PM        |
| Canonical ingress receipt                    | 22:51:39.117      | 5:51:39.117 PM        |
| Scheduling confirmation accepted by Telegram | 22:51:52.687      | 5:51:52.687 PM        |
| Canonical due time                           | 23:01:37.000      | 6:01:37.000 PM        |
| Due reminder prepared                        | 23:01:40.074      | 6:01:40.074 PM        |
| Due reminder accepted by Telegram            | 23:01:41.511      | 6:01:41.511 PM        |

The due time is exactly 600,000 ms after the original provider request instant, not the later ingress or model-completion time. Preparation occurred 3,074 ms after due; Telegram acceptance occurred 4,511 ms after due. These are recorded wall-clock intervals for this one request, not an SLA or a cross-process monotonic measurement.

Canonical evidence:

- One authenticated, enrolled owner direct Telegram event, one inbound message reference, one completed Brain request and one validated `remind` decision.
- One completed `openai/gpt-6-luna` model run with medium reasoning: 3,942 input tokens, 880 output tokens (including 568 reasoning tokens), model latency 7,681 ms, exact Gateway receipt `$0.000932675`. This is the existing owner's request cost; the audit and replays added zero model calls.
- Exactly one server-materialized `internal.reminder.create` action (`LOW_RISK_INTERNAL`), allowed by the existing `phase-1.0` policy, one completed execution/result, and one recorded postcommit verification. Its transition records `server_validated_reminder_intent`, `allowed`, `executed`, `verified`.
- One applied reminder proposal and one owner/action/source-bound reminder, fixed-time trigger and fire job. The subject matched the canonical action and was grounded in the owner's request without copying message content into the evidence.
- One due preparation attempt and one `reminder.requested.fire` audit. The reminder trigger is inactive and its due pointer is consumed. The reminder remains active with no completion timestamp; sending the notification did not complete the underlying intention.
- Four completed jobs, each with one attempt and one completed job execution: source processing, reminder fire, confirmation send and due reminder send.
- Two total outbound acceptances: the scheduling confirmation and exactly one due reminder. The due delivery is `sent`, has one attempt and a provider receipt, matches the current approved owner target, and has no failure or reconciliation requirement. `delivered_at` and `read_at` are null; this does not prove device delivery or that the owner read it.

## Completed-job replay proof

The verifier reread every selected job as `completed` before calling the existing protected `/api/internal/orchestration/jobs/<job-id>/run` endpoint with its stored generation and correlation ID. Source processing, reminder fire, confirmation send and due send each returned HTTP 200 with `{"disposition":"already_completed"}` at 23:31:53–23:31:58 UTC.

Before/after comparisons matched the captured source, Brain/model/decision, action/policy/execution/result, reminder/proposal/trigger, job and job-execution, reminder-attempt, outbox/message projections, audit, counts, checks and timing. Counts stayed at one Brain request, one model run, one action, one action execution, four jobs, two total deliveries and one due delivery. No model run, action, preparation, job execution or send was duplicated. Runtime configuration projection can update connection metadata during any callback; it is not a second job execution.

The first replay attempt used a Vercel environment export placeholder and returned HTTP 401; an immediate read-only check confirmed no canonical change. Vercel intentionally exports sensitive variables as `[SENSITIVE]`. The verifier then obtained the already-configured callback credential from the matching `determined-retriever-869` Convex deployment without printing it, changing it or changing deployment configuration. The four authenticated no-op replays above are the final replay result.

Fresh readiness returned HTTP 200 with configuration, database, queue and model all passing. The protected Telegram status endpoint reported the existing webhook host/path, zero pending updates and the historical `webhook_server_error` field. Vercel's canary interval contains five HTTP 200 requests and one HTTP 202 request. Its single error-level group is the existing `pg-connection-string` SSL-mode compatibility warning, rather than a failed callback; no assertion of an empty error log is made.

## Verification commands and scope

- Read-only canonical verifier: `node C:/Users/localhost/Jarvis-Local-Secrets/verify-requested-reminder.mjs <local-content-free-snapshot>`; ten invariant checks passed before and after replay.
- Terminal-job replay verifier: `node C:/Users/localhost/Jarvis-Local-Secrets/replay-completed-reminder-jobs.mjs`; four HTTP 200 `already_completed` receipts, followed by unchanged captured canonical records.
- `pnpm exec vitest run packages/brain/test/owner-reminder-time.test.ts packages/brain/test/outcome-response.test.ts packages/orchestration/test/requested-reminder-dispatch.test.ts`: 27/27 passed across three files in this verification session.
- The 422-test CI, 10-test two-role PostgreSQL gate and five focused reminder PostgreSQL tests above are the recorded deployment checks, not new runs in this verification session. Runtime source was not edited or redeployed, and no migration, model routing, authority, budget or feature flag was changed.

## Next reliability work

The live success criterion is cleared within its scope. The following source-review findings remain separate from the passing canary:

1. Due preparation revalidates approved enrollment and quiet mode. The later Telegram callback rechecks its environment enable gates, but its target-registry lookup and generic outbox lease do not revalidate enrollment or quiet mode. A change after preparation and before the sender callback could therefore leave an already-prepared reminder eligible. The next small repair should revalidate those canonical controls at final send and test that exact interval. This was not an observed failure of the canary.
2. The current concrete Bot API client treats explicit failure responses, including returned 429/5xx errors, as terminal. Unknown/network outcomes require reconciliation, and the existing lease prevents blind resend. Those failure branches were not exercised live here. The executor also ignores the repository's `retry_scheduled` result, but that result is unreachable from the current concrete client's classifications; it is a latent interface gap if safely retryable responses are introduced, not an observed lost retry.

Current source references are `apps/api/src/telegram-bot-client.ts`, `apps/api/src/telegram-bot-delivery.ts`, `apps/api/src/vercel-runtime.ts`, `packages/database/src/requested-reminder-fire.ts`, `packages/database/src/telegram-participant-enrollment-repository.ts` and `packages/database/src/transport-repository.ts`. Preserve the passing due path and the no-blind-retry rule when addressing these follow-ups.
