---
title: "Operational health beyond HTTP 200"
document_id: "DOCS_OPERATIONS_HEALTH"
status: "active"
authority_class: "protected"
owner_role: "release_operator"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Operational health beyond HTTP 200

Liveness answers whether the process responds. Readiness answers whether prerequisites for a named operation are available. Product health answers whether useful work completes correctly. Never collapse those into one green badge.

## Required indicators

Track canonical database reachability and transaction errors; oldest eligible job and lease age; callback lag and stale generations; unresolved dispatch outcomes; outbox age by freshness class; unknown-cost reservations and per-job no-progress trips; structured model-output failures; full-request context budget and exclusion reasons; connector coverage/cursor/revocation state; approval backlog and bursts; latest trusted kill and restore evidence; signed-verifier and key-recovery availability.

Each metric definition names unit, scope, numerator/denominator where relevant, aggregation window, source, missing-data behavior and an owner-approved or tested threshold. Missing telemetry is unknown, not zero. Prometheus/vendor implementation is not selected by this document.

## States and alerts

Report healthy, degraded, blocked and unknown by subsystem. A stale connector blocks claims requiring fresh data. A failed writer stop proof blocks new writes in its scope. Preserve inspection and reconciliation. Alerts group related symptoms by incident rather than sending a ping per retry. Alert suppression never marks underlying work complete.

## Freshness and external checks

The independent verification service checks required drill evidence and active writer inventory. Do not depend solely on JARVIS's scheduler to notice that its own stop controls are stale. A paused or unused writer does not require production traffic to generate fake freshness evidence.

## New-control discipline

A new health check must identify a concrete user or safety failure it detects and a response. File count and test count are not health metrics. Reject dashboards that only restate logs without defining who responds or which operation is blocked.

Use `templates/v5/health-check.json` for implementation. Its null thresholds are unanswered policy/calibration inputs, not deployable defaults.
