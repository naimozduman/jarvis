# Phase 1: Core data, events, jobs, ownership, policy, approvals, and audit

Historical build prompt from the original staged build kit. Before using any step, read `CODEX_START_HERE.md`, follow `docs/JARVIS/CODEX_START_HERE.md`, and consult `CANONICAL_DOCUMENTATION_MAP.md`. The instructions below describe their original phase and are not current startup or release authorization. Preserve current source, accepted ADRs and later product decisions.

Read the PRD sections on memory, permissions, events, and security. Use `$database-and-jobs`, `$security-and-privacy`, and `$jarvis-product-rules`.

Implement:

- PostgreSQL-compatible Drizzle schema and reviewed migrations for ownership, conversations,
  messages, events, commitments, reminders, daily state, actions, approvals, audit, constitution,
  memory boundaries, connector accounts, encrypted-secret metadata, and durable jobs.
- pg-boss configuration, worker heartbeat boundary, JARVIS job lifecycle projection, bounded retry,
  and an optional disposable PostgreSQL integration suite.
- Normalized deterministic event ingestion with schema version, owner resolution, idempotency,
  transactional persistence/enqueue, policy evaluation, approval enforcement, and audit.
- Owner-only authentication abstraction with session, trusted-client, and passkey/WebAuthn-ready
  storage boundaries. Do not implement an interactive authentication flow.
- Encrypted connector-secret storage interface and test fake only; no plaintext provider tokens.
- Provider-neutral deterministic policy engine, internal action execution boundary, and synthetic
  fixtures/tests.

Do not add WhatsApp, Google, OpenAI, an agent loop, a final web interface, provider credentials, or
an external executor. Finish with a local smoke test that creates an event, queues a job, updates
state, evaluates policy, and records an audit entry exactly once under duplicate delivery.
