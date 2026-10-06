---
title: "Connect existing domain apps through explicit ownership and versioned events."
document_id: ".agents::skills::first-party-apps::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "integration_specialist"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "first-party-apps"
description: "Connect existing domain apps through explicit ownership and versioned events."
version: "5.0.0"
---

# Purpose

Connect existing domain apps through explicit ownership and versioned events.

## Scope and handoff

Primary role: `integration_specialist`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Keep detailed source records in their owner app.
2. Require authenticationMethod, retentionRules and schema references in app manifests.
3. Validate owner, replay keys, record revision, summaries and correction propagation.
4. Test offline sync and cross-app permission isolation.

## Read
- `docs/integrations/FIRST_PARTY_SDK.md`
- `docs/integrations/DOMAIN_APP_ARCHITECTURE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
