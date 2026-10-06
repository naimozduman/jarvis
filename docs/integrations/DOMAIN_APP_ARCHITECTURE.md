---
title: "Domain App Architecture"
document_id: "docs::DOMAIN_APP_ARCHITECTURE"
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

# Rule

Apps own detail. JARVIS owns meaning and coordination.

A domain app should remain good at its domain even if the Brain is offline. JARVIS should not duplicate every low-level record into Core merely to feel integrated.

## Domain ownership examples

- Growth Stats / Food: meals, ingredients, macros, weight measurements, nutrition calculations.
- Iron & Intervals: exercises, sets, reps, sessions, programming, runs, progression.
- FBA Ledger: inventory, SKUs, shipments, acquisition costs, fees, returns, profit.
- Browser/research: tabs, sessions, page references, research collections, downloads, browsing artifacts.
- Finance dashboard: bills, obligations, account observations, subscriptions, budgets.
- Media: plays, movies, ratings, playlists.
- Relationship Vault: source communications under dedicated privacy policy.
- Calendar: detailed event representation and planning UI where it is the domain owner.

## What Core receives

Core receives:
- typed events,
- bounded summaries,
- durable source references,
- relevant commitments,
- capability declarations,
- sync/health state.

Example:

A meal app owns the complete meal. Core receives a source-backed event such as total calories, protein, timestamp, meal ID, and any decision-relevant summary.

## No direct database coupling

One app does not query another app's private tables. Cross-domain reasoning happens through Core contracts or explicit service APIs.

## Offline behavior

Apps may operate locally/offline, queue signed or authenticated events, and reconcile later. Event IDs and versioning prevent duplicate ingestion.

## Deletion

Deleting a domain source must support provenance-aware cleanup. Derived Core records retain tombstones or safe provenance sufficient to avoid fabricating history after the source is removed.
