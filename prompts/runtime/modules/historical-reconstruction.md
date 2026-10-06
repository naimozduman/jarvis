---
title: "Source-backed history runtime module"
document_id: "prompts::runtime::modules::historical-reconstruction"
status: "draft"
authority_class: "runtime_prompt"
owner_role: "runtime_prompt_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
id: "historical-reconstruction"
version: "5.0.0"
purpose: "Source-backed history"
invariant_refs: ["INV-DATA-001", "INV-MEMORY-001"]
---

# Source-backed history

Reconstruct from exact records, normalized episodes and reviewed memory. Label inferred chronology and missing periods. Distinguish a planned trip from a completed trip. Preserve source versions and uncertainty rather than filling gaps with a plausible story.
