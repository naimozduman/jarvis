# Architecture decision index

This index navigates accepted technical history and its scope. It does not replace an ADR,
grant production authority or report executable validation of the reconciliation candidate.
Product intent begins at [the canonical startup document](../JARVIS/CODEX_START_HERE.md).
Read [the documentation map](../../CANONICAL_DOCUMENTATION_MAP.md) and
[deferred validation](../../DEFERRED_VALIDATION.md) for the October 5, 2026 candidate.

Accepted ADR bodies and original filenames are retained. Two independently accepted decisions
used number 0016 in divergent histories. References must include their full slug; their coexistence
does not supersede either decision. The OIDC/recovery decision comes through C7 and GitHub main;
request admission comes from preserved R1. Later changes must supersede explicitly rather than
rewrite either accepted record.

| ADR | Recorded status | Scope / implication |
| --- | --- | --- |
| [0001 — split Vercel, Railway, and Neon](0001-stack.md) | Superseded in Phase 3.6 | Historical staging rationale; the Railway runtime portion is superseded by ADR 0012. |
| [0002 — Evolution as a replaceable transport](0002-evolution-transport.md) | Accepted with operational risk | Historical Evolution boundary; current transport direction and separate enablement gates live in the current canonical index and current source. |
| [0003 — one runtime orchestrator](0003-single-orchestrator.md) | Accepted | Original orchestration boundary; read alongside later Brain/job decisions and current source. |
| [0004 — finance remains read-only](0004-read-only-finance.md) | Accepted | No present finance-write authority; future product direction does not grant money movement. |
| [0005 — data-first phase sequence](0005-phase-sequence.md) | Accepted | Historical Phase 0–6 build sequence; current product roadmap remains separate from proof of implementation. |
| [0006 — contracts boundary](0006-contracts-boundary.md) | Accepted | `@jarvis/contracts` owns public runtime contracts; `@jarvis/schemas` is a compatibility shim. |
| [0007 — Postgres durable jobs](0007-postgres-durable-jobs.md) | Accepted | Canonical durable jobs; read later stateless/generation decisions for current execution boundaries. |
| [0008 — stateless model runtime](0008-stateless-model-runtime.md) | Accepted | PostgreSQL owns continuity; hosted response/conversation storage is disabled. |
| [0009 — brain action intent boundary](0009-brain-action-intent-boundary.md) | Accepted | Typed model intent must pass policy, approval, audit and canonical persistence. |
| [0010 — deterministic context and memory](0010-deterministic-context-and-epistemic-memory.md) | Accepted | Manifest-backed context, hypothesis separation and constitutional boundaries. |
| [0011 — Evolution version gate and owner-only transport](0011-evolution-version-gate-and-owner-only-transport.md) | Accepted | Retained Evolution version/identity/outbox restrictions within that transport's scope. |
| [0012 — zero-cost stateless runtime](0012-zero-cost-stateless-runtime.md) | Accepted | Stateless Vercel, opaque Convex orchestration, canonical Neon; Railway staging superseded. |
| [0013 — opaque Convex and local bridge boundary](0013-opaque-convex-local-bridge.md) | Accepted | Private payloads stay outside Convex; authenticated bridge leases rehydrate from Neon. |
| [0014 — canonical delivery leases and expiry](0014-canonical-delivery-leases-and-expiry.md) | Accepted | Canonical freshness, leases, retry and terminal/reconciliation states. |
| [0015 — canonical job generation and expiry](0015-canonical-job-generation-and-expiry.md) | Accepted | Generation fences stale dispatch; explicit deadlines govern latest start. |
| [0016 — request-scoped Vercel OIDC and bounded recovery](0016-request-scoped-vercel-oidc-and-bounded-recovery.md) | Accepted, 2026-09-23; C7/main | Invocation-local OIDC; recovery is one fixed pre-authorized historical staging target. |
| [0016 — provider-neutral request admission](0016-provider-neutral-request-admission.md) | Accepted, 2026-09-29; R1 | Separate dynamic context, provider capacity and conservative spend admission. |
| [0017 — implicit anchors and model output bounds](0017-implicit-anchor-preservation-and-model-output-bounds.md) | Accepted as recorded in ADR; R1 | Preserve existing anchors and enforce model-output accounting bounds. |
| [0018 — flexible-only model replan](0018-flexible-only-model-replan-contract.md) | Accepted as recorded in ADR; R1 | Model replan edits flexible work without replacing hard external commitments. |
| [0019 — operation-oriented planning](0019-operation-oriented-planning-interface.md) | Accepted as recorded in ADR; R1 | Plan operations reference canonical objects and preserve deterministic materialization. |
| [0020 — server-materialized operation actions](0020-server-materialized-operation-actions.md) | Accepted as recorded in ADR; R1 | Server materializes reviewed operation intent into canonical actions. |
| [0021 — deterministic casual chat reasoning](0021-deterministic-casual-chat-reasoning.md) | Accepted as recorded in ADR; R1 | Bounded casual-chat routing within canonical conversation and cost controls. |
| [0022 — server-materialized requested reminders](0022-server-materialized-requested-reminders.md) | Accepted as recorded in ADR; R1 | Requested reminders reuse canonical policy, jobs and delivery authority. |
| [0023 — owner-authored baseline review](0023-owner-authored-baseline-review.md) | Implemented within existing owner-review boundaries, as recorded in ADR; R1 | Explicit owner review and scoped context reuse onboarding, memory, constitution and commitments. |

