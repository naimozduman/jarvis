# Reminder engine — current source and V5 target

A reminder is durable work with purpose and follow-up, separate from channel delivery and the underlying commitment. Silence, notification acceptance/read, dismissal or expiry of a delivery step never proves completion of the commitment.

## Implemented requested-reminder slice

Current source resolves owner time/source/target server-side, stores canonical reminder/fire/outbox work atomically, verifies postcommit state and reuses the enrolled owner Telegram destination. Requests originating on the gated Cloud owner surface still use that canonical requested-reminder delivery path.

Final send revalidates current owner enrollment, quiet state, generation, live execution/delivery lease, due/freshness and canonical source state. Reschedule/cancel/revocation fence stale work. Provider retry floors remain safe and unknown accepted outcomes are held for reconciliation, not blindly resent. See [ADR 0022](../ADR/0022-server-materialized-requested-reminders.md), [October 1 lifecycle](../progress/reminder-lifecycle-20261001.md) and [October 2 final-send repair](../progress/reminder-final-send-20261002.md).

These are source and dated evidence, not a new canary or combined-tree executable result. The relevant disposable concurrency/DB tests remain Linux gates.

## Broader V5 target

Fixed/event-relative/deadline/contextual/conditional/recurring/open-loop/follow-up/escalating trigger types are explicit expansion requirements, not a claim that every type exists. Keep waiting, follow-up-scheduled, escalated, replan-needed, expired-without-completion and needs-review distinctions.

Interruption budgets are ceilings with zero minimum. Group meaningful spontaneous work, honor quiet periods, and apply separately registered handling to explicit owner-requested replies/reminders and critical events. No useful item means zero unsolicited interruptions. Numeric pack profiles remain proposals.

Execution/delivery expiry ends that stale attempt according to explicit policy; durable business commitments remain open until actual evidence, explicit owner completion, valid cancellation or a separately defined business-state transition. Offline transport never erases them.
