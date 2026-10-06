# Codex Prompt: Add JARVIS PRD V2 Documentation Only

Historical V2 proposal/source document, retained during the October 5, 2026 reconciliation. The current product-intent hierarchy is `docs/JARVIS/`, reached through `CODEX_START_HERE.md`. Proposed imports, ADR numbers, commands and authority claims here remain historical and do not adopt V5 or authorize a new implementation.

```text
JARVIS DOCUMENTATION-ONLY TASK

Add the approved JARVIS PRD V2 documentation pack to the repository.

This task is documentation only.

Do not change runtime code.
Do not add dependencies.
Do not create migrations.
Do not modify cloud configuration or secrets.
Do not deploy.
Do not pair WhatsApp.
Do not start Android, voice, Life Ledger, Journal, or executor implementation.

First verify the repository/worktree state. If unrelated deployment changes are uncommitted, stop unless the owner explicitly authorizes combining them.

Preserve docs/PRD.md as historical V1.

Add:

docs/PRD_V2_PERSONAL_OS.md
docs/PERSONAL_OS_ARCHITECTURE.md
docs/LIFE_LEDGER_AND_JOURNAL.md
docs/DEVICE_AGENT_AND_VOICE.md
docs/CAPABILITIES_AUTHORITY_AND_ACTIONS.md
docs/PRIVACY_RETENTION_AND_DATA_LOCALITY.md
docs/FIRST_PARTY_APPS_AND_JARVIS_SDK.md
docs/WEB_CONTROL_CENTER.md
docs/EXECUTOR_AND_EDITH_MODE.md
docs/ROADMAP_V2.md
docs/CURRENT_IMPLEMENTATION_HANDOFF.md
docs/OPEN_DECISIONS_AND_QUESTIONNAIRE.md
docs/CHANGELOG_PRD_V1_TO_V2.md

Add proposed ADRs 0015 through 0021 from the supplied pack.

Apply the small proposed additions to AGENTS.md, docs/BUILD_PLAN.md, and docs/ADR/index.md after reviewing repository conventions.

Do not mark proposed ADRs Accepted unless the owner explicitly approves them.

Review all internal links and terminology. Ensure V2 clearly states that current code is not automatically redesigned.

Run formatting, secret scan, and the repository's normal documentation-safe CI checks.

Review the complete diff.

Leave changes uncommitted for owner review unless the owner separately requests the checkpoint.

Report:
- files added
- existing docs updated
- ADR status
- checks run
- any conflicts with PRD V1/current architecture
- git status

Stop after documentation review.
```