## Package glossary

- `@jarvis/contracts` owns provider-neutral Zod contracts and inferred public types.
- `@jarvis/schemas` is a compatibility re-export and owns no divergent contracts.
- `@jarvis/domain` contains deterministic domain primitives and interfaces.
- `@jarvis/brain` owns reasoning orchestration, prompt modules, context assembly and model gateways.
  It cannot bypass database, policy, approval or audit boundaries.
- `@jarvis/integrations` owns narrow service clients and provider-neutral connector boundaries.
- `@jarvis/integrations-evolution` retains Evolution-specific transport boundaries and has no
  canonical database or Brain import.
- Canonical private state resides in PostgreSQL/Neon; Convex receives opaque orchestration metadata.

## Candidate and operational boundaries

Earlier Phase 1 statements that all providers were disabled are historical scope statements.
The candidate contains later Telegram, dedicated WhatsApp Cloud and personal-system integrations.
Source presence, prior release reports, configuration and live enablement are distinct evidence.
The reconciliation did not query providers or change enablement. Read the current source and dated
handoff before drawing a present runtime conclusion, and complete Ubuntu validation before release.

Object retention, production key custody, recovery, provider eligibility and connector permissions
retain their documented unresolved gates. The separate V5 pack does not assign status or governance
to these ADRs. One-off recovery and fixed migration procedures remain historical operational
material, requiring a separately reviewed target and explicit release authority before any reuse.

## V5 documentation absorption and proposals

[Current product decisions](../product/DECISIONS.md) records the owner-authorized documentation supersession. All original numbered ADR bodies/filenames are preserved. Imported V5 proposals do not receive repository numbers or acceptance by this import.

- [V5-001](proposals/v5/v5-001.md)
- [V5-002](proposals/v5/v5-002.md)
- [V5-003](proposals/v5/v5-003.md)
- [V5-004](proposals/v5/v5-004.md)
- [V5-005](proposals/v5/v5-005.md)
- [V5-006](proposals/v5/v5-006.md)
- [V5-007](proposals/v5/v5-007.md)
- [V5-008](proposals/v5/v5-008.md)
- [V5-009](proposals/v5/v5-009.md)
- [V5-010](proposals/v5/v5-010.md)
- [V5-011](proposals/v5/v5-011.md)
- [V5-012](proposals/v5/v5-012.md)
- [V5-013](proposals/v5/v5-013.md)
- [V5-014](proposals/v5/v5-014.md)
