---
title: "ADR: Procedural memory as versioned skills"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# Procedural memory as versioned skills

Status: Accepted

Date: 2026-09-25

## Context
Facts and preferences do not represent reusable know-how such as how to prepare an FBA shipment or deploy a service.

## Decision
Add a first-class Skill Engine for versioned, evidence-backed procedures. Skills may export to human-readable SKILL.md for worker compatibility.

## Consequences
Skills are retrieved separately from personal facts. A skill never grants action authority. Skill updates require evidence/review rules.

## Verification
A learned procedure can be retrieved and followed while policy still independently gates every side effect.
