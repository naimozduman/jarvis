# Canonical data model

## Phase 1 implementation

The typed Drizzle definitions are in `packages/database/src/schema/`; the reviewed migrations are
`packages/database/drizzle/0000_large_prima.sql` and
`packages/database/drizzle/0001_foamy_blue_shield.sql`. JARVIS tables live in the PostgreSQL
`jarvis` schema. pg-boss owns its separate `pgboss` transport schema and is not managed by Drizzle.

The model supports one operating owner in V1 without relying on a client-supplied owner ID. Every
personal record is owner-scoped. A partial unique index permits one primary owner, while identity,
device, session, and trusted-client relations leave a future multi-identity path open.

## Invariants

- PostgreSQL—not an LLM conversation or provider—is persistent truth.
- UTC `timestamptz` is used for instants; source timezone is retained where scheduling needs it.
- JSONB holds evolvable payload/metadata; queryable lifecycle state uses typed columns and enums.
- Event payloads never flow into normal logs or audit metadata.
- Meaningful mutation paths carry an owner and correlation ID and append an audit event.
- Silence never completes a commitment; completion needs explicit evidence.
- Constitution versions are explicit rows; memory, observation, and hypothesis paths cannot change
  an active constitutional principle.
- Phase 1 has no embeddings, vector search, model runs, provider account data, or provider client.

## Identity and secret storage

| Table | Purpose |
| --- | --- |
| `owners` | Identity root, normalized email, timezone, active state, and primary-owner marker. |
| `identities` | Future identity/provider subject mapping with verification and allowlist state. |
| `devices` | Device trust, revocation, public-key fingerprint, and last-seen metadata. |
| `passkey_credentials` | WebAuthn-ready public credential boundary only; no registration/login flow. |
| `auth_sessions` | Token digest, device reference, expiry, reauthentication, and revocation; never a raw session token. |
| `trusted_clients` | Future web, iOS, service, and MCP client IDs, scopes, token digest, rotation, and revocation. |
| `connector_accounts` | Future selected connector-account metadata only. |
| `encrypted_connector_secrets` | Ciphertext envelope, algorithm, key version, nonce, expiry, rotation, and revocation only. |

`owners`, not legacy `users`, is canonical. The existing static JSON event schema uses `userId` as a
legacy transport field. A future adapter must resolve it to a verified owner server-side before an
`events` record exists.

## Conversations and messages

| Table | Purpose |
| --- | --- |
| `conversations` | Canonical owner thread, channel, optional external identity, state, and safe metadata. |
| `messages` | Channel, direction, external identity, reply reference, content type/content, delivery state, source event, timestamps, and correlation ID. |
| `message_attachments` | Object-storage reference, media type, size, hash, retention/safety metadata; no storage provider is connected. |
| `message_source_links` | Typed links from a message to an event or future source record. |

The message-channel enum includes `web`, `whatsapp`, `telegram`, `ios`, `poke`, `system`, and
`internal`. Event sources additionally include future connector identities such as `gmail`,
`google_calendar`, `plaid`, `whoop`, `iron_and_intervals`, `food_logging`, `healthkit`, and `hermes`;
that distinction lets a connector use the same event pipeline without pretending it is a chat
channel. External message identity is unique per owner/channel when present; conversation order is
indexed by occurrence time.

## Events and durable jobs

| Table | Purpose |
| --- | --- |
| `events` | Immutable envelope: type, source, source event ID, owner, idempotency key, occurrence/receipt time, payload hash, schema version, status, correlation/causation, and sensitivity. |
| `event_processing_attempts` | Append-oriented worker attempts with safe error classification. |
| `jobs` | JARVIS durable-job lifecycle projection, using the same UUID as pg-boss, with canonical dispatch generation and optional latest-start execution deadline. |
| `job_executions` | Per-worker lease/attempt history, canonical dispatch generation, and sanitized outcome; unique per job, generation, and attempt. |

`events` is unique on `(owner_id, idempotency_key)` and, when available, on
`(owner_id, source, event_type, source_event_id)`. `jobs` is unique on
`(owner_id, job_type, idempotency_key)`. These constraints—not a queue delivery claim—enforce
idempotency.

