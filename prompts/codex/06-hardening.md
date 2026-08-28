# Phase 6: Production hardening and release candidate

Use `$security-and-privacy`, `$deploy-railway-vercel`, `$agent-evals`, and the `security_reviewer` agent.

Complete:

- threat model and trust-boundary review
- passkey and device-session hardening
- OAuth scope audit
- token encryption and key rotation procedure
- webhook signature and replay tests
- prompt-injection regression suite
- model tool allowlists and approval enforcement
- logging redaction audit
- backup and restore drill
- Evolution restart, reconnect, session-loss, and rollback drill
- queue dead-letter and stuck-job recovery
- provider outage and rate-limit behavior
- web and Telegram fallback procedure
- latency and cost budgets
- production dashboards and alerts
- data export and deletion workflow
- production readiness checklist

Deploy staging first. Run all acceptance tests. Promote production only after critical and high-severity findings are resolved. Report exact infrastructure resources, environment variables by name, deployment identifiers, smoke results, and rollback points without exposing secret values.
