# Phase 6: Health, finance, training, nutrition, and additional connectors

Historical build prompt from the original staged build kit. Before using any step, read `CODEX_START_HERE.md`, follow `docs/JARVIS/CODEX_START_HERE.md`, and consult `CANONICAL_DOCUMENTATION_MAP.md`. The instructions below describe their original phase and are not current startup or release authorization. Preserve current source, accepted ADRs and later product decisions.

Use `$connector-integration`, `$security-and-privacy`, `$jarvis-product-rules`, and `$agent-evals`.

Implement provider-specific interfaces only after scope, authentication, retention, policy, and
reconciliation requirements are verified. Finance remains read-only. WHOOP, Iron & Intervals, food
logging, and later connector capabilities must use the Phase 1 event/job/policy/approval/audit
contracts rather than direct state mutation.

Prove stale data is labelled, duplicate source events do not duplicate state, and no finance write
product or endpoint exists.
