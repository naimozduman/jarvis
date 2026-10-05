# Reminder final-send reliability repair — 2026-10-02

The owner accepted the October 1 production reminder slice and authorized this bounded repair, controlled failure tests, complete CI, disposable database verification and deployment after those gates pass. No further live reminder or model call is needed.

## Final authority boundary

The Telegram sender passes its canonical leased job snapshot to a final Neon transaction. It locks the outbox row and rereads exact owner enrollment, source/message/conversation scope, current delivery permission and runtime gates, applicable quiet mode, reminder activity, executed source action, current fire-job identity and saved generation, outbound job generation/worker/attempt/lease, delivery lease/freshness, prior acceptance and reconciliation state. A provider recipient is returned only after these checks pass. The existing owner transport policy and critical exception are reused; requested reminders remain noncritical.

Preparation saves the fire generation in existing reminder metadata. Prepared reminder rows without that evidence fail closed; historical sent/completed rows remain handled. Existing operation/message/reminder/job IDs, Convex signals, source/action history, freshness and attempt limits stay intact. No migration or scheduler deployment is required.

Denial persists a terminal non-success outbox state and `transport.telegram.final_send_blocked` audit with a safe reason category. It preserves the reminder and does not mark delivered, read or task completed. A row-locked one-use marker prevents reuse of the same delivery attempt. Provider HTTP starts immediately after the short transaction, outside database locks. A later revocation cannot undo a request already begun.

## Provider evidence and retry behavior

The official [Telegram Bot API response contract](https://core.telegram.org/bots/api#making-requests) and [flood-control parameters](https://core.telegram.org/bots/api#responseparameters) were checked October 2, 2026 (Bot API 10.3). The official endpoint, webhook ingress and ten-second request timeout remain. New tests use synthetic provider responses, with no live send or sandbox claim.

| Tested evidence                                                                           | Persisted behavior                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Explicit `ok: false` temporary 503 rejection                                              | Retryable nonacceptance, existing bounded backoff, same operation/message/job and generation.          |
| Explicit 429 flood control                                                                | Wait at least `retry_after` and existing backoff. A wait beyond freshness ends in terminal expiry.     |
| Timeout/network exception, unreadable/malformed response, success without a valid receipt | Unknown outcome; reconciliation required; no automatic resend. Expiry and replay preserve uncertainty. |
| Explicit permanent 403 rejection                                                          | Terminal failure with safe category; no retry or recipient substitution.                               |
| Boolean `ok: true` with positive safe integer receipt                                     | Accepted/sent with opaque receipt; no inferred device-delivered/read or task completion.               |

Safe retry commits the outbox retry instant before propagating it to the existing canonical callback. Job failure scheduling takes the later of normal job backoff and the committed outbox/provider floor, retaining deadline and attempt limits. It uses the existing `retry_allowed` callback path rather than republishing a same-generation Convex schedule. Unknown outcomes require reconciliation of persisted leases, dispatch evidence and any known receipt. Without evidence of nonacceptance, this sender has no safe automatic resend decision.

## Verification and release

- Expanded reminder disposable PostgreSQL suite: 25/25 passed using two distinct roles in the same local test database. Covers changes after preparation, cancellation/remapping, superseded fire/outbound generation, stale leases, concurrent/replayed callbacks, one-use dispatch, expiry reconciliation, 503/429 retry floors, unknown outcomes, permanent rejection and retry beyond expiry.
- Dedicated migration/job PostgreSQL gate: final repeat passed 10/10, zero skipped, using two distinct roles in the same disposable database.
- Existing focused reminder regressions plus provider parsing: 41/41 passed across four files.
- Full `pnpm run ci` passed: formatting, lint, typecheck, 436 tests, build, bundle validation and secret scan. The default run skipped 36 environment-gated database cases. The 35 local database cases above ran explicitly with zero skips before release. A final skip-accounting check also ran the remaining preexisting isolated synthetic Neon reliability fixture: 1/1 passed, zero skips, after release. It exercised stored synthetic accounting/action data without a model/provider call. All 36 gated database cases therefore have explicit passing results.
- Production deployment `dpl_7JmFNgjpbfPNt5RJFRSi52Krt7SF` is READY at [the existing production alias](https://jarvis-api-staging.vercel.app). It replaced `dpl_5iLPkDrwkjVZ43EzuMjFoqax34SS` after all runtime gates passed. No migration, feature flag, enrollment, routing, scheduler, policy or authority change was deployed.
- Production readiness returned HTTP 200 with configuration/database/queue/model passing. The authenticated runtime role has all required canonical row-lock privileges. There are no prepared unsent reminders missing generation evidence.
- All four completed canonical jobs replayed as HTTP 200 `already_completed`. Twelve captured canonical projection groups, including Brain/model/action, reminder, jobs/executions, attempts, outbox, audit and counts, remained unchanged. No new model call or Telegram send occurred.
- No new live reminder, paid model call, authority or adjacent product work.

The first deployment attempt with newly fetched CLI 62.1.0 returned `Not authorized`; the already-authenticated CLI 62.0.0 used by the accepted deployment succeeded. One initial no-op replay used an incorrect trigger label and was rejected with HTTP 400 before execution; full canonical projections stayed unchanged. The four corrected callbacks above are the final replay result.

Post-release request counts were six HTTP 200s and that one rejected validation request. The runtime error aggregator reported the existing `pg-connection-string` SSL compatibility warning (two occurrences), not an application callback failure. Telegram status still reports historical `webhook_server_error` with zero pending updates. This evidence does not claim an error-free historical webhook or live failure injection.

The bounded reliability repair is complete. [Content-free release evidence](reminder-final-send-evidence-20261002.json) records deployment identity, gate results, runtime privilege/readiness checks, replay receipts, unchanged canonical counts and runtime/test file hashes. The accepted uncommitted working tree was deployed on base commit `cb2284b8a6854cb8ede29ea82aebe1b5846337f9`; source hashes identify the bounded repair beyond that base.

## Daily usefulness remains

Completion of this reliability repair does not establish daily usefulness. Phase 3.8 / candidate J5-M09 still needs owner-corrected real captures and commitments, missed commitments/replans, interruption quality, tone/strictness/ghosting/memory/reminder usefulness, quiet-hour behavior and mode transitions. Link corrections to regressions and prompt/intervention tuning, audit mode changes without authority expansion, show actual use dates and missing coverage, and avoid notification quotas. J5-M09 proposes a thirty-day evidence window before unattended expansion; this task does not adopt the mission or establish that coverage. Web control center, Gmail/Calendar, Android, voice, EDITH and new authority stay outside scope.
