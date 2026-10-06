---
title: "ADR: External agent runtimes are workers, not JARVIS Core"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# External agent runtimes are workers, not JARVIS Core

Status: Accepted

Date: 2026-09-25

## Context
Hermes, OpenJarvis, OpenClaw, Codex, Claude Code, and future runtimes provide useful loops/tools but each has its own memory/state semantics.

## Decision
External runtimes may execute bounded JARVIS agent jobs. They never become the canonical Brain, owner memory, permission system, or state store.

## Consequences
Runtimes are replaceable. Worker-local memory is disposable unless promoted through Core. Capabilities are scoped per job.

## Verification
Killing/replacing a worker cannot erase canonical JARVIS state or change authority.
