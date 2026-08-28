# ADR 0002: Treat Evolution API as a replaceable WhatsApp transport

Status: Accepted with operational risk

Date: 2026-08-23

## Context

The product should live inside WhatsApp. Evolution API supports a Baileys-based WhatsApp Web connection and the official WhatsApp Cloud API. The private single-user experience needs proactive messages and a normal contact-like conversation. The Baileys route is unofficial and has reported reliability and identifier edge cases.

## Decision

- Use a dedicated JARVIS phone number.
- Run Evolution API as a single-replica transport service.
- Pin one tested stable image digest. Never deploy `latest` or a release candidate to production.
- Store the WhatsApp session on a Railway volume.
- Use a separate Evolution Postgres database.
- Put all inbound events through JARVIS normalization, deduplication, and reconciliation.
- Keep web chat and Telegram as fallback channels.
- Never store permanent memory inside Evolution API.

## Consequences

- WhatsApp provides the preferred V1 interface.
- A transport ban, disconnect, or corrupted session does not erase the JARVIS brain.
- The product needs connection monitoring, re-pairing instructions, message reconciliation, and channel failover.
