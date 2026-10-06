# WhatsApp risk and recovery

## Position

Evolution API makes a private WhatsApp experience practical, but the Baileys route is an unofficial WhatsApp Web integration. It is a convenience channel, not a trusted foundation for permanent state.

## Required isolation

- Dedicated JARVIS phone number.
- Dedicated Evolution instance.
- Separate transport database.
- No bank, health, Google, or master encryption credentials inside Evolution.
- JARVIS data stays in Neon.
- Web and Telegram remain usable during WhatsApp failure.

## Known failure classes

Research in the Evolution repository shows reports of:

- Unique messages marked as duplicates and skipped before webhook delivery.
- Inbound messages visible in WhatsApp but not emitted as `MESSAGES_UPSERT`.
- Instances degrading after several days until restart or reconnection.
- LID identifiers replacing phone-number JIDs in some payloads.
- Webhook configuration differences between versions.
- Redis-related message-cache behavior.
- Release-candidate and licensing changes in the 2.4 line.

These reports do not prove every deployment will fail. They justify engineering for detection and recovery.

## Preventive controls

- Pin a stable release and image digest.
- Do not use `latest`.
- Do not use a release candidate in production.
- Use one replica.
- Test with Redis disabled first.
- Persist accepted webhooks before acknowledgement.
- Keep app-level idempotency.
- Store outbound operation IDs.
- Track provider message IDs and delivery updates.
- Handle both phone and LID identities.
- Run connection and message reconciliation.
- Alert on stale connection state.
- Keep message volume normal and private.

## Recovery runbook

### Connection degraded

1. Pause Evolution outbound jobs.
2. Mark WhatsApp unavailable in channel state.
3. Notify through web and Telegram.
4. Inspect Evolution health and logs.
5. Restart the Evolution service once.
6. Verify session state and send a test message.
7. If still broken, reconnect the dedicated number through QR.
8. Reconcile recent inbound and outbound records.
9. Release queued messages after duplicate checks.

### Upgrade failure

1. Pause sends.
2. Roll back to the previous image digest.
3. Restore Evolution database or volume only if required.
4. Reconnect the dedicated account.
5. Replay unsent outbound operations after checking provider state.

### Account restriction

1. Stop all automation on the affected number.
2. Keep JARVIS running on web and Telegram.
3. Review usage and provider status.
4. Move to a replacement dedicated number only after risk review.
5. Never move the user's primary personal number into the automation.

## Soak test

Before calling WhatsApp production-ready, run at least seven days with:

- Several inbound text turns each day.
- Rapid burst input.
- Proactive messages.
- Voice notes.
- Images.
- Reply threading.
- Service restarts.
- One planned reconnect.
- Redis on and off comparison if Redis is considered.
- Daily comparison between WhatsApp-visible messages and JARVIS ledger.

Record every mismatch.
