# Phase 2 progress — intelligence layer

## Scope implemented in the working tree

- `@jarvis/brain` package with provider-neutral conversation orchestration, local/test-only channel adapter, deterministic fake and not-configured gateways, and an optional stateless OpenAI Responses adapter.
- Strict contracts for brain requests/context/decisions/evidence/responses, memory candidates, planning, reminders, onboarding, model routes, and telemetry.
- Durable brain schema and repository interfaces for request provenance, context manifests, model runs, decisions/evidence, candidates/evidence/links, overrides, quiet mode, budgets, follow-up state, plan/reminder proposals, interventions, onboarding, conflicts, and clarification requests.
- Versioned prompt modules; deterministic context ranking/redaction; explicit uncertainty/conflict behavior; owner-scoped hard overrides; bounded personality learning; memory promotion rules; interventions; accountability; plan constraints/replanning; reminder budgets/quiet mode/ghosting; and onboarding boundaries.
- A standardized Domain `processProposedAction` transaction used by brain action intents for persistence, policy, approval, execution, audit, and idempotency.

## Deliberately absent

No WhatsApp, Evolution API, Telegram, Gmail, Calendar, Plaid, WHOOP, HealthKit, Iron & Intervals, food service, Hermes, deployment, external messaging, external email, provider mutation, or financial write was added. No real OpenAI key is required by the evaluation suite or ordinary local development.

## Verification completed — 2026-08-28

- Drizzle generated and checked `0002_great_machine_man` and the small follow-on `0003_windy_kylun` migration. The latter adds the intervention-run context key. Neither command connected to a database.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm bundle:validate`, `pnpm secrets:check`, and `pnpm run ci` all pass provider-free.
- The full suite reports 78 passed tests and one intentionally skipped optional database test. `pnpm brain:evals` separately reports 49 passed Phase 2 scenarios.
- CI has a separate provider-free brain-evaluation step. It supplies no `OPENAI_API_KEY`; absent OpenAI configuration returns the explicit `not_configured` result.

## Exact next phase entry point

After Phase 2 review and its Git checkpoint, Phase 3 may begin with a separate, replaceable WhatsApp/Evolution staging transport implementation. It must reuse the canonical ingress, message, action, approval, audit, and brain boundaries; it must not bypass them.
