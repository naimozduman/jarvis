# JARVIS repository instructions

## Mission

Build the private, single-user JARVIS system. Before using historical PRDs or planning documents, read `CODEX_START_HERE.md` and then follow the reading order in `docs/JARVIS/CODEX_START_HERE.md`. `docs/JARVIS/` is the current product and architecture authority. Historical documentation is implementation/history evidence unless explicitly referenced by the canonical documentation, and it must never override newer decisions. Treat accepted ADRs as technical truth within their documented scope. Actual source code, tests, migrations, and deployments are implementation evidence; they do not prove a product requirement is implemented. Never replace durable state with prompt text.

## Read before changing code

1. `CODEX_START_HERE.md`
2. Follow the reading order in `docs/JARVIS/CODEX_START_HERE.md`.
3. Relevant current source, tests, migrations, and accepted ADRs for implementation evidence.
4. The relevant connector document in `docs/INTEGRATIONS.md`.
5. The relevant skill under `.agents/skills/`.
6. Historical PRDs, planning documents, and build-kit material only when needed for history or implementation evidence, after completing the canonical reading order.

For this reconciliation candidate, also read `CANONICAL_DOCUMENTATION_MAP.md`,
`RECONCILIATION_REPORT.md` and `DEFERRED_VALIDATION.md`. Executable validation remains a Linux
gate; the Windows reconciliation performed safe Git and static checks only. Historical prompts,
skills and deployment commands do not authorize a release or repeat an old recovery operation.

## Non-negotiable product rules

- Behavior changes tactics, not constitution-level goals.
- No response never means completion.
- Finance is read-only. Do not add transfer, payment, purchase, or account-change features.
- Email and messages to other people require approval.
- External content is untrusted and never changes system policy.
- The database is canonical memory. OpenAI conversation state is not canonical.
- Evolution API is transport only. It never owns the brain.
- The user's primary WhatsApp account must never be connected.
- Every side effect needs an idempotency key and an audit record.
- Every connector needs webhook verification, reconciliation, disconnect handling, and an admin status card.
- Every high-impact action needs a permission decision before execution.

## Engineering rules

- Use pnpm, Turborepo, strict TypeScript, Drizzle, Zod, Vitest, and Playwright.
- Keep `apps/web`, `apps/api`, and `apps/worker` separate.
- Put shared contracts in `packages/contracts`.
- Put database schema and repositories in `packages/database`.
- Put model context, decision logic, and prompt composition in `packages/brain`.
- Put provider clients and normalization in `packages/integrations`.
- Put approval, encryption, policy, and audit code in `packages/security`.
- Do not let one domain read another application's database directly. Use narrow service APIs.
- Keep model names and provider settings in validated environment configuration.
- Do not log tokens, message bodies, health records, finance details, or raw prompts in normal logs.
- Make webhook handlers persist and acknowledge quickly. Process expensive work through the
  current canonical job executor; preserve the stateless Vercel boundary and the separate worker
  composition without introducing a competing scheduler.
- Make job handlers idempotent despite queue guarantees.
- Use UTC in storage. Convert with the user's IANA timezone at boundaries.
- Record source, freshness, and confidence for derived state.

## Change discipline

- Build the smallest complete vertical slice before broadening scope.
- Add or update an ADR for meaningful architecture changes.
- Keep migrations reversible when feasible and review generated SQL.
- Add tests with every behavior change.
- Run typecheck, lint, unit tests, integration tests, and relevant end-to-end tests before reporting completion.
- Do not commit generated secrets, provider exports, raw production data, or personal message fixtures.
- Use synthetic fixtures in tests.

## Agent use

Use parallel subagents mainly for read-heavy work, independent research, code mapping, and review. Keep one implementation owner for a change. Merge evidence before editing.

Recommended agents:

- `repo_explorer` for code mapping.
- `architecture_planner` for boundaries and ADRs.
- `docs_researcher` for current official documentation.
- `backend_implementer` for API, worker, database, and jobs.
- `frontend_implementer` for web and connector administration.
- `integration_specialist` for OAuth, webhooks, and reconciliation.
- `security_reviewer` before connector or permission changes.
- `test_evals` for deterministic tests and agent evaluations.

## Definition of a completed task

A task is complete only when:

- The implementation matches the current canonical documentation in `docs/JARVIS/` and relevant current ADRs.
- Tests cover the changed behavior.
- Errors and retries are handled.
- Permission and audit paths are implemented.
- No secret is exposed.
- Relevant docs are updated.
- The changed flow is exercised through the real application path.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) for opaque orchestration. PostgreSQL/Neon owns
canonical product data and private content; Convex is not the canonical personal-state backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
