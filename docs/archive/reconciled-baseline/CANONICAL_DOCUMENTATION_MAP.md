# Canonical documentation map — reconciliation, 2026-10-05

The repository now has one current reading order. It retains R1's `docs/JARVIS/` product-intent
hierarchy, main's later personal-system integration and C7 technical history. Current source,
accepted decisions, prior reports and future requirements have distinct evidentiary roles.
This candidate has received safe Git and static checks only. Executable validation remains in
[DEFERRED_VALIDATION.md](DEFERRED_VALIDATION.md); no deployment or production query occurred here.

## Current reading order

1. [README.md](README.md) and [CODEX_START_HERE.md](CODEX_START_HERE.md): repository identity,
   reconciliation scope and entry point.
2. [docs/JARVIS/CODEX_START_HERE.md](docs/JARVIS/CODEX_START_HERE.md): current product-intent
   authority and conflict-resolution rules. [AGENTS.md](AGENTS.md) supplies engineering rules.
3. [JARVIS_MASTER.md](docs/JARVIS/JARVIS_MASTER.md), then
   [DECISIONS.md](docs/JARVIS/DECISIONS.md): overview, confirmed intent and supersession.
4. [PRD.md](docs/JARVIS/PRD.md) and [ARCHITECTURE.md](docs/JARVIS/ARCHITECTURE.md): outcomes and
   logical component contracts. A future requirement does not prove an implemented capability.
5. [IMPLEMENTATION_STATUS.md](docs/JARVIS/IMPLEMENTATION_STATUS.md),
   [CURRENT_IMPLEMENTATION_HANDOFF.md](CURRENT_IMPLEMENTATION_HANDOFF.md) and
   [RECONCILIATION_REPORT.md](RECONCILIATION_REPORT.md): candidate source and dated prior evidence.
6. Relevant subsystem documents below, their
   [REQUIREMENTS_LEDGER.md](docs/JARVIS/REQUIREMENTS_LEDGER.md) entries and
   [OPEN_QUESTIONS.md](docs/JARVIS/OPEN_QUESTIONS.md), followed by current source, tests, migrations
   and the relevant slug-qualified [ADR](docs/ADR/index.md).
7. Historical PRDs, build plans, operational procedures and prompts only as needed for provenance
   or implementation context, after the current reading order.

Read [SECURITY_PRIVACY_AND_PERMISSIONS.md](docs/JARVIS/SECURITY_PRIVACY_AND_PERMISSIONS.md) and
[AI_ROUTER_AND_COSTS.md](docs/JARVIS/AI_ROUTER_AND_COSTS.md) before modifying authority, data access,
execution, model calls or agents. Direct owner instructions control the current task. Accepted
technical history remains scoped; a proposal, old command or deployment ID creates no new grant.

## Current subsystem owners

| Area | Product-intent document | Candidate implementation evidence |
| --- | --- | --- |
| Personal core / durable context | [CONTEXT_AND_MEMORY](docs/JARVIS/CONTEXT_AND_MEMORY.md) | `packages/brain/src/context`, memory/onboarding/constitution services and `packages/database/src` |
| Runtime / routing / data | [ARCHITECTURE](docs/JARVIS/ARCHITECTURE.md) | `apps/api/src/http-app.ts`, Vercel/runtime composition, canonical repositories, migrations and retained C7 tests |
| Models / cost / prompts | [AI_ROUTER_AND_COSTS](docs/JARVIS/AI_ROUTER_AND_COSTS.md) | `packages/brain/src/model`, `packages/brain/src/prompts`, `prompts/runtime`, admission tests and model-runtime contracts |
| Messaging / Telegram / Cloud | [MESSAGING_AND_HANDOFF](docs/JARVIS/MESSAGING_AND_HANDOFF.md) | Telegram modules, dedicated Cloud bridge/ingest modules, canonical conversation/delivery services and transport tests |
| Reminders / daily use / bootstrap | [AUTOMATION_AND_CASES](docs/JARVIS/AUTOMATION_AND_CASES.md) | Requested-reminder final-send checks, owner-feedback/baseline modules and dated October progress/evidence files |
| Personal-system services | [INTEGRATIONS](docs/INTEGRATIONS.md) and [ARCHITECTURE](docs/JARVIS/ARCHITECTURE.md) | Main's personal-system routes/client/access repository and corresponding tests; narrow source-owned service APIs |
| Home / device / voice | [JARVIS_HOME](docs/JARVIS/JARVIS_HOME.md), [VOICE_AND_DEVICE_CONTROL](docs/JARVIS/VOICE_AND_DEVICE_CONTROL.md) | Requirements and future prototypes; this reconciliation does not implement an Android launcher or device enrollment |
| Passive context | [PASSIVE_CONTEXT_ENGINE](docs/JARVIS/PASSIVE_CONTEXT_ENGINE.md) | Future permission-scoped evidence fusion; source presence elsewhere does not prove continuous capture |
| Council / Boardroom | [COUNCIL_AND_BOARDROOM](docs/JARVIS/COUNCIL_AND_BOARDROOM.md) | Phased requirements; no autonomous controller or V5 integration adopted here |
| Roadmap / unresolved product gates | [ROADMAP](docs/JARVIS/ROADMAP.md), [OPEN_QUESTIONS](docs/JARVIS/OPEN_QUESTIONS.md) | Requirements and decisions, not test completion |
| Owner style | [OWNER_CONVERSATIONAL_STYLE_PROFILE](docs/JARVIS/OWNER_CONVERSATIONAL_STYLE_PROFILE.md) | Scoped presentation intent and current conversation tests |
| Reconstruction provenance | [SOURCE_INVENTORY](docs/JARVIS/SOURCE_INVENTORY.md), [VALIDATION_AND_COVERAGE](docs/JARVIS/VALIDATION_AND_COVERAGE.md) | September 10 reconstruction methodology and dated coverage; not current runtime validation |

