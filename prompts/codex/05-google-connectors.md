# Phase 5: Gmail and Google Calendar

Historical build prompt from the original staged build kit. Before using any step, read `CODEX_START_HERE.md`, follow `docs/JARVIS/CODEX_START_HERE.md`, and consult `CANONICAL_DOCUMENTATION_MAP.md`. The instructions below describe their original phase and are not current startup or release authorization. Preserve current source, accepted ADRs and later product decisions.

Use `$connector-integration`, `$security-and-privacy`, `$database-and-jobs`, and `$agent-evals`.

Verify current Google OAuth, Gmail push, Pub/Sub, history cursor, Calendar watch-channel, renewal,
and webhook guidance. Implement provider adapters through the canonical connector/event/action
contracts with minimum scopes, reconciliation, idempotency, policy, approvals, and audit.

Prove prompt injection inside an email cannot call tools or change policy, and missed notifications
recover through reconciliation.
