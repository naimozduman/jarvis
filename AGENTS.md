# JARVIS repository instructions

## Mission

Build the private, single-user JARVIS system defined in `docs/PRD.md`. Treat the PRD as product truth. Treat accepted ADRs as technical truth. Never replace durable state with prompt text.

## Read before changing code

1. `docs/PRD.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SECURITY.md`
4. `docs/BUILD_PLAN.md`
5. The relevant connector document in `docs/INTEGRATIONS.md`
6. The relevant skill under `.agents/skills/`

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
- Make webhook handlers persist and acknowledge quickly. Process expensive work in the worker.
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

- The implementation matches the PRD and current ADRs.
- Tests cover the changed behavior.
- Errors and retries are handled.
- Permission and audit paths are implemented.
- No secret is exposed.
- Relevant docs are updated.
- The changed flow is exercised through the real application path.
