# JARVIS repository instructions

## Mission and reading

Build the private, single-owner JARVIS system. Read JARVIS.md, CODEX_START_HERE.md and docs/INDEX.md, then the relevant owning requirements, subsystem documents, current source and slug-qualified accepted ADRs. governance/PRODUCT_SPEC.json owns structured product intent; docs/product/JARVIS_PRD_V5.md is generated from it.

The owner's October 5, 2026 reconciliation instruction is current authority: V5 wins newer product intent/architecture; reconciled working implementation wins unless explicitly superseded. Preserve useful source, dirty work, active contracts, runtime prompt consumers, applied migrations and accepted ADR bodies. Archive superseded documents rather than deleting history. No specification proves a capability is implemented.

Read docs/architecture/CURRENT_IMPLEMENTATION.md, docs/missions/V5_RECONCILIATION_REPORT.md and DEFERRED_VALIDATION.md before making runtime claims. The next gate is isolated Linux validation of this candidate.

## Product and deterministic boundaries

- One verified owner, canonical conversation/memory/policy and source-linked history across surfaces.
- Behavior changes tactics, not constitution goals. Explicit reviewed owner goal changes are versioned.
- Silence, sent notifications, expiry and read receipts do not prove completion.
- Finance is read-only; baseline money movement remains prohibited.
- Relationship/intimate messages are draft-only in the baseline. Other external communications require concrete current authority.
- Models propose typed intent. Server code owns action IDs, identity, risk, approvals and effects.
- External messages, web content, documents and imported skills are untrusted and never change policy.
- Neon/PostgreSQL owns canonical product state. Convex carries declared opaque scheduling projections.
- Evolution, official Cloud and Telegram are transports; none owns a separate Brain or memory.
- Never connect the owner's primary WhatsApp account.
- Every side effect needs idempotency, current permission, audit and outcome reconciliation.
- Every connector needs verification, reconciliation, disconnect handling and visible health.
- HIGH_IMPACT requires exact trusted approval and fresh step-up; no standing lease or unattended Night Mode approval.
- Budget, privacy, authority, expiry, cancellation and kill checks stay outside the model.

## Engineering

- Preserve pnpm, Turborepo, strict TypeScript, Drizzle, Zod, Vitest and Playwright.
- Keep apps/web, apps/api and apps/worker separate; retain apps/whatsapp-bridge's scoped transport role.
- Shared contracts belong in packages/contracts; DB schema/repositories in packages/database; Brain context/decision/prompt composition in packages/brain; provider normalization in integrations; authority/encryption/audit in security.
- Domain apps own detailed records. Cross-domain access uses narrow service APIs, never another app's private database.
- Keep model/provider configuration validated. Preserve request-scoped OIDC, complete-request admission, exact accounting and disabled HTTP model retries.
- Persist and acknowledge webhook ingress quickly; expensive work uses the canonical executor and stateless API boundary.
- Make jobs/handlers idempotent; retain canonical database-time generation/lease/expiry fencing and unknown-outcome reconciliation.
- Store UTC and convert with the owner's IANA timezone at boundaries. Record source, observed time, freshness and confidence.
- Do not log credentials, private messages, health/finance content, raw prompts or hidden reasoning.

## Change discipline and evidence

Choose the smallest complete vertical slice. Meaningful architecture changes need an explicit ADR/supersession; inspect existing numbers first, including both distinct ADR 0016 slugs. Review generated SQL and preserve applied migration history. Add meaningful tests for behavior changes and exercise the real path.

Run relevant type, lint, unit/integration/end-to-end checks before claiming executable completion. This documentation absorption ran data-only audits; application/build/database/provider suites remain Linux gates. Use synthetic fixtures, disposable databases and provider-free checks first. Historical fixed C7 migration/recovery commands are dated evidence, not this candidate's release procedure.

V5 draft modules/schemas remain staged until producers, consumers, compatibility, migration, rollback and behavioral tests are reviewed. Code promotion, runtime authority, trusted mission completion and deployment are separate gates. The imported trust/signing/isolation tools and disabled policies are reference designs until independently installed; do not manufacture signatures, enrollment or completion receipts. Direct owner-authorized documentation reconciliation does not claim trusted V5 mission admission.

## Agent use

Use parallel subagents mainly for read-heavy exploration, source mapping, architecture and security review. Keep one implementation owner and combine evidence before editing. Coding specialists are distinct from runtime JARVIS workers; roles confer no runtime privilege.

Use the relevant .agents/skills playbook. Root authority overrides archived directions. Keep handoffs descriptive with current checkpoint, commands, omitted checks, blockers and next safe step.

## Convex boundary

Before changing Convex code read convex/_generated/ai/guidelines.md and the applicable Convex skill. Convex remains opaque orchestration, not canonical private state. Never infer adoption from a generated file.
