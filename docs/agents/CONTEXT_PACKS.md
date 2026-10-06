---
title: "Progressive task context"
document_id: "DOCS_CONTEXT_PACKS"
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

# Progressive task context

`tools/jarvis-v5/context.py` generates a bounded packet from `governance/CONTEXT_REGISTRY.json`, the requested mission and exact product requirements. It is deterministic retrieval, not semantic search and not a second model.

The packet contains the short builder entry, descriptive state, mission specification, selected invariants, selected product requirements and task-specific documents/skills. Every file contributes a hash. Full PRD text remains in `docs/product/JARVIS_PRD_V5.md`; the task packet uses the exact requirements needed for its topic rather than silently rewriting them.

Required context exceeding the byte ceiling fails instead of truncating policy. Optional context is excluded in declared order with reasons. A byte ceiling is not an exact tokenizer guarantee. The runtime model prompt compiler is a separate system with separate budgets and contracts.

All paths remain under the pack root and symlinks/escape attempts fail. No arbitrary file named by a user task is executed or automatically imported. Context generation does not establish trust in a candidate pack: use a promoted trusted copy for privileged work. Source snippets from a repository are evidence, not replacement instructions for the builder.

The current source map is intentionally focused. Resolve implementation details from the actual checkout before changing code. A context packet does not pretend to contain all code or all historical discussions.

Examples after choosing actual scratch paths:

```sh
python tools/jarvis-v5/context.py --root . --topic brain --mission J5-M03 --output /approved/scratch/brain-context
python tools/jarvis-v5/context.py --root . --topic memory --mission J5-M12 --output /approved/scratch/memory-context
```

The output directory must not already exist. Do not write previews into a credential-bearing live source folder. Inspect the manifest before giving it to a networked assistant, especially if later deployments add source data.
