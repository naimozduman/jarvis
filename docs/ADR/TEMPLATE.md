---
title: "Architecture Decision Template"
document_id: "docs::ADR::TEMPLATE"
status: "draft"
authority_class: "template"
owner_role: "governance_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
---

## Proposal identity

Record proposal ID, repository, exact base SHA, status, owner, decision date if accepted, and related invariant IDs. An acceptance date stays null before approval.

## Context

Describe the observed problem and source evidence. Separate observed repository behavior from target design.

## Decision

State one bounded change. Name owning contracts, code areas and generated consumers.

## Alternatives considered

Include the status quo and at least one plausible alternative. State why each was rejected or deferred.

## Security and privacy impact

Describe principal, trust, credential, retention and external-effect changes. “None” requires a reason tied to the actual boundaries.

## Consequences

Describe benefits, operational costs, failure modes and limits of enforcement.

## Migration and compatibility

Name producer/consumer changes, phased rollout, adoption registry updates, rollback, and evidence gates. No schema becomes active from this document alone.

## Acceptance evidence

Reference independent review, exact head, test artifacts and owner authorization. An agent-generated checklist is not approval.

## Supersession

Name specific prior decision IDs or state “none”. Preserve old files. Link successor IDs from the index without rewriting old decisions.
