---
title: "First Party Sdk V5"
document_id: "docs::FIRST_PARTY_SDK"
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

The first-party SDK lets personal apps attach to JARVIS Core without embedding Brain logic or sharing unrestricted databases.

## Required app manifest

Each app declares:
- app ID and version,
- record domains it owns,
- event types it emits,
- summary/read capabilities,
- commands it accepts,
- offline/reconciliation behavior,
- sensitivity classes,
- retention rules,
- authentication method.

## Core-facing primitives

The planned SDK should support:

- `emitEvent(envelope)`
- `publishSummary(summary)`
- `getOwnerContext(requestedScopes)`
- `registerCapabilities(manifest)`
- `receiveCommand(command)`
- `ackCommand(result)`
- `syncCursor(cursor)`
- `reportHealth(status)`

Names are illustrative until schemas are accepted.

## Event requirements

Every event has owner scope, app ID, event ID, occurred time, schema version, source record reference, sensitivity, and content hash/idempotency key.

## Command requirements

A Core command is not automatic authority. The app verifies:
- authenticated Core caller,
- capability,
- authority/approval token where required,
- command version,
- idempotency key,
- expiry.

## Data minimization

Core asks for summaries before raw detail. Raw records are fetched only when the task needs them and policy permits it.

## Versioning

SDK and event schemas are versioned. Breaking changes require compatibility windows or explicit migration.

## First adapters

Prefer adapters for existing projects before rewriting them. Growth Stats, Iron & Intervals, FBA Ledger, and the future browser are strong early candidates.

## V5 manifest completeness
The manifest contract requires authenticationMethod and retentionRules in addition to declared record ownership, versioned event/command schemas, sync/retry policy and capabilities. App ownerId is validated against the server-bound principal. Apps cannot mint Core authority. Detailed records remain owned by their app, while Core summaries carry source version and correction semantics. See schemas/drafts/first-party-app-manifest.schema.json.
