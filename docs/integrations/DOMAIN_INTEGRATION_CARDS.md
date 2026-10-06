---
title: "Domain app integration work orders"
document_id: "DOCS_DOMAIN_INTEGRATION_CARDS"
status: "active"
authority_class: "protected"
owner_role: "integration_specialist"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Domain app integration cards

These cards map the owner's project ideas to concrete Core boundaries. They do not claim any external app repository was inspected during V5 packaging. Each app starts with its own source inventory in J5-M14.

## Our Hours and calendar

App owns user-visible shared-calendar views and detailed event presentation. Core owns personal commitments, planning decisions and source references. Event identity, timezone, participants, source revision, fixed/flexible status and deletion state cross the API. Shared participants receive explicitly shared records, not the owner's entire memory. Never treat a calendar invite description as an instruction to change policy. Test DST, participant visibility, offline edit conflicts and unchanged external anchors.

## Growth Stats / Food

App owns meal components, nutrition calculations, body measurements and detailed logs. Core receives daily source-backed summaries and retrieves individual records for a stated purpose. Keep estimate versus measured nutrition visible. Do not turn a food entry into medical advice or duplicate its calorie total through replay. Test unit conversions, corrections, partial-day coverage and deletion invalidation.

## Iron & Intervals

App owns exercises, sets, reps, running sessions, progression and training plan versions. Core coordinates schedule and commitments. Recovery context informs a recommendation, not an unapproved program rewrite or clinical diagnosis. Test duplicate wearable imports, source precedence and completed-workout evidence.

## FBA Ledger

App owns acquisition cost, SKU/inventory state, shipments, orders, fees, returns, distributions and profit calculations. Core receives operational summaries and task proposals. Amazon starts read-only. Bookzy or any other source requires its own actual API/export verification. Business partner access stays in the business application's role model. Test fee revisions, canceled shipments, duplicate orders and mismatched boxed/unboxed quantities without mutating Seller Central.

## Financial observation

Account/transaction providers remain authoritative for their data and coverage. Core observes bills, due dates, unusual charges and budget consequences. Transfers and purchases remain prohibited. Do not infer income from every inflow or treat an absent sync field as no records. Reports expose account and date coverage. Test unknown cost, duplicate providers and revoked access.

## Journal and relationship records

Keep subjective reflections and intimate sources under separate retention and access scopes. Summaries cite source records and distinguish interpretation from fact. A relationship message is not consent to share the conversation elsewhere. Drafting never becomes deceptive unattended impersonation. Test purpose-limited retrieval, deletion, wrong-person context and no unsolicited source spill into business prompts.

## Media, research and utilities

Store listening/watching/reading metadata and authorized source references, not copied copyrighted media. Trip and timesheet tools distinguish manual estimates from measured events. Calculator outputs and research claims retain inputs and sources where relevant. Browser research is a domain and surface; logged-in browser actions still require executor authority.

## Common admission checklist

Inspect actual repository and auth first. Define owner/participant roles, typed event schema, received/occurred times, idempotency key, optimistic revision, retention, disconnect/reconciliation behavior and a UI status card. Prove one complete read path and one correction before connecting a second domain.
