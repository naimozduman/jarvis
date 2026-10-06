# Audit model

## Append-oriented record

`jarvis.audit_events` is the durable audit ledger for meaningful JARVIS mutations. The initial
migration creates a PostgreSQL trigger that rejects `UPDATE` and `DELETE` on this table. Corrections
are represented by a new, linked audit event rather than rewriting history.

Each record has:

- owner, actor type, optional actor ID, action, target type and target ID;
- occurrence time, correlation ID, optional causation ID, source, and reason;
- previous/resulting state references containing identifiers, version, and/or content hash rather
  than raw private records; and
- structured metadata after sensitive-field redaction.

## Recorded Phase 1 mutations

The canonical pipeline records event receipt, job queueing, processing start/finish or ignore,
deterministic handler proposals, policy evaluation, approval requests, policy denial, and completed
internal action effects. Commitment status history, action execution/result rows, and job records
provide the linked operational details. All audit writes are inside the transaction that establishes
the related state transition.

## Privacy rules

The safe-audit helper recursively redacts fields classified as secret, credential, token,
authorization, message body, finance, health, or sensitive metadata. Audit payloads must not contain
raw OAuth tokens, provider credentials, full messages/emails, attachment data, health samples,
financial data, or model prompts. The same rules apply to logs, errors, fixtures, and commits.

Audit access is owner-scoped. A future viewer may inspect the ledger but may not mutate it, and
external providers never receive a direct audit-write bypass.
