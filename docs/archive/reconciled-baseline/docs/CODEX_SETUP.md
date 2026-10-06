# Codex setup

## Project instructions

Codex reads the root `AGENTS.md`. Keep it below the project instruction size limit and place detailed workflows in `.agents/skills`.

## Project agents

Custom agents are in `.codex/agents`. Restart Codex after changing agent configuration if the new agent does not appear.

Suggested first run:

```text
Read AGENTS.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/SECURITY.md, and prompts/codex/00-bootstrap.md. Use repo_explorer and architecture_planner for read-only analysis, then implement only Phase 0.
```

## MCP servers

`.codex/config.toml` includes optional project-scoped MCP entries for:

- OpenAI Developer Docs.
- Railway.
- Vercel.
- Neon.

Authenticate each only when needed. Keep write-capable infrastructure tools in prompt or writes approval mode.

Useful commands:

```bash
codex mcp list
codex mcp login railway
codex mcp login vercel
codex mcp login neon
```

Do not place tokens inside `.codex/config.toml`.

## Skills

Repository skills live in `.agents/skills`. Invoke them explicitly when needed, or let Codex select them from their descriptions.

Examples:

```text
Use $evolution-whatsapp for this webhook implementation.
Use $connector-integration for the Google OAuth work.
Use $security-and-privacy before approving this connector change.
Use $agent-evals to add regression cases.
```

## Build prompts

Run the phase prompts in the order defined by ADR 0005: `00-bootstrap.md`, `01-foundation.md`,
`02-brain-memory-and-planning.md`, `03-whatsapp-vertical-slice.md`,
`04-web-control-center.md`, `05-google-connectors.md`, `06-connectors-and-health.md`, then
`07-hardening.md` when release work is in scope. Start a clean Codex task for each phase. Make
Codex write a progress report before starting the next phase.

## Secrets

Codex should create placeholders and environment schemas only. Add real secrets through Vercel, Railway, Neon, Google, Plaid, WHOOP, and Telegram dashboards. Never paste secrets into Markdown, issues, commits, or model prompts.
