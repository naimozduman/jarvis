# Phase 3 progress: WhatsApp and Evolution transport

Status: provider-free implementation and verification complete; Phase 3 is **not closed for
production** because the Evolution version/digest security gate remains intentionally unresolved.
Nothing has been deployed, paired, committed, or pushed.

## What Phase 3 adds

- A provider-neutral `MessagingTransport` contract and canonical normalized transport events.
- Dedicated `@jarvis/integrations-evolution` adapter: HTTP client, strict webhook parser/verifier, sender resolver, message/outbound mapper, connection control, health, and error classifier.
- A fail-closed Evolution/Baileys gate that blocks vulnerable `7.0.0-rc.1` through `rc.11`, stable Evolution `2.3.7`, `2.4.0-rc2`, `latest`, and floating production branches.
- Owner-only authenticated webhook ingress at `POST /webhooks/evolution`; it persists/enqueues quickly and performs no model or send work in-request.
- Canonical connection/rejection/outbound/media-metadata tables and migrations; Evolution session/database state remains outside JARVIS PostgreSQL.
- Lease-protected durable outbound delivery jobs, status/reconciliation behavior, and generic proactive reminder transport.
- Provider-free mock Evolution tests covering owner text, replay, LID, rejected traffic, spoofing fixtures, media metadata, connection changes, outbound success/retry/timeout, pairing boundary, and no-live-provider CI.

## Security conclusion

No known safe stable Evolution release was selected. The sole reviewed contingency is the exact non-production source commit `e273b904d53f5726970fd6a244ed9caa61dfeb9a` with Baileys `7.0.0-rc13`, subject to an immutable image digest and the operational gate. The repository intentionally leaves production enablement and real pairing unresolved rather than silently falling back to vulnerable `2.3.7`/`rc9`.

## Still deliberately out of scope

No real WhatsApp pairing, provider credential, Evolution deployment, Railway deployment, Telegram production adapter, Gmail, Calendar, finance, health, native iOS, public signup, third-party messaging, or Phase 4 UI is included.

## Verification record

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`,
  `pnpm bundle:validate`, `pnpm secrets:check`, and `pnpm run ci`: passed.
- `pnpm test`: 95 passed, 1 intentionally skipped (96 total).
- `pnpm brain:evals`: 49 passed.
- `pnpm transport:evals`: 9 passed.
- Bundle and secret validation inspected 322 working-tree files.
- `pnpm audit --prod`: no known published dependency vulnerabilities.
- `pnpm db:check`: the ordinary wrapper remains intact but encounters managed-Windows/libuv
  `uv_os_get_passwd` `ENOMEM`. The documented process-local identity workaround invoked the exact
  same Drizzle schema check and passed with `Everything's fine`; no schema validation or application
  behavior was weakened to accommodate the local tooling defect.
