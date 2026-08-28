# JARVIS Codex Build Kit

This folder is the build specification for a private, single-user personal executive accountability operating system.

Start here:

1. Read `AGENTS.md`.
2. Read `docs/PRD.md`.
3. Read `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/BUILD_PLAN.md`.
4. Review `docs/OPEN_QUESTIONS.md`.
5. Run the prompts in `prompts/codex/` in order.
6. Use the project agents in `.codex/agents/` and repository skills in `.agents/skills/`.

The first objective is one reliable vertical slice:

```text
Naim -> WhatsApp -> Evolution API -> JARVIS API -> Neon -> OpenAI -> JARVIS API -> Evolution API -> Naim
```

Then prove one proactive outbound reminder.

Do not build every connector at once. Do not use ChatGPT connector credentials. The application needs its own OpenAI API key, Google OAuth app, Plaid app, WHOOP app, Evolution instance, Telegram bot, Railway project, Vercel project, and Neon project.

## Included artifacts

- `JARVIS_PRD.docx` and `JARVIS_PRD.pdf`
- Canonical Markdown PRD and architecture documents
- Codex `AGENTS.md`
- Codex project agents
- Repository skills
- Runtime prompts
- Build prompts
- JSON schemas
- Environment and local deployment templates
- Build and production checklists
- Research notes and architecture decisions

## Core rule

Behavior changes delivery. Behavior never rewrites the mission.
