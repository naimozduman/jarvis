---
title: "ADR: Non-forgeable approval resolution"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# Non-forgeable approval resolution

Status: Accepted

Date: 2026-09-25

## Context
A model must not be able to approve its own action by emitting an argument such as `confirmed=true`.

## Decision
Approval is server-side trusted state bound to an exact action snapshot. Only a trusted owner-facing resolver changes approval state.

## Consequences
Executors reload policy/approval immediately before side effects. Edits create new action snapshots. Approval records are per action and concurrency-safe.

## Verification
Tests prove model output alone cannot change approval state and altered payloads invalidate prior approval.
