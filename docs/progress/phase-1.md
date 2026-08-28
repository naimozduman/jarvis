# Phase 1 progress — core operating foundation

## Scope completed

Phase 1 implements the provider-neutral internal operating system on which later reasoning and
connectors will depend:

- PostgreSQL-compatible Drizzle schema and reviewed initial migration for identity, conversations,
  events, commitments, reminders, daily plans, actions, approvals, audit, constitution, memory,
  and durable-job boundaries.
- pg-boss durable transport contract, bounded retry classification, queue lifecycle, and optional
  disposable-PostgreSQL test path.
- Canonical event ingress, idempotency, deterministic Phase 1 handlers, policy evaluation,
  internal commitment/reminder effects, approval persistence, and audit flow.
- Owner-scoped authorization, safe redaction/logging primitives, correlation IDs, idempotency and
  constant-time token helpers, encrypted connector-secret storage interface, and a fail-closed
  authentication boundary.
- Honest live/readiness semantics: production fails readiness until database and durable-queue
  verification succeeds; development/test remain provider-free and report uninitialized
  dependencies honestly.

## Explicitly deferred

No WhatsApp/Evolution API, OpenAI, Gmail, Google Calendar, Plaid, WHOOP, Telegram, Poke, Iron &
Intervals, food service, iOS/HealthKit, Hermes, real credential, external message, final web UI,
memory retrieval, embeddings, vector search, conversational brain, or deployment has been added.

## Documentation and decisions

ADR 0005 resolves the canonical phase sequence. ADR 0006 establishes `@jarvis/contracts` as the
shared runtime boundary, and ADR 0007 selects Drizzle with pg-boss. The companion data, event, job,
policy, approval, audit, and authentication documents describe the stable interfaces for later
phases.

## Verification

All standard local gates passed on 2026-08-28: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test` (29 passed, one optional PostgreSQL suite skipped), `pnpm build`,
`pnpm bundle:validate`, `pnpm secrets:check`, and `pnpm run ci`.

`pnpm test:db` correctly skipped because `JARVIS_TEST_DATABASE_URL` is unset; it never uses a
production database. The normal Drizzle generator/check commands encountered the managed Windows
Node `uv_os_get_passwd` defect. A local non-persistent fallback that only supplies the temporary
directory username completed generation of `0001_foamy_blue_shield.sql` and validated the migration
journal successfully. CI on a normal Linux runner uses the ordinary Drizzle commands.

## Exact next phase entry point

Start Phase 2 at the durable `@jarvis/contracts`, `@jarvis/database`, `@jarvis/domain`, and
`@jarvis/security` boundaries. Build the JARVIS brain as a separate package that reads/writes these
canonical records, respects the policy/approval gate, and never makes the LLM conversation the
source of persistent truth.
