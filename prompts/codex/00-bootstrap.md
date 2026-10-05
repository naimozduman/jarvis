# Phase 0: Bootstrap and verify the repository plan

Historical build prompt from the original staged build kit. Before using any step, read `CODEX_START_HERE.md`, follow `docs/JARVIS/CODEX_START_HERE.md`, and consult `CANONICAL_DOCUMENTATION_MAP.md`. The instructions below describe their original phase and are not current startup or release authorization. Preserve current source, accepted ADRs and later product decisions.

Read `AGENTS.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/BUILD_PLAN.md`, and every accepted ADR.

Use `repo_explorer` to inspect the repository and `architecture_planner` to produce a Phase 0 implementation plan. Use `docs_researcher` for any version-sensitive API or platform claim.

Then implement only the repository foundation:

- pnpm workspace and Turborepo
- strict shared TypeScript configuration
- empty `apps/web`, `apps/api`, `apps/worker`
- shared packages for config, schemas, database, domain, integrations, security, observability, and testing
- environment validation
- lint, type-check, unit-test, format-check, and bundle-validation commands
- CI workflow without deployment secrets
- health endpoint skeletons
- architecture decision index

Do not connect real providers. Do not add real secrets. Do not implement the agent loop yet.

Finish with changed files, commands run, results, unresolved decisions, and the exact next phase entry point.
