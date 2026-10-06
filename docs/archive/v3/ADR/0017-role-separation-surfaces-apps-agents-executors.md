---
title: "ADR: Separate surfaces, domain apps, agents, and executors"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# Separate surfaces, domain apps, agents, and executors

Status: Accepted

Date: 2026-09-25

## Context
External JARVIS demos often blur UI, agent, tool, and memory into one process. That would make authority and continuity fragile.

## Decision
JARVIS uses explicit roles:
- surfaces interact,
- domain apps own detailed domain data,
- agents perform bounded specialist reasoning/work,
- executors perform side effects,
- connectors translate external systems,
- Core coordinates all of them.

## Consequences
A new browser, voice UI, agent runtime, or device does not become a second JARVIS. Capabilities and credentials remain least-privilege.

## Verification
Architecture/code reviews identify the role of every new component and reject boundary violations.
