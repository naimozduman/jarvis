# Build-kit manifest

Generated: August 23, 2026

| File                                            | Purpose                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `.agents/skills/agent-evals/SKILL.md`           | Repository-scoped Codex skill.                                          |
| `.agents/skills/connector-integration/SKILL.md` | Repository-scoped Codex skill.                                          |
| `.agents/skills/database-and-jobs/SKILL.md`     | Repository-scoped Codex skill.                                          |
| `.agents/skills/deploy-railway-vercel/SKILL.md` | Repository-scoped Codex skill.                                          |
| `.agents/skills/evolution-whatsapp/SKILL.md`    | Repository-scoped Codex skill.                                          |
| `.agents/skills/jarvis-product-rules/SKILL.md`  | Repository-scoped Codex skill.                                          |
| `.agents/skills/security-and-privacy/SKILL.md`  | Repository-scoped Codex skill.                                          |
| `.codex/agents/architecture-planner.toml`       | Custom Codex subagent configuration.                                    |
| `.codex/agents/backend-implementer.toml`        | Custom Codex subagent configuration.                                    |
| `.codex/agents/docs-researcher.toml`            | Custom Codex subagent configuration.                                    |
| `.codex/agents/frontend-implementer.toml`       | Custom Codex subagent configuration.                                    |
| `.codex/agents/integration-specialist.toml`     | Custom Codex subagent configuration.                                    |
| `.codex/agents/repo-explorer.toml`              | Custom Codex subagent configuration.                                    |
| `.codex/agents/security-reviewer.toml`          | Custom Codex subagent configuration.                                    |
| `.codex/agents/test-evals.toml`                 | Custom Codex subagent configuration.                                    |
| `.codex/config.toml`                            | Starter repository file.                                                |
| `.env.example`                                  | Starter repository file.                                                |
| `.gitignore`                                    | Starter repository file.                                                |
| `AGENTS.md`                                     | Root Codex instructions.                                                |
| `BUILD_ORDER.md`                                | Starter repository file.                                                |
| `JARVIS_PRD.docx`                               | Editable Word version of the complete PRD.                              |
| `JARVIS_PRD.pdf`                                | Portable PDF version of the complete PRD.                               |
| `PRODUCTION_READINESS.md`                       | Starter repository file.                                                |
| `README.md`                                     | Starter repository file.                                                |
| `SOURCE_INDEX.md`                               | Starter repository file.                                                |
| `apps/api/.gitkeep`                             | Starter repository file.                                                |
| `apps/ios/.gitkeep`                             | Starter repository file.                                                |
| `apps/web/.gitkeep`                             | Starter repository file.                                                |
| `apps/worker/.gitkeep`                          | Starter repository file.                                                |
| `docker-compose.local.yml`                      | Starter repository file.                                                |
| `docs/ADR/0001-stack.md`                        | Architecture decision record.                                           |
| `docs/ADR/0002-evolution-transport.md`          | Architecture decision record.                                           |
| `docs/ADR/0003-single-orchestrator.md`          | Architecture decision record.                                           |
| `docs/ADR/0004-read-only-finance.md`            | Architecture decision record.                                           |
| `docs/ARCHITECTURE.md`                          | Product, architecture, operations, security, or research documentation. |
| `docs/BUILD_PLAN.md`                            | Product, architecture, operations, security, or research documentation. |
| `docs/CODEX_SETUP.md`                           | Product, architecture, operations, security, or research documentation. |
| `docs/DATA_MODEL.md`                            | Product, architecture, operations, security, or research documentation. |
| `docs/DECISION_ENGINE.md`                       | Product, architecture, operations, security, or research documentation. |
| `docs/DEPLOYMENT.md`                            | Product, architecture, operations, security, or research documentation. |
| `docs/EVALS_AND_ACCEPTANCE.md`                  | Product, architecture, operations, security, or research documentation. |
| `docs/INTEGRATIONS.md`                          | Product, architecture, operations, security, or research documentation. |
| `docs/OPEN_QUESTIONS.md`                        | Product, architecture, operations, security, or research documentation. |
| `docs/PRD.md`                                   | Product, architecture, operations, security, or research documentation. |
| `docs/RESEARCH_NOTES.md`                        | Product, architecture, operations, security, or research documentation. |
| `docs/SECURITY.md`                              | Product, architecture, operations, security, or research documentation. |
| `docs/WHATSAPP_RISK_AND_RECOVERY.md`            | Product, architecture, operations, security, or research documentation. |
| `evals/results/.gitkeep`                        | Starter repository file.                                                |
| `package.json`                                  | Starter repository file.                                                |
| `packages/config/.gitkeep`                      | Starter repository file.                                                |
| `packages/database/.gitkeep`                    | Starter repository file.                                                |
| `packages/domain/.gitkeep`                      | Starter repository file.                                                |
| `packages/integrations/.gitkeep`                | Starter repository file.                                                |
| `packages/observability/.gitkeep`               | Starter repository file.                                                |
| `packages/schemas/.gitkeep`                     | Starter repository file.                                                |
| `packages/security/.gitkeep`                    | Starter repository file.                                                |
| `packages/testing/.gitkeep`                     | Starter repository file.                                                |
| `pnpm-workspace.yaml`                           | Starter repository file.                                                |
| `prompts/codex/00-bootstrap.md`                 | Ordered Codex implementation prompt.                                    |
| `prompts/codex/01-foundation.md`                | Ordered Codex implementation prompt.                                    |
| `prompts/codex/02-whatsapp-vertical-slice.md`   | Ordered Codex implementation prompt.                                    |
| `prompts/codex/03-memory-and-planning.md`       | Ordered Codex implementation prompt.                                    |
| `prompts/codex/04-google-connectors.md`         | Ordered Codex implementation prompt.                                    |
| `prompts/codex/05-finance-and-health.md`        | Ordered Codex implementation prompt.                                    |
| `prompts/codex/06-hardening.md`                 | Ordered Codex implementation prompt.                                    |
| `prompts/runtime/accountability.md`             | Production JARVIS prompt mode.                                          |
| `prompts/runtime/core-system.md`                | Production JARVIS prompt mode.                                          |
| `prompts/runtime/email-triage.md`               | Production JARVIS prompt mode.                                          |
| `prompts/runtime/finance-observer.md`           | Production JARVIS prompt mode.                                          |
| `prompts/runtime/health-and-training.md`        | Production JARVIS prompt mode.                                          |
| `prompts/runtime/memory-extractor.md`           | Production JARVIS prompt mode.                                          |
| `prompts/runtime/message-writer.md`             | Production JARVIS prompt mode.                                          |
| `prompts/runtime/planner.md`                    | Production JARVIS prompt mode.                                          |
| `prompts/runtime/tool-policy.md`                | Production JARVIS prompt mode.                                          |
| `prompts/runtime/weekly-review.md`              | Production JARVIS prompt mode.                                          |
| `schemas/agent-decision.schema.json`            | Runtime JSON schema.                                                    |
| `schemas/approval.schema.json`                  | Runtime JSON schema.                                                    |
| `schemas/connector-manifest.schema.json`        | Runtime JSON schema.                                                    |
| `schemas/day-plan.schema.json`                  | Runtime JSON schema.                                                    |
| `schemas/event.schema.json`                     | Runtime JSON schema.                                                    |
| `schemas/memory-candidate.schema.json`          | Runtime JSON schema.                                                    |
| `scripts/validate_bundle.py`                    | Validation or safety script.                                            |
| `scripts/verify_no_secrets.sh`                  | Validation or safety script.                                            |
| `templates/connector-card-spec.md`              | Configuration or connector template.                                    |
| `templates/connectors/evolution.json`           | Configuration or connector template.                                    |
| `templates/connectors/google.json`              | Configuration or connector template.                                    |
| `templates/connectors/plaid.json`               | Configuration or connector template.                                    |
| `templates/connectors/whoop.json`               | Configuration or connector template.                                    |
| `templates/railway-services.md`                 | Configuration or connector template.                                    |
| `tsconfig.base.json`                            | Starter repository file.                                                |
| `turbo.json`                                    | Starter repository file.                                                |
