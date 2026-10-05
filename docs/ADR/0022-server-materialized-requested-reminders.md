# ADR 0022: server-materialized requested reminders

Date: 2026-10-01

Status: Accepted implementation of the owner-authorized reminder boundary repair; live due-time and completed-job replay canary verified on 2026-10-01.

October 2 reliability continuation: the existing sender now enforces deterministic final-send revalidation and propagates safe provider retry floors through the existing canonical callback. Unknown outcomes remain reconciliation-required across expiry and replay. See [repair and release evidence](../progress/reminder-final-send-20261002.md) for checks, failure classes and final gate status. This adds no model decision, authority, transport or scheduler design.

An explicit owner reminder request produced a model-native `create_reminder` action. Existing policy correctly denied that unknown executable type. The repair belongs at intent materialization, without an alias in policy.

The versioned `reminder-intent-v2` module and strict model reminder intent contain subject/time wording, rationale, and an optional visible canonical commitment reference. They expose no reminder ID, owner ID, job ID, executable action name, guessed UTC offset, or provider destination. The server resolves supported relative/absolute times from the original request timestamp and canonical owner IANA timezone. Missing referents, unconfirmed morning times, unsupported dates, negation, conflicting clocks and DST ambiguity require clarification. This bounded grammar does not claim to support arbitrary natural-language dates.

A resolved intent creates exactly one server-owned `internal.reminder.create` action through existing LOW_RISK_INTERNAL policy and executor. Any redundant model-native reminder actions remain non-executable decision evidence. Unknown model actions use a denied sentinel. Registered approval-only canonical operations retain their existing policy behavior.

Scheduling first requires a supported authenticated private owner source and the unique enrolled canonical owner Telegram destination. Telegram and WhatsApp requests resolve to that same existing owner destination; no second owner or memory system is created. Reminder, trigger, fire job and proposal binding commit atomically. A reread verifies reminder/job ownership, type, due time, payload and queued state before the conversational reconciler allows success wording. Failed or unverified execution remains rejected or uncertain.

The existing orchestration publisher signals committed fire jobs after the source turn. Replay recovers publication from the canonical job ledger without another Brain/action call. The due handler locks and rereads the reminder; checks job/action/source bindings, current exact enrollment and connection controls, quiet mode, due time and existing reminder freshness. It uses database time, with retryable classification for an early callback. Freshness starts at canonical due time, not worker wake-up.

Due preparation atomically persists one server-authored reminder message, one attempt, canonical outbox intent and outbound job. Deterministic operation identities and the reminder lock prevent duplicate delivery preparation across concurrent roles. Existing Telegram lease, sender and result ingestion remain unchanged. Acceptance remains distinct from delivered/read, and reminder delivery never completes the underlying commitment. Failed publication may recover the same committed outbox; failed preparation rolls back all its writes.

Legacy proposal/audit records are not rewritten. Historical denied aliases are not retried. Legacy reminder rows without the new executed-action/job/request binding cannot gain timed-delivery authority from this repair.

No new authority, proactive messaging, transport optimization, alternate models, routing changes, planning changes, budgets or feature flags are introduced. Existing tables suffice; no migration is required.

Verification includes the five requested owner phrases, server-owned timing, strict intent parsing, denied/uncertain truthful responses, canonical two-role concurrent firing, rollback, stale/foreign binding rejection, quiet mode, expiry, Telegram final-send acceptance and replay. Production due-time proof requires one fresh owner-requested short-interval reminder after deployment.

The owner's fresh ten-minute Telegram request completed this production criterion on deployment `dpl_5iLPkDrwkjVZ43EzuMjFoqax34SS`: one canonical action with verified scheduling, one due notification accepted 4,511 ms after its canonical due time, and four completed-job replays returning `already_completed` with unchanged captured canonical records. Device delivery/read and live failure recovery are not proven by this canary. Final-send enrollment/quiet revalidation and provider-failure handling remain separately recorded reliability work. See the [live verification and remaining scope](../progress/reminder-lifecycle-20261001.md) and [content-free evidence](../progress/reminder-live-verification-20261001.json).
