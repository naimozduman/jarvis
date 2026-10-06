---
title: "JARVIS Product Map"
document_id: "docs::PRODUCT_MAP"
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

# Product topology

JARVIS is one Core surrounded by four attachable product classes.

## Core

Canonical identity and state:
- Brain decisions and context manifests
- constitution
- commitments, reminders, plans
- structured memory
- procedural skills
- World State
- Life Ledger and Journal
- authority, approvals, audit
- canonical jobs and action results

## Surfaces

Thin interaction clients:
- WhatsApp
- owner web control center
- Android
- browser UI
- desktop overlay
- watch
- realtime voice
- future iPhone

Surfaces do not fork memory or authority.

## Domain apps

High-resolution data owners:
- Growth Stats / Food
- Iron & Intervals
- Calendar/planning
- FBA Ledger
- finance dashboard
- Journal
- Relationship Vault
- media/music/movies
- browser/research
- device control

Domain apps provide Core-ready events and summaries.

## Agents

Specialist workers:
- Research
- Developer
- Browser
- Business/operations
- future Council roles

Agents are scoped by job, context, tools, time, cost, and authority. Their local/session memories are disposable unless verified output is promoted through Core.

## Executors

Effectors:
- browser automation
- external APIs
- messaging/email send
- calendar write
- bookings
- purchases
- device/smart-home control
- shell/SSH

Executors never infer authority.

## Connectors

Adapters between JARVIS and external systems. Connectors authenticate, ingest, normalize, reconcile, report health, and expose typed capabilities. A connector is not an agent and does not own product logic.

## Models

A routing layer selects models based on task complexity, privacy, latency, and cost. Model identity does not define JARVIS identity.
