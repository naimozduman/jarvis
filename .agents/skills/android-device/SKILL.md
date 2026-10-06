---
title: "Build Android context and policy with owner-visible local boundaries."
document_id: ".agents::skills::android-device::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "mobile_implementer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "android-device"
description: "Build Android context and policy with owner-visible local boundaries."
version: "5.0.0"
---

# Purpose

Build Android context and policy with owner-visible local boundaries.

## Scope and handoff

Primary role: `mobile_implementer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Verify current Android/device APIs from primary docs.
2. Enroll the device and minimize permissions.
3. Expire world state and reconcile encrypted offline queues.
4. Test revocation, local stop, override and sleep/foreground behavior.

## Read
- `docs/design/ANDROID_ARCHITECTURE.md`
- `docs/architecture/WORLD_STATE.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.
