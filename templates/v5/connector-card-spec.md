---
title: "Connector Card Spec"
document_id: "templates::connector-card-spec"
status: "reference"
authority_class: "template"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
---

# Connector card specification

A control-center connector card should show:

- display name and provider,
- connection state,
- authorization/scopes,
- last successful sync,
- freshness/degraded state,
- read capabilities,
- write capabilities,
- approval/authority requirements,
- privacy/sensitivity class,
- reconcile action,
- disconnect/revoke action,
- safe error summary,
- source documentation/version where relevant.

Never render secret values, raw tokens, private webhook payloads, or full restricted source data on the card.