The current hierarchy contains 22 Markdown documents. The older 21-document count in reconstruction
coverage remains dated evidence; the owner style profile was added later. Raw private chat exports
are not imported into this candidate.

## Technical decisions and ADR identity

[docs/ADR/index.md](docs/ADR/index.md) indexes the retained original records. Accepted ADR bodies
and filenames are preserved; later decisions must supersede explicitly. Number 0016 collided
between histories:

| Unambiguous identity | Provenance | Scope |
| --- | --- | --- |
| `0016-request-scoped-vercel-oidc-and-bounded-recovery` | C7/main; accepted 2026-09-23 | Request-local OIDC and one exact historical recovery target |
| `0016-provider-neutral-request-admission` | R1; accepted 2026-09-29 | Independent context-selection, provider-capacity and conservative spend admission |

Never refer to either as “ADR 0016” without its slug. Both invariants can coexist. Preserving an
accepted recovery record does not authorize rerunning its one-off operation. ADR 0023 records
implementation within existing review boundaries; the index preserves that status instead of
inventing a new acceptance.

## Historical material retained with labels

| Material | Role and current interpretation |
| --- | --- |
| `docs/PRD.md`, `JARVIS_PRD.docx`, `JARVIS_PRD.pdf` | Original V1 foundation/build-kit requirements; subordinate to current decisions and scoped ADR history |
| `PRD_V2_PERSONAL_OS.md`, `JARVIS_PRD_V2_Personal_OS.docx`, `JARVIS_PRD_V2_Personal_OS.pdf`, `JARVIS_V2_MASTER_CONTEXT.md`, `OPEN_DECISIONS_AND_QUESTIONNAIRE.md` | Historical owner-review V2 proposal/source family; retained separately from canonical docs/JARVIS and V5 |
| `CODEX_DOCUMENTATION_ONLY_PROMPT.md` | Historical proposed V2 import; its nonexistent target paths and proposed ADR numbering are not startup authority |
| `BUILD_ORDER.md`, `docs/BUILD_PLAN.md`, older architecture/deployment documents | Historical build sequence and hosting context; dated labels prevent obsolete stop gates or topology from becoming current instructions |
| `prompts/codex/*.md` | Original staged implementation prompts, individually labeled historical; do not run them as a new build sequence |
| `.agents/skills/deploy-railway-vercel/SKILL.md` | Historical Railway/Evolution and web-only Vercel procedure, explicitly scoped; current hosting requires current source/ADR review |
| `docs/progress/*` and lower dated handoff/status sections | Prior implementation/test/deployment reports retained with their original dates and limits; no new cloud verification implied |
| `docs/STAGING_MIGRATION_WORKFLOW.md`, fixed release/rehearsal scripts/workflows | C7 operational history for fixed application `940ab61` and migrations through 0008; not a release plan for the current candidate |
| Fixed C7 staging harness / recovery source and tests | Retained safeguards and operational evidence; any future execution needs an isolated validation plan and the documented synthetic target conditions |
| `docs/archive/INDEX.md` | Historical archive-migration placeholder; files were not silently moved or deleted to satisfy it |
| `documentation-reconciliation.patch` | Retired stale proposal artifact; exact input remains in preserved R1, superseded by the reviewed current documentation edits |

`prompts/runtime` and `packages/brain/src/prompts` remain implementation inputs; they are reviewed
with source/tests and cannot override canonical authority or deterministic security boundaries.
The product-rules skill and architecture-planner agent now follow the current reading order.

## Separate projects and unreconciled future product decisions

V5 remains a separate specification/governance candidate beside JARVIS. Its generated PRD,
governance, policies, trust enrollment, M00/M01 proposals and migration contracts are not adopted.
Jarvis Zero remains a separate controller. Monthly-bills-hosting remains an independent proxy
branch; see [REMOTE_BRANCH_DISPOSITIONS.md](REMOTE_BRANCH_DISPOSITIONS.md).

Existing product open questions remain explicit in `docs/JARVIS/OPEN_QUESTIONS.md`. Their existence
does not make source reconciliation a runtime test result. The candidate retains current narrow
authority and requires Linux validation before a deployment decision.
