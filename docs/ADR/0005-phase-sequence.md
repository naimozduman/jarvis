# ADR 0005: Use a data-first delivery sequence

Status: Accepted

Date: 2026-08-28

## Context

The original planning documents used conflicting phase numbers. Some described a WhatsApp vertical
slice before the persistent system it would depend on, while the repository foundation prompt and
build order correctly placed canonical state, jobs, policy, and audit first. The inconsistency made
the same phrase, such as “Phase 1,” mean different work in different documents.

## Decision

JARVIS uses this canonical delivery sequence:

| Phase | Scope |
| --- | --- |
| 0 | Repository bootstrap and safety foundation. |
| 1 | Core data, events, durable jobs, ownership and authentication boundary, policy, approvals, and audit. |
| 2 | Brain, constitution handling, memory retrieval, context assembly, reasoning, behavioral engine, and replanning. |
| 3 | WhatsApp and Evolution API vertical slice. |
| 4 | Web control center. |
| 5 | Gmail and Google Calendar. |
| 6 | Health, finance, training, nutrition, and additional connector interfaces. |
| Later | Native iOS, HealthKit, location, Hermes, external communication, and release hardening. |

This ADR changes planning terminology, ordering, and references only. It does not remove or weaken
any product requirement. A feature may move to its prerequisite phase, but provider connections,
model reasoning, and final UI work remain explicitly deferred until their named phase.

## Consequences

- A provider cannot become the de facto source of truth before canonical persistence, idempotency,
  policy, approvals, and audit exist.
- Phase 2 can build reasoning against stable operating-system contracts rather than transport state.
- Phase 3 can treat Evolution API as a replaceable adapter rather than a brain or database.
- Progress reports and implementation prompts use one unambiguous phase sequence.
