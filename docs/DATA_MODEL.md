# Data model

## Modeling rules

- Store immutable source events separately from mutable domain state.
- Store UTC timestamps and the source timezone when relevant.
- Every derived record keeps source references, confidence, and freshness.
- Use soft deletion for recoverable application state. Use a separate purge workflow for user-requested erasure.
- Encrypt provider tokens and selected sensitive payloads at the application layer.
- Never use embeddings as the only copy of a memory.
- Never infer completion from silence.

## Core identity

### users

One row in production. Includes timezone, locale, status, onboarding version, and kill-switch state.

### identities

Maps the user to web, WhatsApp, Telegram, Google, Plaid, WHOOP, and future iOS identities. Store verified provider identifiers and allowlist state.

### auth tables

Better Auth users, sessions, accounts, verification records, passkeys, and recovery metadata.

## Connector model

### connectors

One row per provider installation. Fields include provider, state, mode, scopes, status, last success, last error, health score, paused time, and metadata.

### connector_accounts

Provider resources selected by the user, such as Google account, calendar, Plaid Item, bank account, WHOOP user, Evolution instance, or Telegram chat.

### connector_tokens

Ciphertext, key version, token type, expiration, refresh status, scopes, rotation time, and revocation time. Never return ciphertext to the web client.

### webhook_events

Immutable provider envelopes. Unique constraint on provider, connection, external event ID, and event type where available. Store raw-body object reference or encrypted body according to retention policy.

## Conversation model

### conversations

Canonical threads. V1 normally has one primary conversation plus system-specific threads.

### messages

Direction, channel, sender identity, text, reply-to message, provider IDs, delivery status, normalized type, transcript, correlation ID, created time, and source event.

### attachments

Object key, media type, size, hash, provider metadata, retention deadline, transcript link, and safety scan state.

## Event model

### events

Normalized facts that happened. Examples: message received, calendar event changed, transaction posted, sleep updated, reminder fired, commitment completed, connector revoked.

Required fields:

- id
- schema_version
- type
- source
- source_record_id
- occurred_at
- received_at
- user_id
- correlation_id
- idempotency_key
- sensitivity
- payload

## Memory model

### facts

Stable user facts. Include value schema, confidence, source, validity dates, sensitivity, and confirmation status.

### constitution_items

Versioned rules and commitments. Include priority, flexibility, minimum acceptable version, exceptions, review date, active version, and explicit approval.

### preferences

Contextual user choices. Include evidence count, confidence, expiry or review date, and whether the user confirmed the preference.

### people and relationships

Separate person identity from relationship-specific context. Promises and boundaries link to the relationship, not only the person.

### observations

Detected patterns with evidence links and a minimum evidence threshold.

### hypotheses

Tentative explanations. Include supporting and contradicting evidence, confidence, next test, review time, and promotion status.

### open_loops

Unfinished thoughts. Include next review time, uncertainty, related domain, and question to ask.

### memory_links

Typed edges such as supports, contradicts, concerns, belongs_to, derived_from, supersedes, and duplicate_of.

### memory_embeddings

Chunk text, embedding vector, model, source record, and access classification. Retrieval always returns the source record as well.

## Planning model

### commitments

Canonical obligations with status, priority, consequence, flexibility, minimum version, owner, due window, completion evidence, dependencies, and escalation policy.

### commitment_history

Append-only changes and reasons.

### day_plans

One versioned plan per local date. Fields include status, timezone, generated reason, current version, and source snapshot hash.

### plan_blocks

Start, end, duration, fixed or flexible, dependencies, location, required energy, minimum duration, source, and completion state.

### reminder_rules

Trigger, condition, escalation, quiet-hour behavior, grouping key, completion condition, and next scheduled run.

### reminder_runs

Every attempt, delivery result, response, snooze, escalation outcome, and next action.

## Decision and action model

### model_runs

Model route, prompt version, input summary hash, token usage, latency, structured result, validation errors, and cost estimate.

### proposed_actions

Action type, parameters, risk level, evidence, expiration, idempotency key, and permission result.

### approvals

Pending, approved, rejected, expired, or canceled. Store exact action payload hash so approval cannot be reused for changed content.

### tool_calls

Tool, operation ID, request hash, external IDs, status, retry state, unknown-result flag, and reconciliation outcome.

### audit_events

Append-only user-visible activity. Keep it readable without exposing secrets.

## Domain mirrors

Domain mirrors support planning and search. Original providers remain sources of truth.

- email_threads and email_messages
- calendar_events and calendar_sync_state
- finance_accounts, finance_transactions, finance_liabilities, finance_recurring_items
- health_source_records and health_daily_summaries
- training_plans, workout_links, and training_summaries
- nutrition_daily_summaries

## Database constraints

- Unique provider event keys.
- Unique outbound operation keys.
- Unique calendar external event IDs per connector.
- One active constitution version per logical item.
- One current day-plan version per user and local date.
- Check constraints for risk and approval states.
- Foreign keys from derived records to source records where feasible.
- Row-level owner predicates even though V1 has one user.

## Retention categories

| Category | Suggested default |
|---|---|
| Audit and commitment history | Indefinite until user purge |
| Raw provider webhook bodies | 30 days, then retain normalized record |
| Voice and media originals | 7 to 30 days unless pinned |
| Voice transcripts | User-configurable |
| Model input snapshots | Redacted summary only, 30 days |
| Health source records | User-configurable, summaries indefinite |
| Finance source records | Keep required history, never store credentials |
| Deleted memory content | Remove from active retrieval immediately, purge through job |

Final retention values require an ADR.
