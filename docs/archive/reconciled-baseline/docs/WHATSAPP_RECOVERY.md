# WhatsApp pairing, recovery, and session handling

## Pairing boundary

`EvolutionConnectionService` exposes backend-only control methods for a future authenticated owner admin UI: create dedicated instance, request pairing state/QR, reconnect, logout, and remove the Evolution session. None is invoked by API/worker startup, a webhook, a model, or a test against a real provider.

QR/pairing output is sensitive. It is returned only as an ephemeral in-memory value with a 60-second display expiry. A future UI must require owner/admin authentication, use `Cache-Control: no-store`, avoid analytics/screenshot capture, and discard it after rendering. It must never place QR data in JARVIS database tables, audit metadata, model context, logs, support tickets, or Git.

## Disconnection and recovery

1. Record a normalized connection state/audit event.
2. Leave canonical messages, reminders, commitments, memory, plans, and Brain decisions untouched.
3. Retain outbound delivery intents. The durable worker waits/retries only according to policy.
4. Diagnose health: configured, version verified, reachable, authenticated, connected, or degraded.
5. If session loss requires it, use the authenticated control boundary to logout/remove and then create/re-pair the dedicated JARVIS instance after the version gate passes.
6. Reconcile provider delivery status before retrying any timeout-marked delivery.

Evolution's session directory/database/cache remain separate from Neon. Deleting an Evolution service or volume is a transport recovery event, not a JARVIS data-loss operation.

## Session storage

Treat Baileys authentication files as high-value credentials. Use Evolution-specific persistent storage with restricted service access, encryption/backup controls appropriate to Railway, and no public browsing. Do not mount the session directory into JARVIS API/worker containers. Rotate the Evolution API key and webhook signing material through a secret manager during incident recovery.
