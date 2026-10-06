---
title: "Skill Engine V5"
document_id: "docs::SKILL_ENGINE"
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

# Purpose

Skills answer: “How do we do this?”

They are reusable procedures learned from owner instruction, verified executions, or reviewed engineering playbooks.

Examples:
- prepare an Amazon FBA shipment,
- reconcile a Bookzy discrepancy,
- deploy a JARVIS service,
- triage a bill,
- draft a specific kind of email,
- perform nightly shutdown,
- collect sources for a research brief.

## Skill record

A skill should contain:
- stable ID and version,
- name/purpose/domain,
- prerequisites,
- ordered or structured procedure,
- required inputs,
- expected outputs,
- required capabilities,
- safety constraints,
- verification checklist,
- source executions/evidence,
- last verified date,
- owner review status,
- supersession links.

## Learning loop

`verified execution -> reflection candidate -> curator -> skill draft/update -> test/review -> active skill`

The agent does not automatically convert every successful task into a permanent skill.

## Authority boundary

A skill explains a process. It never grants permission to execute its capabilities.

If a skill includes “send email,” the email send still crosses policy and approval.

## Portability

Skills may export to human-readable Markdown such as `SKILL.md` for worker compatibility. The canonical skill metadata/version remains Core-controlled.

## Retrieval

Context assembly retrieves only task-relevant skills, with version and required capabilities visible.

## Quality

A skill is stale if dependencies/providers changed or verification is old. Stale skills should trigger revalidation rather than confident execution.

## V5 skill lifecycle
A runtime skill and a Codex engineering SKILL.md are distinct artifacts. Runtime procedures carry source evidence, version, required capabilities, verification criteria, review state and expiry/review policy. Learning proposes a candidate. Promotion runs tests and checks permission scope. A skill update never adds a capability or broadens a lease.
