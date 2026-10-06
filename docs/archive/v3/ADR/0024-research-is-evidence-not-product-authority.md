---
title: "ADR: External research is evidence, not product authority"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# External research is evidence, not product authority

Status: Accepted

Date: 2026-09-25

## Context
JARVIS design now includes extensive analysis of external builds, repos, videos, and frameworks. Copying attractive research directly into requirements would make architecture unstable.

## Decision
Research is kept in reference documents. A research idea changes JARVIS only after reconciliation with the PRD, security, implementation, and an ADR when structural.

## Consequences
Creator claims, scorecards, and demo aesthetics cannot silently become requirements. Research remains valuable and traceable.

## Verification
Active docs cite/promote selected concepts explicitly while `docs/research/` remains non-normative.
