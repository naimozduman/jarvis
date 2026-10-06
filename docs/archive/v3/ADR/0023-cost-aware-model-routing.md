---
title: "ADR: Cost-aware model routing supersedes zero-cost as active doctrine"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# Cost-aware model routing supersedes zero-cost as active doctrine

Status: Accepted

Date: 2026-09-25

## Context
Strict zero-cost architecture was useful while bootstrapping, but it can force weaker routes, retries, and engineering complexity even when modest spend would improve reliability.

## Decision
JARVIS uses cost-aware routing with hard budgets and no silent fallback. Model choice weighs capability, privacy, latency, failure risk, owner time, and API spend.

## Consequences
Zero-cost documents remain historical. Spend guards, telemetry, and explicit route configuration remain mandatory.

## Supersedes
Active-doctrine portions of ADR 0012 regarding mandatory zero-cost model execution. ADR 0012 remains historical evidence for the serverless/stateless transition.

## Verification
Routing tests prove budget enforcement and no silent paid fallback.
