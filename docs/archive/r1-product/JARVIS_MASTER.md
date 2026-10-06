# JARVIS — canonical overview

Reconstructed 2026-09-10 from all eight supplied exports and the current request. This is the entry point for product and architecture context. Read [CODEX_START_HERE.md](CODEX_START_HERE.md) for the maintenance protocol.

## What JARVIS is

JARVIS is Naim's private personal intelligence and operating layer. It helps him remember, decide, follow through, communicate and operate his digital life with less manual work. It combines an executive assistant, an accountable companion and a system that can take bounded action. Chat is one interface; the product also includes Home, voice, search, background work, personal context and eventually Council and Boardroom.

The platform direction is **stock Android first**. JARVIS Home becomes the default HOME launcher. Android and the phone manufacturer continue supplying the phone's security, connectivity, Wallet, banking compatibility, camera infrastructure, settings, notifications, system UI and updates. JARVIS owns the places where personal intelligence adds value. Root, ROMs and kernels are conditional future research, not prerequisites.

The latest hardware preference is **T-Mobile Galaxy S26 Ultra: 16 GB RAM if affordable, with 12 GB acceptable**. A purchase is not confirmed. Pixel remains an alternative if a demonstrated future requirement needs a suitably unlockable device. Hardware does not determine the core architecture. See [DECISIONS.md](DECISIONS.md), D02–D03.

## Architecture in one view

| Layer                      | Responsibility                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Android app                | Default Home, local commands and selected local AI, voice, permitted context capture, encrypted recent cache and offline queue |
| Personal core              | Canonical identity, personal index, retrieval, preferences, events, Cases, commitments, decisions and action history           |
| Authority services         | Guardian authorizes actions; Context Firewall limits information; Vault brokers credentials; Cost Governor enforces spending   |
| Execution and integrations | Durable jobs, bounded tools, Beeper adapter, calendar/email/files and later isolated browser or desktop workers                |
| Intelligence               | Deterministic code, phone model, inexpensive cloud models and stronger models selected by task and policy                      |
| Shared experiences         | Personal chat and voice; persistent Council; later desktop Boardroom using the same agents and decision history                |

The reported existing backend uses Neon, Vercel and Convex. A consolidated VM is a favored direction to evaluate, not a completed migration or mandatory stack. Beeper's desktop host is an explicit deployment dependency. [ARCHITECTURE.md](ARCHITECTURE.md) owns these distinctions.

## Principles that constrain development

1. Remove the reason for a workaround when possible; do not polish an unnecessary workaround.
2. Reduce manual operation and cognitive burden. Become useful before becoming visually impressive.
3. Keep one personal identity and coherent history across surfaces; change presentation and disclosure by context.
4. Know broadly within authorized storage, retrieve selectively and reveal narrowly. Access is not permission to share.
5. Search before reasoning. A permanent personal index is more than embeddings and does not belong in every prompt.
6. Use deterministic code before AI; use local and inexpensive intelligence when adequate. Premium reasoning must earn its cost.
7. Let explicit goals outrank observed habits. Challenge excuses constructively, explain interventions and preserve deliberate user override.
8. Know when to act, ask, wait, remain quiet or escalate. Repeated reminders alone are not executive assistance.
9. Treat commitments as durable work. A chat ending, a notification disappearing or a timer expiring does not resolve an intention.
10. Make uncertainty, provenance, stale data, action outcomes and recoverability visible. Do not invent successful execution.
11. Give agents bounded authority in code. No model can grant itself access, raise its budget or rewrite the rules that govern it.
12. Preserve the reliable phone underneath JARVIS. Test actual stock limitations before considering deeper platform intervention.

These principles reconcile the early personal-assistant brief in S1-M0003 with S8-M0003 and the latest S2 decisions. [REQUIREMENTS_LEDGER.md](REQUIREMENTS_LEDGER.md) records evidence and approval strength.

## What is being built first

The first useful increment is a trustworthy personal core: reviewed onboarding, searchable supplied context, commitments, useful briefings, drafts, honest action history and hard permission/cost controls, delivered through a thin Android surface and one functioning communication path. Basic HOME behavior follows the same early foundation; elaborate visuals do not gate usefulness.

Passive context, deeper messaging, voice and timed Handoff are phased behind permission, reliability and connector tests. Council is a serious planned subsystem. Rich Boardroom, first-party lifestyle apps and learned computer workflows come later. Optional VPN, Device Owner and Knox are capabilities to test, not mandatory installation demands. [ROADMAP.md](ROADMAP.md) defines dependency order and exit criteria.

**Implementation is not inferred from design.** The latest supplied report says migrations through 0008 and the staging API deployment succeeded, Convex remained paused, the final cloud validation matrix had not run, and real model/WhatsApp operation was not established. This reconstruction did not inspect or deploy the repository. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Documentation map

| Document                                                                   | Authoritative responsibility                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [PRD.md](PRD.md)                                                           | User outcomes, workflows, requirements and acceptance criteria         |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                         | Components, deployment boundaries, communication and failure contracts |
| [JARVIS_HOME.md](JARVIS_HOME.md)                                           | Launcher behavior and OEM/JARVIS surface ownership                     |
| [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md)                             | Personal index, memory, retrieval and retention                        |
| [PASSIVE_CONTEXT_ENGINE.md](PASSIVE_CONTEXT_ENGINE.md)                     | Observation collection, confidence and meaningful events               |
| [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md)                 | Voice, Android capability evidence and device testing                  |
| [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md)                       | Beeper, conversation ingestion and delegated communication             |
| [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md)                           | Model routing, accounting and hard cost limits                         |
| [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md)                       | Agent isolation, Council and desktop meetings                          |
| [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md)                         | Persistent work, proactivity, actions and recovery                     |
| [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md) | Authority, information boundaries, secrets and threat model            |
| [ROADMAP.md](ROADMAP.md)                                                   | Build sequence and maturity gates                                      |
| [DECISIONS.md](DECISIONS.md)                                               | Dated decisions, rationale and supersession                            |
| [REQUIREMENTS_LEDGER.md](REQUIREMENTS_LEDGER.md)                           | Requirement evidence, approval and lifecycle status                    |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)                                     | Unresolved owner choices and technical tests                           |
| [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md)                     | Rejected and superseded directions with useful lessons                 |
| [CODEX_START_HERE.md](CODEX_START_HERE.md)                                 | Instructions for future sessions                                       |
| [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md)                                 | Every source, metadata, provenance and citation convention             |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)                       | Latest reported engineering state, separately from product intent      |
| [VALIDATION_AND_COVERAGE.md](VALIDATION_AND_COVERAGE.md)                   | Reconstruction audit and source coverage                               |
