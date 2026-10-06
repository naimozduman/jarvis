---
title: "WhatsApp Recovery"
document_id: "docs::WHATSAPP_RECOVERY"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Recovery principle

Repair the channel without altering canonical JARVIS state.

## Connection loss

1. mark transport degraded/disconnected,
2. keep canonical deliveries/reminders intact,
3. stop requesting private delivery content while bridge/provider is unavailable,
4. restore local Evolution/bridge,
5. recheck version gate and identity,
6. reconnect/re-pair if required,
7. resume opaque signals,
8. let Neon freshness decide eligibility.

## Do not

- mark unsent work completed,
- resend uncertain sends blindly,
- recreate conversations as a new JARVIS identity,
- bypass owner identity to “get it working,”
- pair the primary personal account.

## Uncertain send

If the provider call may have started, require reconciliation before another send.

## Session loss

Evolution session loss means transport credentials were lost. JARVIS Core memory/commitments remain unaffected.

## Pairing evidence

Keep sensitive pairing artifacts local and transient. Record only safe operational status in Core.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

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
