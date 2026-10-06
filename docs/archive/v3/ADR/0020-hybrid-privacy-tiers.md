---
title: "ADR: Hybrid local/cloud privacy tiers"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# Hybrid local/cloud privacy tiers

Status: Accepted

Date: 2026-09-25

## Context
Fully local operation sacrifices capability in some tasks, while sending all raw personal context to cloud services creates unnecessary exposure.

## Decision
Use data-locality tiers. Prefer local capture/filtering and storage for sensitive/high-volume data, with hosted reasoning over minimum necessary retrieved context when it provides material value.

## Consequences
“Local-first” is a privacy strategy, not a purity requirement. Each source records locality/retention policy.

## Verification
Sensitive source tests show raw content does not leave its allowed boundary and model context contains only permitted summaries/references.
