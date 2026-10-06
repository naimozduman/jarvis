---
title: "Integrate speech without losing canonical action state."
document_id: ".agents::skills::voice-and-realtime::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "voice_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "voice-and-realtime"
description: "Integrate speech without losing canonical action state."
version: "5.0.0"
---

# Purpose

Integrate speech without losing canonical action state.

## Scope and handoff

Primary role: `voice_engineer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Attach speech to the same Core session and identity.
2. Separate generated, delivered and playback-acknowledged audio.
3. Cancel speech promptly and reconcile dispatched effects.
4. Measure latency, real device interruptions, privacy and cumulative voice cost.

## Read
- `docs/design/VOICE_ARCHITECTURE.md`
- `docs/security/COST_AND_MODEL_POLICY.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
