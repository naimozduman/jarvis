---
title: "Browser Architecture V5"
document_id: "docs::BROWSER_ARCHITECTURE"
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

# Product role

The JARVIS browser is both:

1. a first-party surface for talking to JARVIS while browsing,
2. a domain app for browser/research state.

It is not a separate AI assistant.

## Browser domain ownership

The browser may own:
- tabs/windows/workspaces,
- browsing sessions,
- page/source references,
- search history under owner policy,
- downloads,
- reading/research collections,
- page annotations,
- extracted source metadata.

Core receives only relevant typed events and summaries.

## AI search

Search and research may combine traditional web search, direct browsing, source comparison, and JARVIS memory/project context. Results preserve citations/source references.

## Context bridge

A browser turn may include:
- current page title/URL,
- selected text,
- tab group/project,
- explicit page snapshot,
- relevant Core context.

Do not send the entire browser history or every page to a model by default.

## Browser executor

Automation is a separate executor boundary.

Read/navigate may be low-risk. Form submission, messages, purchases, account changes, deletion, and irreversible actions require stronger authority.

Prefer structured accessibility/DOM snapshots before screenshots. Use vision when structure is insufficient.

## Cross-surface continuity

Research started in the browser should remain available to WhatsApp, Android, voice, or web through Core references, not browser-local assistant memory.

## Platform strategy

Share Core/browser-domain logic across platforms while using platform-specific shells where browser-engine restrictions require it. Do not force one UI/runtime abstraction if it materially degrades the browser.

## V5 browser split
Browser UI, research-domain storage and executor automation have separate contracts. Begin with existing browser integration and project-linked research capture. A new cross-platform browser engine is not required for Core continuity. Private tabs, selected pages and capture allowlists have explicit policies. Logged-in access does not authorize purchases or submissions. J5-M21 follows the executor gate for effectful browser actions.
