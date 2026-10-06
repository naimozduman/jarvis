---
title: "ADR: Browser role and executor separation"
status: active
authority: accepted architecture decision
last_reviewed: 2026-09-25
review_trigger: "Never rewrite accepted history; supersede with a new ADR"
---

# Browser role and executor separation

Status: Accepted

Date: 2026-09-25

## Context
The planned JARVIS browser combines AI search, research continuity, and browser automation. Treating all three as one agent would blur data ownership and action authority.

## Decision
The browser UI is a JARVIS surface. Browser/research records form a domain app. Browser automation is a separate executor.

## Consequences
Browsing history need not all become Core memory. Form submission/purchases/messages cross executor policy. Research remains available across other surfaces through Core references.

## Verification
Browser read/research features work without granting write automation, and executor tests enforce approval classes.
