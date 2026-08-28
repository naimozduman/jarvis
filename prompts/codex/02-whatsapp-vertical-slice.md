# Phase 2: WhatsApp vertical slice through Evolution API

Use `$evolution-whatsapp`, `$connector-integration`, `$security-and-privacy`, and `$agent-evals`.

Before code, verify the current stable Evolution release, Docker variables, webhook event names, authentication method, storage paths, LID behavior, and upgrade notes. Record the chosen image digest in an ADR amendment. Do not deploy a release candidate.

Implement:

- local Evolution Postgres and optional Redis Compose services
- Evolution connector configuration page
- inbound webhook verification and raw-body capture policy
- payload normalization for text, voice, image, document, reaction, location, edit, delete, delivery state, and connection state
- message identifier normalization with LID support
- durable enqueue and immediate webhook acknowledgment
- idempotent inbound processing
- outbound text adapter and delivery tracking
- channel conversation mapping
- connection health and QR/re-pair state
- web-chat fallback
- synthetic Evolution fixtures

Add one minimal OpenAI response path with strict structured output. Prove inbound WhatsApp to JARVIS to outbound WhatsApp, proactive scheduled outbound, restart persistence, duplicate suppression, reconnect detection, and failed-send recovery.