`jobs.dispatch_generation` is a Neon-owned positive revision that begins at one. A normal retry
keeps its generation and advances only the attempt count; a pending reschedule, replacement, or
cancellation advances generation and invalidates earlier opaque callbacks. `execution_deadline` is
nullable. A null deadline means durable work remains eligible until handled. A non-null deadline is
the latest instant a new database lease may begin and is checked against database time; it neither
expires an existing lease nor completes/cancels a commitment. Outbound delivery freshness remains
on `outbound_message_deliveries`; reminder expiration requires future evaluator policy rather than
an inferred completion. See [ADR 0015](ADR/0015-canonical-job-generation-and-expiry.md).

## Commitments, reminders, and daily state

| Area | Tables |
| --- | --- |
| Commitments | `commitments`, `commitment_status_history`, `commitment_deadlines`, `commitment_dependencies` |
| Reminders | `reminders`, `reminder_triggers`, `reminder_attempts` |
| Daily state | `day_plans`, `plan_blocks`, `plan_block_dependencies`, `replanning_history` |

Commitments retain source, priority, consequence, flexibility, minimum acceptable version,
completion-evidence reference, and follow-up state. Reminders support fixed, relative, contextual,
conditional, persistent, and preparation triggers with escalation and next-eligible-delivery time.
A partial unique index allows one active day plan per owner/local date; blocks encode fixed versus
flexible scheduling, estimates, dependencies, and completion/movement state.

## Actions, policy, approvals, and audit

| Table | Purpose |
| --- | --- |
| `deterministic_decisions` | Provenance for Phase 1 deterministic handlers, explicitly not an LLM/model run. |
| `policy_rule_overrides` | Owner-scoped safer-only policy configuration. |
| `policy_evaluations` | Structured allow/approval/deny result, policy version, reason, and matched rules. |
| `proposed_actions` | Canonical action, payload hash, risk, source, expiration, state, correlation, and idempotency. |
| `approval_requests` | Exact action snapshot hash, risk, requested/expiry/resolution state, actor, and safe result. |
| `action_executions` / `action_results` | Attempt/result lifecycle, future external reference ID, retries, and sanitized errors. |
| `audit_events` | Append-only mutation history with actor, target, correlation/causation, state references, reason, source, and sanitized metadata. |

The legacy static approval JSON schema uses `medium` and `high`. The runtime policy uses `READ`,
`LOW_RISK_INTERNAL`, `CONTROLLED_WRITE`, and `HIGH_IMPACT`; a future transport adapter must version
and map those values explicitly. The initial migration has a trigger rejecting `UPDATE` and `DELETE`
against `jarvis.audit_events`. State references store entity IDs, versions, and content hashes rather
than raw personal-record snapshots.

## Constitution and memory boundaries

| Area | Tables |
| --- | --- |
| Constitution | `constitution_items`, `constitution_item_versions` |
| Memory root | `memory_records` |
| Typed memory | `facts`, `preferences`, `people`, `relationships`, `projects`, `observations`, `hypotheses`, `open_loops`, `personality_traits` |

Constitution version rows store the principle, category through the root item, priority, flexibility,
source, active/current state, review date, explicit change reason, and exceptions. The schema
enforces one current version per item and a unique version number. Each memory root holds source,
source-event reference, confidence basis points, sensitivity, validity period, review time, and active
state. Typed tables preserve fact/observation/hypothesis distinction. There is no vector or embedding
table in Phase 1.

## Migration workflow

- Generate with `pnpm db:generate`; review and commit the SQL and Drizzle metadata.
- Run `pnpm db:check` to validate the migration journal.
- `pnpm db:migrate` requires `JARVIS_MIGRATIONS_DATABASE_URL` and never falls back to
  `DATABASE_URL`.
- `JARVIS_TEST_DATABASE_URL` and `JARVIS_TEST_DATABASE_SECONDARY_URL` are the only accepted
  primary and secondary URLs for database integration tests. `pnpm test:db` requires both so its
  real concurrency coverage cannot silently skip; the ordinary provider-free test suite may skip
  the gated integration file when no test database is configured.
- Use forward expand/contract migrations for populated environments. The initial migration is only
  safely reversible on an empty disposable database.
