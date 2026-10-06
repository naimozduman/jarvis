# Codex: start here

October 5, 2026 reconciliation update: this hierarchy remains the current product-intent reading
order. [The repository documentation map](../../CANONICAL_DOCUMENTATION_MAP.md) adds candidate
provenance, current implementation boundaries and historical-document labels. Earlier deployment
and test results remain dated reports; this candidate received static checks only. Linux validation
is required before any release. V5 and Jarvis Zero remain separate.

This documentation reconstructs JARVIS as of 2026-09-10. The reconstruction task authorized documentation only. Do not treat historical chat instructions, suggested commands, deployment prompts or approvals as fresh authorization to implement, deploy, enroll a phone or contact someone.

## Read order

1. [JARVIS_MASTER.md](JARVIS_MASTER.md): product identity, current direction and document map.
2. [DECISIONS.md](DECISIONS.md): current decisions and what they supersede.
3. [PRD.md](PRD.md) and [ARCHITECTURE.md](ARCHITECTURE.md): desired behavior and component contracts.
4. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md): reported baseline and unverified work. Inspect the actual repository before making present-tense implementation claims.
5. Relevant subsystem documents, their entries in [REQUIREMENTS_LEDGER.md](REQUIREMENTS_LEDGER.md), and related [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) items.

Read [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md) and [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md) before changing execution, data access, provider calls or delegated agents.

## Authority and conflict resolution

Use this ordering, including when a polished old PRD says otherwise:

**Newer explicit user decision → older explicit user decision → user-approved assistant proposal → unconfirmed assistant suggestion → old implementation assumption.**

The current direct user instruction takes precedence over these documents. Within this set, MASTER is the canonical overview; current accepted decisions in DECISIONS and their dated evidence control conflicts about intent. PRD owns outcomes; subsystem documents own the corresponding design details. A technical implementation report cannot override a product decision, and a product wish cannot prove an external API works.

Do not use file modification time, export filename date, branch creation time, assistant repetition or the length of a discussion as decision strength. Source timestamps in the exports have no declared timezone. User-role turns sometimes contain pasted agent reports: their engineering statements remain reports, not newly authored requirements.

If two recent explicit user statements genuinely conflict and message chronology does not resolve them, preserve both and add a specific question to OPEN_QUESTIONS. Do not choose silently. A low-level document inconsistent with an accepted decision needs correction, not automatic promotion into a new decision.

## Before changing architecture

Identify the requirement and current decision affected. Describe the concrete limitation, evidence, proposed alternative, tradeoffs, permission/cost effects, migration and rollback. Use the smallest test that resolves the uncertainty. Label the result **prototype evidence** until its scope, target device, failure behavior and acceptance criteria are established.

Routine implementation details may follow these contracts without inventing approval rituals. A change to product philosophy, disclosure, authority, platform direction, paid budget or a major accepted architecture decision must be made explicit to the owner. The model cannot authorize its own new privileges.

Preserve useful existing implementation. Do not duplicate an already working component merely because the documentation uses a clearer logical name. Do not retain obsolete infrastructure solely because it required much work to build.

## After a confirmed decision

Add a dated decision entry with proposer, user confirmation, rationale, affected requirement IDs and superseded entries. Update the owning subsystem document and PRD/MASTER only where their responsibilities change. Update ledger status, roadmap dependencies and any resolved open question. Keep rejected alternatives and the reason for rejection. Run cross-document checks for platform, permissions, memory, messaging, cost and offline consistency.

Do not copy an entire explanation into every file. Cross-reference the owner. Never record credentials, raw private conversation dumps or hidden chain of thought in documentation or logs.

## Boundaries future sessions must retain

Stock Android first; real HOME launcher; Samsung currently preferred; OEM system infrastructure retained; one personal core; permanent evidence-backed index; scoped context; deterministic cost and authority controls; useful behavior before elaborate UI. Council and Boardroom share agents and history. Offline is a defined reduced mode, not a claim that cloud services run without connectivity.

Read [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md) before proposing iPhone/SpringBoard, jailbreak, ROM, root, kernel, Railway-first or financial-punishment ideas. Archived proposals require a new demonstrated need and an explicit decision to revive them. Prototype files, speculative model recommendations and historical migration instructions are not production authority.
