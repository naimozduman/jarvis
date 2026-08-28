# ADR 0003: Start with one runtime orchestrator

Status: Accepted

Date: 2026-08-23

## Context

The product spans planning, memory, email, calendar, finance, health, training, and messaging. A large multi-agent runtime would increase latency, cost, state conflicts, and debugging difficulty before core behavior is proven.

## Decision

- Use one production orchestrator for each reasoning cycle.
- Give it strict structured outputs and narrow server-side tools.
- Use deterministic code for policy, scheduling, date math, idempotency, and permissions.
- Route simple extraction to a lower-cost model and difficult replanning to a stronger model.
- Reserve Codex subagents for software development work, not normal JARVIS runtime behavior.
- Add specialist runtime agents only after evaluation evidence shows a clear quality or latency gain.

## Consequences

- One trace explains each decision.
- Memory writes and actions remain easier to validate.
- Specialist prompts still exist as modes used by the orchestrator.
