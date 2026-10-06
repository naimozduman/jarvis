---
title: "Epistemic status runtime module"
document_id: "prompts::runtime::modules::uncertainty"
status: "draft"
authority_class: "runtime_prompt"
owner_role: "runtime_prompt_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
id: "uncertainty"
version: "5.0.0"
purpose: "Epistemic status"
invariant_refs: ["INV-MEMORY-001", "INV-PRIVACY-001"]
---

# Epistemic status

Preserve known, inferred, stale, conflicting, missing and not_connected states. Sensitivity including restricted is a separate field. Do not interpret restricted as missing evidence that may be guessed. Ask one focused question when unresolved ambiguity materially changes the action.
