# JARVIS V2 Master Context

Historical V2 proposal/source document, retained during the October 5, 2026 reconciliation. The current product-intent hierarchy is `docs/JARVIS/`, reached through `CODEX_START_HERE.md`. Proposed imports, ADR numbers, commands and authority claims here remain historical and do not adopt V5 or authorize a new implementation.

Status date: 2026-09-04

## Product

JARVIS is a private, single-user Personal Operating System for Naim. It acts as an executive assistant, accountability partner, planner, historical memory, voice assistant, and eventually a permissioned executor.

WhatsApp is the first mouth. The web app is the owner control center. Android becomes the first deeply integrated device. All surfaces use one canonical brain, identity, memory, constitution, permission model, and audit history.

## Core behavior

- Behavior changes intervention, not mission.
- No response never means completion.
- Goals survive temporary avoidance.
- Context influences tactics.
- Facts, observations, hypotheses, preferences, and open loops remain distinct.
- Personality changes delivery only.
- JARVIS challenges viable weak excuses without shaming.
- A valid hard override ends ordinary negotiation after one consequence explanation.
- The model proposes structured decisions. Deterministic policy and approval control actions.

## Brain

The Brain already has versioned prompt modules for identity, constitution, memory, accountability, planning, replanning, interventions, reminders, communication style, actions, uncertainty, security, and privacy.

It assembles bounded owner-scoped context, routes to a model, requires strict structured output, validates evidence and actions, persists safe decisions, and remains idempotent.

## Long-term data layers

1. Current world state: expiring context such as location, foreground app, driving, battery, and active event.
2. Life Ledger: evidence-oriented historical events and episodes.
3. Journal: owner reflection.
4. Memory: information important enough to influence future reasoning.

A Life Ledger supports questions such as where the owner was on a date, what summer 2027 was like, what music was played, what projects were active, and what events shaped a period.

## First-party ecosystem

Future first-party clients include Journal, Calendar, Food, Iron & Intervals, Movies, Calculator, Relationship Vault, media history, Android, and voice. They use a shared JARVIS SDK and one canonical data fabric.

## Android and voice

Android adds wake word, streaming speech, TTS, location, Health Connect, notifications, app usage, local blocking, navigation, call-style escalation, offline queue, and device actions. It does not replace the Brain.

Sensitive continuous data should be processed locally when practical. OS permission does not automatically grant JARVIS authority.

## Capabilities and authority

Every device/executor declares typed capabilities. An action requires:

1. OS/provider permission;
2. registered JARVIS capability;
3. owner authorization policy or permission lease;
4. action approval where required.

An Authority Ledger records why every side effect was allowed. Permission leases may be one-time, temporary, activity-bound, project-bound, merchant-bound, or amount-limited. Reversible actions are preferred.

## Operational modes

- JARVIS: default chief of staff.
- FRIDAY: tactical, fast, brief.
- KAREN: mentor/learning mode.
- EDITH: restricted executor mode.

They share one brain and differ in style/context/capability profile.

## Privacy

Data classes include local_only, cloud_allowed, memory_allowed, ephemeral, restricted, and shareable_with_approval. Raw gallery, relationship, call, browsing, and high-frequency sensor data need source-specific controls. The owner can inspect, export, and delete by source and provenance.

## Web control center

Planned owner-only pages:

- Today;
- Chat;
- Brain and constitution;
- Timeline and Journal;
- commitments/plans;
- approvals;
- capabilities/authority;
- devices;
- connectors;
- activity/audit;
- privacy/settings/operations.

Passkey/WebAuthn is preferred. No public signup.

## Executor

Future EDITH capabilities may include browser, APIs/MCP, purchases, bookings, device control, and SSH. The Brain never gets unrestricted tools. Every executor action uses typed capability, authority, approval, idempotency, result verification, audit, and rollback/reconciliation.

Autonomous money transfer and emotional punishment payments are prohibited by default.

## Current implementation state

GitHub permanent checkpoint:

```text
cb2284b8a6854cb8ede29ea82aebe1b5846337f9
feat: prepare JARVIS zero-cost cloud deployment
```

Preferred local repo:

```text
C:\Users\localhost\Jarvis-Phase-3-6-LF-Safe-20260831
```

The local repo has intentionally uncommitted Vercel runtime routing fixes. Do not reset/clean/stash them.

### Neon

- project: jarvis-staging
- project ID: jolly-truth-47196608
- database: neondb
- Free
- migrations through 0006 applied
- runtime role: jarvis_runtime_staging
- pooled Production DATABASE_URL stored in Vercel; never print/retrieve it

### Convex

- development deployment healthy
- HTTP URL: https://determined-retriever-869.convex.site
- opaque scheduling only
- missing Vercel to Convex shared secret

### Vercel

- jarvis-web reserved for future dashboard
- jarvis-api-staging is Fastify API on Hobby
- latest liveness-green deployment: dpl_6pyZzWr1PkN8cuUJTu43CiPk3MB9
- `/api/health/live` returns 200 from serverless Lambda
- readiness currently: configuration pass, database pass, queue fail, model not_configured
- queue fail means Vercel to Convex orchestration settings are missing

### Immediate next step

Create a new strong `JARVIS_VERCEL_TO_CONVEX_SECRET` and store the same value in Convex development and Vercel Production. Add this nonsecret Vercel Production variable:

```text
JARVIS_CONVEX_ORCHESTRATION_URL=https://determined-retriever-869.convex.site
```

Redeploy and verify readiness becomes HTTP 200 with database pass, queue pass, and model not_configured. Stop before callback tests.

### AI

No live Brain inference yet. Zero-cost model routing and budget guards exist. Free-tier candidate models have been catalog-verified but structured output remains unproven.

### WhatsApp

Transport architecture exists. Evolution is disabled. No QR or pairing. Security target must be reverified before use.

## Roadmap

1. complete Vercel to Convex readiness;
2. callback/idempotency tests and runtime checkpoint;
3. first live structured Brain probe;
4. WhatsApp pairing and real use;
5. web control center;
6. Gmail/Calendar;
7. Life Ledger/Journal;
8. capability/authority/device protocol hardening;
9. Android companion and voice;
10. first-party apps;
11. restricted EDITH executor.
