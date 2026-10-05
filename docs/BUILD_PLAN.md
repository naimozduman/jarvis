# Build plan

Historical build-kit document, retained during the October 5, 2026 reconciliation. Its original requirements, phase sequence and commands are dated implementation/history evidence. Start at `CODEX_START_HERE.md` and follow `docs/JARVIS/CODEX_START_HERE.md`; this document cannot override the current reading order or authorize an old migration, recovery, provider connection or deployment.

## Working method

Build one phase at a time. Every phase ends with a running path, tests, an updated ADR set, and a short `docs/progress/<phase>.md` report.

## Phase 0: Bootstrap

Deliverables:

- Private GitHub repository.
- pnpm workspace and Turborepo.
- `apps/web`, `apps/api`, and `apps/worker` skeletons.
- Shared configuration packages.
- CI for lint, typecheck, unit tests, build, and secret scan.
- Environment schema validation.
- Health endpoints.
- Neon development project and migration workflow.
- Railway staging services.
- Vercel web project.

Tests:

- All packages build.
- API and worker boot without provider credentials in test mode.
- Missing required production variables fail at startup.
- No secret-like fixture appears in Git history.

## Phase 1: Core data and operating-system foundation

Deliverables:

- Canonical PostgreSQL schema and reviewed migrations.
- Owner, device, session, trusted-client, and encrypted-secret storage boundaries.
- Conversations, messages, source links, canonical events, commitments, reminders, daily state,
  approvals, actions, audit, constitution, and memory-boundary records.
- Durable pg-boss job transport with a JARVIS lifecycle projection, bounded retries, and safe
  concurrent claim behavior.
- Deterministic provider-neutral event pipeline, policy engine, approval enforcement, and audit
  chain.
- Provider-free authentication abstraction, health/readiness semantics, and optional disposable
  PostgreSQL integration tests.

Exit gate:

Duplicate synthetic delivery creates exactly one canonical event/job/action intent, no high-impact
action executes, and all standard CI checks pass without a database or provider credential.

## Phase 2: Brain, memory, and behavioral engine

Deliverables:

- `@jarvis/brain` as a separate orchestration package with no direct database, provider, or executor authority.
- Versioned prompt modules; deterministic owner-scoped context manifests; typed memory candidates; bounded personality delivery preferences; open loops; overrides; conflicts; onboarding review boundary; interventions; reminders; and live-day planning constraints.
- Provider-neutral model gateway, deterministic fake gateway, optional stateless OpenAI Responses adapter, and configuration-based fast/standard/deep routing with budgets.
- Strict model intent validation and a server-side materializer that verifies context evidence and assigns durable IDs.
- Model reasoning only through the Phase 1 policy, approval, action execution, idempotency, and audit boundaries.

Exit gate:

All Phase 2 invariant cases in `docs/BRAIN_EVALS.md`, core acceptance cases in `docs/EVALS_AND_ACCEPTANCE.md`, and standard provider-free CI gates pass.

## Phase 3: WhatsApp and Evolution API vertical slice

Deliverables:

- Evolution staging deployment, dedicated-number connection, sender allowlist, normalized webhook
  ingress, message reconciliation, and replaceable transport adapter.
- Provider-neutral inbound/outbound event and message handling through the Phase 1 pipeline.
- Connection health, restart recovery, and a Telegram fallback decision/spike.

Reliability tests:

- Duplicate webhook, out-of-order status updates, multi-message bursts, media/caption handling,
  LID identifiers, Evolution and worker restarts, unknown outbound result, and reconnect after
  session loss.

Exit gate:

Seven-day staged soak with no unexplained missing inbound message in the test log.

## Phase 4: Web control center

Deliverables:

- Owner-only web control center for Today, Chat, Brain, Connectors, Approvals, and Activity.
- Web chat mirror and connection-health card using canonical API contracts.
- Approval, audit, commitment, and plan-state views that do not bypass the policy engine.

Exit gate:

The owner can inspect canonical state and approve/reject eligible actions without a web route
becoming an alternate source of truth.

## Phase 5: Gmail and Google Calendar

Deliverables:

- Connector card, self-service Google OAuth, Gmail recent sync and push/reconciliation, email
  triage/extraction, and Calendar read/write/watch/reconciliation.
- Source-linked calendar changes and undo through policy and approval boundaries.

Exit gate:

No duplicate calendar events across webhook replay, full resync, or retry.

## Phase 6: Health, finance, training, nutrition, and additional connectors

Deliverables:

- Plaid account allowlists, read-only finance summaries, balances, liabilities, transfer
  reconciliation, and finance permission tests.
- WHOOP OAuth, signed webhook/reconciliation, health freshness/source handling, and health views.
- Iron & Intervals interface, workout logging, training-plan context, food/nutrition interface, and
  other connector boundaries.

Exit gate:

The codebase contains no finance-write product or endpoint. Health and finance summaries cite
freshness and source.

## Later phases

Native iOS, HealthKit, background delivery, push, share sheet, voice, camera, location, Apple Maps,
Hermes or an equivalent isolated executor, external communication, and release hardening remain
later work. Side-effecting execution remains approval-gated.

## Pull request rule

Each PR should deliver one complete behavior. Avoid broad scaffolding PRs with no observable path. Include:

- Product requirement reference.
- Architecture impact.
- Security impact.
- Test evidence.
- Migration impact.
- Rollback plan.
