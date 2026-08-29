# ADR 0009 — Brain emits typed intents, never tools or mutations

## Status

Accepted

## Context

An LLM must be able to help plan and communicate without gaining implicit authority over state, providers, finances, or external messages.

## Decision

Model output is a strict intent envelope. The server checks evidence against the request manifest, assigns durable IDs, maps only recognized action types to minimal typed payloads, persists the proposal, evaluates policy, requests approval when required, and executes allowed internal actions through the existing Domain transaction and audit chain.

## Consequences

Unknown, malformed, mismatched-risk, finance, and external intents cannot become direct effects. A high-impact external-message intent may be persisted for approval, but no Phase 2 external executor exists. New side effects require explicit policy and execution work in a later phase.
