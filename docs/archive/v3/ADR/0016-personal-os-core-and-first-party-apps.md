---
title: "ADR: JARVIS Core and first-party app ecosystem"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# JARVIS Core and first-party app ecosystem

Status: Accepted

Date: 2026-09-25

## Context
JARVIS is expanding beyond WhatsApp into health, training, business, browser, Android, media, finance, and relationship systems. Rebuilding each as an isolated AI app would create duplicated identity, memory, policy, and history.

## Decision
JARVIS Core owns owner-level canonical state, context, authority, audit, and coordination. First-party apps own high-resolution domain records and integrate through versioned events, summaries, capabilities, and source references.

## Consequences
Apps stay specialized. Cross-domain reasoning occurs in Core. No app gets unrestricted access to another app's database. Core does not duplicate every detailed domain record.

## Migration
Existing apps attach through adapters before any rebuild.

## Verification
A first-party app integration must preserve app ownership while producing Core events and source-backed summaries.
