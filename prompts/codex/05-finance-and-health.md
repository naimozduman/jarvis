# Phase 5: Read-only finance, WHOOP, training, and nutrition interfaces

Use `$connector-integration`, `$security-and-privacy`, `$jarvis-product-rules`, and `$agent-evals`.

Finance:

- provider-neutral finance interface
- Plaid Link in the admin Connectors page
- Chase and selected Mercury account allowlist
- balances, transactions, recurring activity, and liabilities only
- transfer reconciliation
- due-date, duplicate-charge, subscription, utilization, cash-flow, and low-balance alerts
- visible freshness and coverage
- no transfer or payment tools

WHOOP:

- OAuth 2.0 with refresh handling
- raw-body webhook signature validation
- quick acknowledgment and durable processing
- retry-safe deduplication
- periodic reconciliation
- sleep, recovery, strain, and workout summaries

Training and nutrition:

- narrow service interfaces for Iron & Intervals and the future food app
- read plan and history
- write an approved workout or food log
- merge and conflict workflow for overlapping sources

Prove stale finance data is labeled. Prove a Mercury-to-Chase payment is not double-counted. Prove WHOOP duplicate webhooks do not duplicate workouts.
