# ADR 0008 — Stateless model runtime with PostgreSQL continuity

## Status

Accepted

## Context

Phase 2 introduces optional model reasoning, but an LLM conversation transcript is not an auditable durable operating system. Provider-hosted conversation state would blur retention, privacy, replay, and ownership boundaries.

## Decision

Use a provider-neutral `ModelGateway`. The OpenAI Responses adapter uses strict Structured Outputs with `store: false`, one-turn context, no Conversation, no `previous_response_id`, and no hosted tools. PostgreSQL owns messages, context manifests, decisions, memory, plans, and history.

## Consequences

Provider-free tests remain deterministic. Context is explicit and reproducible. Provider failure cannot mutate canonical state. Requests may lose provider-side convenience features, but JARVIS retains its own durable privacy and audit boundary.
