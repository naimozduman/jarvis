# JARVIS

JARVIS is the private, single-owner Personal Operating System: one canonical Core for conversation, approved goals, memory, commitments, plans, personal history and bounded action. Models, surfaces, domain apps, connectors and workers have explicit responsibilities and share the Core rather than independent owner truths.

This repository at C:/Users/localhost/JARVIS_RECONCILIATION_2026-10-05/jarvis is the canonical Jarvis source and documentation repository after the V2 + GitHub main + R1 reconciliation and the October 5, 2026 V5 absorption. The complete source-accounting and preservation evidence is in [the V5 reconciliation report](docs/missions/V5_RECONCILIATION_REPORT.md). Linux executable validation is the next gate; release readiness remains pending.

## Authority

The owner's current explicit instructions control. V5 wins newer product intent and architecture. Existing reconciled implementation wins for working behavior unless V5 explicitly supersedes it. Later scoped owner decisions and source-backed technical detail remain relevant. Accepted ADRs retain their documented scope; V5 proposals remain proposals. Specification, source presence, historical test evidence and current validation are separate facts.

The structured product owner is [PRODUCT_SPEC](governance/PRODUCT_SPEC.json); its single generated human view is [JARVIS_PRD_V5](docs/product/JARVIS_PRD_V5.md). [Decisions](docs/product/DECISIONS.md) explains each conflict and its resolution. [The current index](docs/INDEX.md) gives subsystem owners. Old entry paths contain navigation pointers; archived documents preserve history and have no competing current authority.

## Current architecture and source

The current architecture retains a stateless Vercel API, canonical Neon/PostgreSQL state, opaque Convex wakeups and separately scoped transport/executor processes. Domain apps retain detailed records and expose narrow service APIs. One canonical scheduler/job lifecycle owns generations, leases, attempts and outcomes.

The reconciled source includes Telegram owner conversations and requested reminders, dedicated official WhatsApp Cloud normalized intake and gated owner conversation/delivery, the retained Evolution/local bridge, full serialized text/JSON request admission, server-materialized planning/actions, owner feedback and explicit baseline review, and protected read-only integrations with Our Hours, Growth Stats and Iron & Intervals. [CURRENT_IMPLEMENTATION](docs/architecture/CURRENT_IMPLEMENTATION.md) distinguishes these modules from unverified enablement and unimplemented V5 targets.

V5 stages Android companion functionality before launcher/default-assistant roles. Council/Boardroom is optional presentation over bounded workers. Finance remains read-only. Relationship/intimate communication remains draft-only in the baseline. First-party owner access and independent stop inspection, stronger approvals/kill controls, atomic aggregate resource reservations and broad crash recovery remain explicit gaps.

## Next session

Read [CODEX_START_HERE](CODEX_START_HERE.md), [AGENTS](AGENTS.md), the relevant owning documents and [Linux validation](DEFERRED_VALIDATION.md). Validate this exact candidate with synthetic fixtures and disposable databases. V5 trust enrollment, provider activation, deployment and the separate Odysseus/controller discussion are separate later work.
