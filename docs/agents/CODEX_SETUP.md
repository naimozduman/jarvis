---
title: "Codex setup and task routing"
document_id: "DOCS_CODEX_SETUP"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Codex setup

Read `AGENTS.md` for the one canonical session entry. Use `CODEX_START_HERE.md` and `docs/archive/v5-source/START_V5_IN_CODEX.txt` for first integration. This pack does not override a running client, grant access to a provider or select a model by an unverified name.

## Progressive skills and specialists

The `.agents/skills/<name>/SKILL.md` files have standard name/description metadata and explicit lead roles. Load the matching skill body for the task. `.codex/agents/*.toml` uses exact registry names and required role fields. The model is inherited from an owner-selected, verified installed configuration. Role configuration is not a security boundary against the host account.

The config files under `integration/codex/` are examples, not global replacements. Check support against the installed Codex release before merging. The current official docs distinguish filesystem sandbox, approval policy, environment inheritance and remote tools. Read-only does not by itself remove credentials or disable inherited connectors. A clean account/VM must remove provider reach separately.

## Local tooling

Python 3.11+ and Node 22+ run the pack tools without changing the app dependency tree. Run structural validation and tests from the extracted pack. Schema fixtures use the isolated requirements file. The external app retains its own frozen Node/pnpm/toolchain versions until a reviewed change.

## Live observations

Read-only provider checks require the owner-authorized verification context. Use available authorized connectors or reviewed official CLI/API reads for the named project and environment. Inspect actual account/project IDs first. If access is unavailable, record unknown and block only dependent live work. Do not request secrets in chat, install a new provider tool to bypass an authorization gap, or copy ChatGPT connector credentials into the application.

## Session completion

Maintain the current version-2 descriptive handoff through reviewed file edits after comparing its previous hash. The imported `tools/jarvis-v5/state.py` only understands the original pack schema and remains reference-only. Include source checkpoint, dirty work, tests run, tests not run, blockers, next safe step and impacted documents. Before convention adoption, write scratch only. Trusted mission completion is a separate signed receipt. See `docs/agents/SESSION_CONTINUITY.md` and `docs/security/MISSION_ADMISSION.md`.
