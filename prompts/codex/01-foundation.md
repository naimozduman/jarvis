# Phase 1: Canonical data, events, jobs, auth, and audit

Read the PRD sections on memory, permissions, events, and security. Use `$database-and-jobs`, `$security-and-privacy`, and `$jarvis-product-rules`.

Implement:

- Neon/Drizzle schema for user, devices, conversations, messages, events, constitution, facts, preferences, people, projects, commitments, open loops, observations, hypotheses, daily state, reminders, approvals, connector accounts, source records, jobs, model decisions, tool calls, and audit entries
- pg-boss configuration and worker heartbeat
- normalized event ingestion with schema version and idempotency
- Better Auth with single-user allowlist and passkey-ready setup
- encrypted token-vault interface with a local development implementation
- policy engine skeleton
- admin shell with Today, Chat, Brain, Connectors, Approvals, and Activity routes
- synthetic fixtures and migration tests

Do not add WhatsApp or Google yet. Finish with a local smoke test that creates an event, queues a job, updates state, and records an audit entry exactly once under duplicate delivery.
