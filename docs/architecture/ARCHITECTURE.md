---
title: "System Architecture V5"
document_id: "docs::ARCHITECTURE"
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

# One Core with explicit ownership

The accepted deployment direction remains stateless Vercel API, opaque Convex wakeups, canonical Neon/PostgreSQL state and separately scoped transport/executor processes. Current source includes Telegram and dedicated official Cloud adapters as well as the retained legacy local Evolution bridge. Existing pg-boss/Railway history is preserved, not restarted. Validate the real checkout before changing runtime composition.

## Boundaries

Core -> typed integration ports -> domain apps/connectors/executors. Surfaces authenticate and send normalized requests. Models produce strict intent, not arbitrary code or authority. Workers run bounded jobs with delegated context and return results to Core. A worker's session DB, vector index, notebook, browser or Markdown vault is not Core truth.

Neon stores canonical events, generations, leases, attempts, authority, decisions, context manifests and evidence. Convex receives only a declared opaque projection, never a whole database row. Egress tests validate allowed projection fields and types at runtime. A field-name grep is not proof that private text cannot hide inside a generic string.

Domain app details remain in their owner service. Core stores stable references, versioned summaries and reconciliation cursors. SDK write commands use optimistic concurrency, deterministic operation keys and permissions. Offline corrections invalidate dependent summaries rather than duplicating entries.

## Control path

Authenticate -> normalize -> persist -> deduplicate -> create durable work -> acknowledge. Before a model call, reserve a bounded resource budget. Assemble versioned instructions and minimal source-backed context. Validate output and referenced IDs. Materialize server-owned proposed actions. Evaluate deterministic policy, capability, authority, freshness and kill epoch. Resolve exact approval as needed. Execute through an isolated adapter, observe, reconcile uncertainty, verify, then report and record outcomes.

## Independence

Business outcome state, job execution state, channel delivery state and voice playback state are distinct. A sent notification does not complete a bill payment. A cancelled model turn does not undo a dispatched booking. A timeout is not proof an external write never happened.

## V5 engineering control plane

Protected baseline policy -> trusted Git-diff/approval gate -> unprivileged candidate tests -> owner-controlled promotion/release. Local validation helps editing but cannot protect against an identity with permission to alter the trusted checker or repository settings.

## Adoption

Candidate contracts and prompts are staged under schemas/drafts and prompts/runtime/modules. Active code continues to use its current imports. New schema adoption requires explicit producer/consumer mapping, compatibility tests and a migration record. PROMPT_ARCHITECTURE specifies content-addressed assembly; it does not silently replace the existing TypeScript registry.
