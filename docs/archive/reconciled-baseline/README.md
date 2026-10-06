# JARVIS

This repository contains the private, single-user JARVIS product and its implementation history.

October 5, 2026: this is a reconciliation candidate on `reconciliation/2026-10-05`, built from
verified GitHub main `8fffe34cf12f13b9dbbd8fe7f7f37b2d17937df7` and preserved R1 development
`e43ec080a2a4eeb0c6603e6570001540bcbace8b`. See [RECONCILIATION_REPORT.md](RECONCILIATION_REPORT.md)
for provenance and [DEFERRED_VALIDATION.md](DEFERRED_VALIDATION.md) for Linux validation gates.
Only safe Git and static checks were performed for this candidate; prior test and deployment
reports remain dated evidence. The candidate has not been deployed.

## Current documentation

Current JARVIS product and architecture documentation lives in `docs/JARVIS/`. Begin at `CODEX_START_HERE.md`, then follow the reading order in `docs/JARVIS/CODEX_START_HERE.md`. The remaining build-kit material is retained as historical implementation and repository evidence; it does not override canonical documentation.

[CANONICAL_DOCUMENTATION_MAP.md](CANONICAL_DOCUMENTATION_MAP.md) distinguishes current intent,
technical decisions, candidate implementation, dated reports and historical PRDs. V5 and Jarvis
Zero remain separate projects; their governance and implementation are not adopted here.

For current work:

1. Read `CODEX_START_HERE.md`.
2. Follow the reading order in `docs/JARVIS/CODEX_START_HERE.md`.
3. Read `AGENTS.md` for repository engineering instructions.
4. Consult historical PRDs and planning documents only after the canonical reading order, and only as implementation/history evidence.
5. Use the existing prompts, project agents, and repository skills only when they remain relevant to the current canonical direction.

## Historical build-kit context

The first objective is one reliable vertical slice:

```text
Naim -> WhatsApp -> Evolution API -> JARVIS API -> Neon -> OpenAI -> JARVIS API -> Evolution API -> Naim
```

Then prove one proactive outbound reminder.

Do not build every connector at once. Do not use ChatGPT connector credentials. The application needs its own OpenAI API key, Google OAuth app, Plaid app, WHOOP app, Evolution instance, Telegram bot, Railway project, Vercel project, and Neon project.

## Included artifacts

- `JARVIS_PRD.docx` and `JARVIS_PRD.pdf`
- Historical Markdown PRD and architecture documents
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
