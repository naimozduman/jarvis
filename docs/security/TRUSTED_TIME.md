---
title: "Trusted time and expiry boundaries"
document_id: "DOCS_TRUSTED_TIME"
status: "active"
authority_class: "protected"
owner_role: "backend_implementer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Trusted time and expiry boundaries

## Authority

Authorization uses the trusted verifier clock for repository signatures and the canonical server/database clock for runtime approvals, leases, deadlines and reservations. Device timestamps describe observations. They never extend authorization. UTC instants and the owner's IANA timezone have different roles: store instants, retain timezone semantics for schedules, and convert only at presentation and scheduling boundaries.

`trusted_time.py` supplies reference boundary tests for timezone-aware expiry and uncertainty. It does not synchronize clocks or certify database time. Real runtime enforcement requires measured clock health and actual-path tests.

## Runtime database rule

Acquire the relevant row/advisory lock, then capture database `clock_timestamp()` and validate current state, epoch and expiry inside the same authorization transaction. PostgreSQL `now()`/`CURRENT_TIMESTAMP` represent transaction start; they are not a substitute for fresh wall time after a long lock wait. Validate again at the executor dispatch boundary using a short-lived authorization. Do not hold the database lock across network calls.

An authorization transaction commits dispatch intent, operation identity and a finite dispatch permission. The executor checks permission/kill state immediately before its bounded effect. Failure between check and side effect remains a documented race requiring provider controls, bounded lifetimes and reconciliation. No software timestamp removes the external system's own behavior.

## Time windows

Use half-open validity: valid_from <= now < expires_at. Equality with expiry is expired. Reject naive timestamps, nonfinite durations, impossible ordering and excessive future issuance. Treat an approved source's clock uncertainty conservatively: authorization must remain valid across the accepted uncertainty interval. If clock health is unknown, stop new high-impact admission and continue safe inspection/reconciliation.

Use monotonic process time for local elapsed deadlines and watchdogs. Do not serialize monotonic counters across process restarts as UTC time. A restarted process reconstructs deadlines from canonical instants and revalidates authority.

## Restore and schedule changes

A restore epoch invalidates old permissions regardless of their wall-clock expiry. DST and timezone changes create new schedule revisions, not new identities for already sent messages. A device clock change does not revive old offline events as commands; preserve occurred_at, received_at and source revision separately.

## Tests

Include exact-expiry, future-issued, negative interval, missing timezone, drift in both directions, lock wait crossing expiry, process restart, daylight-saving repeated/skipped local times and delayed mobile ingress. Do not label a Python timestamp test as proof of PostgreSQL locking behavior.

Primary source: PostgreSQL current date/time functions documentation, especially transaction_timestamp versus clock_timestamp, recorded in the research source registry.
