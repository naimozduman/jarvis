---
title: "Agent Runtime V5"
document_id: "docs::AGENT_RUNTIME"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Position

Agent runtimes are workers under JARVIS Core, not replacements for Core.

Hermes, OpenJarvis, OpenClaw, Codex, Claude Code, browser agents, or future frameworks may be selected per job.

## Job contract

Core gives a worker:
- job ID,
- explicit goal,
- bounded context manifest,
- allowed tools/capabilities,
- time/token/cost budget,
- output contract,
- approval boundary,
- cancellation signal,
- provenance requirements.

The worker returns:
- status,
- evidence,
- produced artifacts,
- proposed actions,
- safe error class,
- usage/cost telemetry.

## Memory

Worker session memory is disposable. A worker may propose facts or skills, but Core validates and promotes them.

## Authority

Workers do not inherit all JARVIS capabilities. A Research agent should not automatically gain email-send or shell-write access.

## Reliability

Agent loops require:
- iteration budget,
- repetition/stuck detection,
- timeout,
- cancellation,
- checkpoint/result reporting,
- safe failure,
- no completion claim without evidence.

## Multi-agent

Core may delegate independent subjobs. Agents share canonical job state through Core, not private peer-to-peer authority.

## V5 budgets and promotion
Worker slots carry a canonical job ID/generation, purpose, finite capability delegation, per-job resource reservation and progress state. Stuck/repetition detection trips admission, not merely telemetry. A runtime's learned skill is a draft until reviewed and tested. Its tool catalog, local memory and model sessions never grant Core authority. Do not silently install a framework as a replacement Core.
