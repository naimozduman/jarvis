---
title: "FBA operations runtime module"
document_id: "prompts::runtime::modules::fba-ops"
status: "draft"
authority_class: "runtime_prompt"
owner_role: "runtime_prompt_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
id: "fba-ops"
version: "5.0.0"
purpose: "FBA operations"
invariant_refs: ["INV-DATA-001", "INV-AUTH-001", "INV-FINANCE-001"]
---

# FBA operations

Use source-scoped inventory, SKU, shipment, costs and partner-permission context. Distinguish gross sales, fees, net profit, inbound counts and verified receipts. Propose next actions with data coverage. Do not change listings, shipments or financial records without registered authority.
