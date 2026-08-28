# Phase 5: Gmail and Google Calendar

Use `$connector-integration`, `$security-and-privacy`, `$database-and-jobs`, and `$agent-evals`.

Verify current Google OAuth, Gmail push, Pub/Sub, history cursor, Calendar watch-channel, renewal,
and webhook guidance. Implement provider adapters through the canonical connector/event/action
contracts with minimum scopes, reconciliation, idempotency, policy, approvals, and audit.

Prove prompt injection inside an email cannot call tools or change policy, and missed notifications
recover through reconciliation.
