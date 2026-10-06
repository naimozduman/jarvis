# Requirements ledger

Responsibility: trace major concepts to proposer, actual user response, rejection/supersession, time and current status. This is a reconciled ledger, not a transcript or a list of every assistant brainstorm. It contains 96 major concepts across all eight exports plus the current request.

## How to interpret the ledger

**Current confirmed / product requirement** means explicitly requested or clearly adopted, not already implemented. **Strongly desired / approved future** preserves intent while deferring delivery. **Architecture synthesis** is the reconstructed design needed to support requirements, not a claim of user approval of every field. **Needs prototype / API verification / device testing** is a technical maturity axis. **Reported implemented** identifies source reports, not a live audit. **Experimental / unapproved / archived / rejected / unresolved** must never silently become production scope.

Confidence below concerns evidence and interpretation. It is not a fabricated probability or an assertion that an API works. The current user request can explicitly adopt a formerly unconfirmed assistant idea; this is recorded as CURRENT, not backdated approval. Detailed primary-source capability findings are in the relevant subsystem document.

Message references link to the source inventory and give the exact displayed timestamp and original Markdown line. `through` denotes a cited discussion span; both endpoints are supplied. User-role implementation reports remain reports. Major decisions are reconciled in [DECISIONS.md](DECISIONS.md).

## Personal purpose and life context

### R001 — Private personal operating intelligence for Naim

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit repeated requirement.

**Rejection, supersession or boundary:** Public SaaS not current goal.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S2-M0053](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:00:17, source line 7293; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [JARVIS_MASTER.md](JARVIS_MASTER.md).

### R002 — One identity, memory, history and personality across surfaces

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Separate assistant brains per app excluded.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S7-M0002](SOURCE_INVENTORY.md#s7) — assistant, 2026-09-06 17:14:49, source line 14; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHITECTURE.md](ARCHITECTURE.md).

### R003 — Executive function, friend, accountability and flexible negotiation

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Do not optimize observed bad habits or nag indiscriminately.

**Evidence:** [S1-M0001](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:14:19, source line 9; [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S1-M0181](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 02:39:03, source line 24743.

**Owning document:** [PRD.md](PRD.md).

### R004 — Onboarding questionnaire prefilled from supplied context and reviewed

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Do not silently trust inferred imported profile.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644.

**Owning document:** [PRD.md](PRD.md).

### R005 — Inspectable memory, corrections and personality reset/freeze

**Status:** Current requirement with design detail. **Evidence confidence:** Mixed: user intent is supported; optional design/technical behavior remains unconfirmed.

**Proposed by:** User and assistant. **User response / approval:** User inspect/correct; assistant reset design.

**Rejection, supersession or boundary:** No invisible immutable profile.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S1-M0024](SOURCE_INVENTORY.md#s1) — user, 2026-08-28 23:44:36, source line 6268; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R006 — Goals and explicit intentions outrank observed behavior; hard override

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Financial punishment rejected separately.

**Evidence:** [S1-M0001](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:14:19, source line 9; [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954.

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R007 — Grouped daily briefings and configurable review cadence

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** 6–9 messages and Sunday17h examples, not quotas.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644.

**Owning document:** [PRD.md](PRD.md).

### R008 — Read important email, bills and deadlines

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** None.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752.

**Owning document:** [PRD.md](PRD.md).

### R009 — Scoped operational email sending for persistent work

**Status:** Future approved capability; grants unset. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Newer user endorses email back-and-forth and proposal.

**Rejection, supersession or boundary:** Expands early absolute no-send; no blanket grant.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129; [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752.

**Owning document:** [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

### R010 — Calendar extraction and autonomous flexible replanning under rules

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Assistant ask-every-write assumption weaker.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S1-M0183](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 02:58:59, source line 24857; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S2-M0043](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:44:15, source line 6871.

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R011 — Health/training/nutrition context and source conflict handling

**Status:** Strongly desired phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** No guessed workout merge or medical diagnosis.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124.

**Owning document:** [PRD.md](PRD.md).

### R012 — Finance balances, due bills, subscriptions and duplicate alerts

**Status:** Current confirmed phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Read intelligence distinct money movement.

**Evidence:** [S1-M0001](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:14:19, source line 9; [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644.

**Owning document:** [PRD.md](PRD.md).

### R013 — First-party food/workout/running apps feed JARVIS directly

**Status:** Future approved. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit repeated.

**Rejection, supersession or boundary:** Apple Health not mandatory intermediary.

**Evidence:** [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124.

**Owning document:** [ARCHITECTURE.md](ARCHITECTURE.md).

### R014 — Journal retrospectives combining photos, music, places and activities

**Status:** Future strongly desired. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Strong desire.

**Rejection, supersession or boundary:** No costly indiscriminate analysis.

**Evidence:** [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373.

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R015 — Movie watch/rating/review history and calculation context

**Status:** Future strongly desired. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Strong desire.

**Rejection, supersession or boundary:** Not MVP suite of replacement apps.

**Evidence:** [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373.

**Owning document:** [ROADMAP.md](ROADMAP.md).

### R016 — Relationship vault scoped details and approved summaries

**Status:** Current confirmed phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Not all details copied everywhere.

**Evidence:** [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373; [S2-M0045](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:47:21, source line 6911.

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R017 — Years-long meaningful location timeline and retrospective retrieval

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit corrective decision.

**Rejection, supersession or boundary:** Supersedes ephemeral-only location assumption.

**Evidence:** [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R018 — Wearable WHOOP/Oura/Apple ecosystem options

**Status:** Future research. **Evidence confidence:** Mixed: user intent is supported; optional design/technical behavior remains unconfirmed.

**Proposed by:** User. **User response / approval:** Exploration.

**Rejection, supersession or boundary:** No specific new wearable purchased.

**Evidence:** [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124.

**Owning document:** [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Platform, hardware and Home

### R019 — Stock Android first, no root/ROM/kernel prerequisite

**Status:** Current architecture decision. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit repeated.

**Rejection, supersession or boundary:** Supersedes deep-OS-first interpretations.

**Evidence:** [S4-M0007](SOURCE_INVENTORY.md#s4) — user, 2026-09-08 04:13:53, source line 369; [S2-M0025](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 02:38:57, source line 4030; [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0053](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:00:17, source line 7293; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHITECTURE.md](ARCHITECTURE.md).

### R020 — Default Android HOME launcher

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** No app pretending to be HOME.

**Evidence:** [S2-M0007](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:45:56, source line 1376; [S2-M0013](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:57:58, source line 2351; [S2-M0025](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 02:38:57, source line 4030; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [JARVIS_HOME.md](JARVIS_HOME.md).

### R021 — Ratio-inspired left intelligence, center Home, right messages

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Exact visuals not decided.

**Evidence:** [S2-M0007](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:45:56, source line 1376; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [JARVIS_HOME.md](JARVIS_HOME.md).

### R022 — Preserve OEM Wallet, banks, camera, OTA and system surfaces

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Reject Guided Access and unnecessary system replacement.

**Evidence:** [S2-M0011](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:54:55, source line 1997; [S2-M0025](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 02:38:57, source line 4030; [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [JARVIS_HOME.md](JARVIS_HOME.md).

### R023 — T-Mobile Galaxy S26 Ultra preferred, 16GB if affordable, 12GB acceptable

**Status:** Current preference; purchase unconfirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Latest explicit preference.

**Rejection, supersession or boundary:** Supersedes Pixel-only and temporary S22 recommendation.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0051](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:56:49, source line 7130.

**Owning document:** [DECISIONS.md](DECISIONS.md).

### R024 — Pixel alternative for verified later bootloader/system need

**Status:** Future escalation option. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant, current user. **User response / approval:** Current user preserves conditional option.

**Rejection, supersession or boundary:** Carrier-unlocked not necessarily bootloader unlockable.

**Evidence:** [S7-M0004](SOURCE_INVENTORY.md#s7) — assistant, 2026-09-06 17:20:43, source line 102; [S2-M0026](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 02:39:11, source line 4035; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R025 — Battery, thermals, coverage and less phone use matter

**Status:** Current nonfunctional requirements. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Benchmark capacity not real workload endurance.

**Evidence:** [S3-M0005](SOURCE_INVENTORY.md#s3) — user, 2026-09-05 18:27:27, source line 211; [S3-M0031](SOURCE_INVENTORY.md#s3) — user, 2026-09-05 19:51:59, source line 1346; [S6-M0001](SOURCE_INVENTORY.md#s6) — user, 2026-09-06 18:18:41, source line 9; [S4-M0007](SOURCE_INVENTORY.md#s4) — user, 2026-09-08 04:13:53, source line 369.

**Owning document:** [PRD.md](PRD.md).

### R026 — Personal private APK and owner authentication

**Status:** Current architecture direction. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User accepts APK/private login.

**Rejection, supersession or boundary:** No public Play launch required.

**Evidence:** [S7-M0003](SOURCE_INVENTORY.md#s7) — user, 2026-09-06 17:20:35, source line 97; [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124.

**Owning document:** [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

### R027 — Siri-inspired state feedback and polished custom motion

**Status:** Approved later UX. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Desire.

**Rejection, supersession or boundary:** No copying Apple or UI-first implementation.

**Evidence:** [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752; [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [JARVIS_HOME.md](JARVIS_HOME.md).

## Memory, context and sensing

### R028 — Permanent personal index beyond vector database

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit repeated.

**Rejection, supersession or boundary:** Provider source-only/no durable personal archive superseded.

**Evidence:** [S5-M0001](SOURCE_INVENTORY.md#s5) — user, 2026-09-08 00:35:16, source line 9; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; [S2-M0045](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:47:21, source line 6911; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R029 — Exact, semantic, entity, chronology, recent and derived retrieval

**Status:** Current architecture decision. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant, current user. **User response / approval:** Explicit current request.

**Rejection, supersession or boundary:** No full-history prompt stuffing.

**Evidence:** [S2-M0032](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 03:07:35, source line 4813; [S2-M0046](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 04:47:28, source line 6916; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R030 — People, places, businesses, projects and relationships as entities

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Identity merging requires evidence.

**Evidence:** [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R031 — Screenshot memory for products, designs and actionable text

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Screenshots imply saved interest, not purchase or approval.

**Evidence:** [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [PASSIVE_CONTEXT_ENGINE.md](PASSIVE_CONTEXT_ENGINE.md).

### R032 — Personal data export bootstrap with provenance and coverage gaps

**Status:** Approved direction; formats need verification. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User curious; current broad index confirms import value.

**Rejection, supersession or boundary:** Every-company-everything claim unsupported.

**Evidence:** [S5-M0001](SOURCE_INVENTORY.md#s5) — user, 2026-09-08 00:35:16, source line 9; [S5-M0002](SOURCE_INVENTORY.md#s5) — assistant, 2026-09-08 00:35:23, source line 14; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808.

**Owning document:** [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

### R033 — What is she talking about contextual recall on current screen

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Answer from evidence; no invented remembered event.

**Evidence:** [S2-M0045](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:47:21, source line 6911.

**Owning document:** [PRD.md](PRD.md).

### R034 — Context Firewall broad internal access, narrow external disclosure

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit user requirement.

**Rejection, supersession or boundary:** No business leakage to relationship or football agent.

**Evidence:** [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373; [S2-M0045](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:47:21, source line 6911; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

### R035 — Passive Context Engine combining weak signals

**Status:** Current confirmed phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit current request.

**Rejection, supersession or boundary:** No single sensor sees everything.

**Evidence:** [S2-M0055](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:03:22, source line 8139; [S2-M0056](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 05:03:33, source line 8144; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [PASSIVE_CONTEXT_ENGINE.md](PASSIVE_CONTEXT_ENGINE.md).

### R036 — Notification Listener and app usage context

**Status:** Current product; platform verified separately. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Cannot promise every notification or full history.

**Evidence:** [S1-M0183](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 02:58:59, source line 24857; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; [S2-M0055](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:03:22, source line 8139; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

### R037 — Accessibility reading and bounded UI actions

**Status:** Current product; needs device testing. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** No secure unlock/private database/secure-screen bypass.

**Evidence:** [S4-M0007](SOURCE_INVENTORY.md#s4) — user, 2026-09-08 04:13:53, source line 369; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

### R038 — Optional local VPN/DNS network clues and blocking

**Status:** Experimental optional. **Evidence confidence:** Mixed: user intent is supported; optional design/technical behavior remains unconfirmed.

**Proposed by:** User. **User response / approval:** Explicit interest.

**Rejection, supersession or boundary:** SSH is not traffic sensor; encrypted pages not visible.

**Evidence:** [S2-M0055](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:03:22, source line 8139; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [PASSIVE_CONTEXT_ENGINE.md](PASSIVE_CONTEXT_ENGINE.md).

### R039 — Purchase/visit fusion and uncertainty-aware prompts

**Status:** Approved product; needs prototype. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit interest.

**Rejection, supersession or boundary:** Location alone not purchase, meal or exact mall store.

**Evidence:** [S2-M0055](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:03:22, source line 8139; [S2-M0056](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 05:03:33, source line 8144; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [PASSIVE_CONTEXT_ENGINE.md](PASSIVE_CONTEXT_ENGINE.md).

### R040 — Values-based Guardian/self-discipline including Islamic routines

**Status:** Opt-in desired; rules unset. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit desire.

**Rejection, supersession or boundary:** No inference of physical/religious obligation from viewed page.

**Evidence:** [S1-M0183](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 02:58:59, source line 24857; [S2-M0055](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:03:22, source line 8139.

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R041 — Love8 refresh and third-party stale-state troubleshooting

**Status:** Needs API verification/device test. **Evidence confidence:** Mixed: user intent is supported; optional design/technical behavior remains unconfirmed.

**Proposed by:** User. **User response / approval:** Exploratory use case.

**Rejection, supersession or boundary:** Unlock-and-open repeatedly not canonical architecture.

**Evidence:** [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; [S2-M0032](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 03:07:35, source line 4813.

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

## Voice and Android control

### R042 — Local wake word, offline speech and deterministic commands

**Status:** Current confirmed; testing needed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Default assistant does not guarantee OEM low-power hotword.

**Evidence:** [S1-M0183](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 02:58:59, source line 24857; [S2-M0033](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:23:51, source line 5418; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

### R043 — Provider-independent conversational voice, interruption and escalation

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** No exclusive ElevenLabs/OpenAI selection.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

### R044 — Incoming JARVIS app call with answer/decline and live voice

**Status:** Current requirement; needs prototype. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** No PSTN number necessary; Android presentation unproven.

**Evidence:** [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

### R045 — Device Owner package suspension as optional management tier

**Status:** Needs device testing; opt-in architecture option. **Evidence confidence:** Moderate: option/direction supported; detailed selection or feasibility not established.

**Proposed by:** Assistant, current user. **User response / approval:** Current user asks possibilities, not enrollment.

**Rejection, supersession or boundary:** No mandatory factory reset or unlimited root authority.

**Evidence:** [S4-M0008](SOURCE_INVENTORY.md#s4) — assistant, 2026-09-08 04:14:04, source line 374; [S2-M0032](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 03:07:35, source line 4813; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

### R046 — Samsung Knox management extensions

**Status:** Needs API verification/device testing. **Evidence confidence:** Moderate: option/direction supported; detailed selection or feasibility not established.

**Proposed by:** Assistant, current user. **User response / approval:** Explore where useful.

**Rejection, supersession or boundary:** Not prerequisite or proven license eligibility.

**Evidence:** [S2-M0036](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 03:41:06, source line 5800; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

## Messaging and delegation

### R047 — Beeper as unified messaging adapter under own interface

**Status:** Current architecture decision. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit repeated.

**Rejection, supersession or boundary:** Rebuild all network bridges not current plan.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752; [S2-M0007](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:45:56, source line 1376; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### R098 — First cloud Brain route uses provider-neutral Vercel AI Gateway OIDC

**Status:** One bounded live Luna probe passed; standing paid use and direct-owner messaging remain
gated. **Evidence confidence:** High for the owner instruction and the recorded live receipt.

**Proposed by:** User. **User response / approval:** Explicit current instruction.

**Requirement:** Use the existing Vercel AI Gateway/OIDC adapter rather than a direct OpenAI API key for the
first live JARVIS Brain probe. Preserve provider-neutral runtime model selection, the strict `BrainDecision`
schema, bounded context/output limits, deterministic cost guard, receipt accounting, and no-silent-fallback
behavior. The approved probe is `openai/gpt-6-luna`, standard route, `medium` reasoning effort, approximately
6,000 input / 2,500 output token bounds, one call, no fallback, and deep escalation disabled. Its actual
Gateway receipt was $0.00045893; replay created no duplicate Brain work.

**Rejection, supersession or boundary:** No static Gateway API key, provider lock-in, paid auto-top-up,
unbounded/model-name-inferred pricing, or downgrade from strict structured output follows from the provider-path
approval. Current free-catalog candidates are not approved where their metadata does not advertise the required
structured-output capability.

**Evidence:** CURRENT — explicit owner instruction, live public Gateway catalog check, and bounded canonical
live probe, 2026-09-29.

**Owning document:** [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

### R048 — Continuous message ingestion plus historical bootstrap

**Status:** Current requirement; needs connector test. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Beeper initial history not complete; no direct iCloud guarantee.

**Evidence:** [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### R049 — Draft, temporary Handoff, Sleep Handoff, emergency handback

**Status:** Current confirmed phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit approval S2-M0043.

**Rejection, supersession or boundary:** Not all-day autonomous relationship replacement.

**Evidence:** [S8-M0007](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:48:25, source line 828; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; [S2-M0042](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 04:41:04, source line 6808; [S2-M0043](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:44:15, source line 6871; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### R050 — Handoff authorship awareness/disclosure policy

**Status:** Unresolved operational policy. **Evidence confidence:** High confidence in bounded-mode approval; unresolved disclosure policy.

**Proposed by:** User and assistant. **User response / approval:** Approves routine behavior; partner-awareness not independently confirmed.

**Rejection, supersession or boundary:** Do not silently promote either secret mode or per-message label.

**Evidence:** [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; [S2-M0039](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:38:52, source line 6783; [S2-M0042](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 04:41:04, source line 6808; [S2-M0043](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:44:15, source line 6871.

**Owning document:** [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

### R051 — Presence/read/typing managed separately where supported

**Status:** Needs API verification/device testing. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit desire.

**Rejection, supersession or boundary:** No guarantee invisible reading or controllable online status.

**Evidence:** [S2-M0007](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:45:56, source line 1376; [S2-M0043](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:44:15, source line 6871; [S2-M0044](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 04:44:50, source line 6876.

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### R052 — Morning handoff exact authorship, commitments, unanswered messages

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Not transcript dump or pretend user said AI message.

**Evidence:** [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; [S2-M0043](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:44:15, source line 6871; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### R053 — Partner calendar layer extracted from conversations

**Status:** Current confirmed phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Other person's schedule not owner's confirmed appointment.

**Evidence:** [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; [S2-M0045](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:47:21, source line 6911; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### R054 — Shared reels/media understanding and return to user

**Status:** Experimental future. **Evidence confidence:** Mixed: user intent is supported; optional design/technical behavior remains unconfirmed.

**Proposed by:** User. **User response / approval:** Exploration.

**Rejection, supersession or boundary:** No pretending user personally watched media.

**Evidence:** [S8-M0007](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:48:25, source line 828; [S8-M0008](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:48:36, source line 833.

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

## Intelligence, hosting and authority

### R055 — Deterministic then local then cheap cloud then premium

**Status:** Current architecture decision. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit current requirement.

**Rejection, supersession or boundary:** No vendor model forced for every task.

**Evidence:** [S2-M0033](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:23:51, source line 5418; [S2-M0051](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:56:49, source line 7130; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

### R056 — Useful private phone local model for selected tasks/offline

**Status:** Current confirmed; benchmark selection pending. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit repeated.

**Rejection, supersession or boundary:** Not downloadable proprietary ChatGPT; no giant always-running model.

**Evidence:** [S2-M0033](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:23:51, source line 5418; [S2-M0051](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:56:49, source line 7130; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

### R057 — Multiple providers, Auto plus manual model choice

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Perplexity aggregator is candidate not requirement.

**Evidence:** [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

### R058 — Hard code-enforced spending limits/reservations/timeouts/steps

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit current request.

**Rejection, supersession or boundary:** $50 examples not active budget; no LLM authority to increase.

**Evidence:** [S2-M0033](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:23:51, source line 5418; [S2-M0036](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 03:41:06, source line 5800; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

### R059 — Free initially, affordable paid operation later

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit later correction.

**Rejection, supersession or boundary:** Permanent zero-dollar/free-model-only requirement superseded.

**Evidence:** [S1-M0044](SOURCE_INVENTORY.md#s1) — user, 2026-08-30 10:05:11, source line 11254; [S1-M0183](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 02:58:59, source line 24857; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

### R060 — VM/backend hosting consolidation preference

**Status:** Favored target; deployment choice unresolved. **Evidence confidence:** Moderate: option/direction supported; detailed selection or feasibility not established.

**Proposed by:** User and assistant. **User response / approval:** User receptive and expects VM; exact migration not selected.

**Rejection, supersession or boundary:** Do not silently replace existing Neon/Vercel/Convex.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129; [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; [S2-M0033](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:23:51, source line 5418.

**Owning document:** [ARCHITECTURE.md](ARCHITECTURE.md).

### R061 — Cloud worker plus physical desktop executor

**Status:** Approved future architecture. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User endorses browser/computer execution.

**Rejection, supersession or boundary:** Desktop never sole always-on prerequisite by assumption.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129.

**Owning document:** [ARCHITECTURE.md](ARCHITECTURE.md).

### R062 — Guardian separate from agent; standing scoped permissions

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit approval.

**Rejection, supersession or boundary:** No confirmation for every safe read; no agent self-grant.

**Evidence:** [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

### R063 — Credential Vault/broker keeps secrets outside model context

**Status:** Current architecture decision. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit approval.

**Rejection, supersession or boundary:** Prompt secrecy alone insufficient.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

### R064 — Action Ledger visible outcomes/evidence/permissions/recovery

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit approval.

**Rejection, supersession or boundary:** No hidden chain-of-thought logs; unknown is not success.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R065 — Payment broker for future scoped purchases

**Status:** Approved future; provider eligibility unverified. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit likes money proposal.

**Rejection, supersession or boundary:** Not build own card network/wallet or active spending grant.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752; [S2-M0025](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 02:38:57, source line 4030.

**Owning document:** [ROADMAP.md](ROADMAP.md).

## Persistent work and attention

### R066 — Persistent Cases and long-running jobs until real outcome

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant, current user. **User response / approval:** Explicit current request; user longjobexamples.

**Rejection, supersession or boundary:** Chat closing/reminder expiry not task completion.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R067 — Unresolved intentions wait for conditions across weeks/months

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** No premature unconditional calendar entry.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R068 — Learn repeated work, propose tested automation

**Status:** Strong desire; advanced prototype. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User endorses observation learning; current request.

**Rejection, supersession or boundary:** No automatic unreviewed skill/policy self-modification.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R069 — Reality Debugging reconstructs explanatory event chains

**Status:** Current requirement; advanced prototype. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant, current user. **User response / approval:** Explicit current request.

**Rejection, supersession or boundary:** Correlation cannot be stated as proven causation.

**Evidence:** [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R070 — Action reversibility/compensation and grouped undo

**Status:** Current architecture; advanced UX. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant, current user. **User response / approval:** Explicit current request.

**Rejection, supersession or boundary:** Cannot undo sent/read messages or time.

**Evidence:** [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R071 — Scenario simulation using real constraints

**Status:** Experimental future. **Evidence confidence:** High confidence that this is unapproved/experimental; no feature approval inferred.

**Proposed by:** Assistant. **User response / approval:** No specific approval in exports; broad best-version request.

**Rejection, supersession or boundary:** Not proof of future outcomes.

**Evidence:** [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; [S2-M0054](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 05:00:40, source line 7298.

**Owning document:** [ROADMAP.md](ROADMAP.md).

### R072 — Design/build missing systems automatically

**Status:** Experimental future. **Evidence confidence:** High confidence that this is unapproved/experimental; no feature approval inferred.

**Proposed by:** Assistant. **User response / approval:** No specific approval of autonomous deployment.

**Rejection, supersession or boundary:** Policy/production changes still controlled.

**Evidence:** [S2-M0004](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:42:35, source line 347; [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129.

**Owning document:** [ROADMAP.md](ROADMAP.md).

### R073 — Attention management quiet by default, escalate important changes

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Cannot intercept all OEM notifications before display.

**Evidence:** [S1-M0003](SOURCE_INVENTORY.md#s1) — user, 2026-08-23 16:33:22, source line 644; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

## Council and Boardroom

### R074 — Council as persistent multi-agent environment chaired by JARVIS

**Status:** Current confirmed phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit 'need to make that'.

**Rejection, supersession or boundary:** Not same prompt with renamed seats.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

### R075 — Independent Council memory/tools/objectives/providers/context

**Status:** Current architecture decision. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit current requirement.

**Rejection, supersession or boundary:** Chairman and agents cannot widen privileges.

**Evidence:** [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; [S2-M0038](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 04:30:33, source line 6519; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

### R076 — Finance/operator/risk/news/football seats and media chat

**Status:** Confirmed direction; roster optional. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User finance conflict and news/football/media explicit.

**Rejection, supersession or boundary:** Exact complete roster/provider not fixed.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

### R077 — Boardroom same Council on desktop, weekly or 1–2/week optional

**Status:** Approved advanced phase. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit.

**Rejection, supersession or boundary:** Not separate state/history or paid generated-video stream.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

### R078 — Rendered characters, live voice/camera interruption/evidence/actions

**Status:** Advanced needs prototype. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit possibility.

**Rejection, supersession or boundary:** Camera sensing optional, no facial emotion certainty.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

### R079 — Fictional/original characters distinct living-person-inspired simulations

**Status:** Current design boundary. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User requests both; current distinction explicit.

**Rejection, supersession or boundary:** Assistant original-only preference not user mandate.

**Evidence:** [S2-M0035](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:40:56, source line 5795; [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

### R080 — WhatsApp Council window optional, native identities authoritative

**Status:** Architecture synthesis; optional bridge. **Evidence confidence:** Moderate: option/direction supported; detailed selection or feasibility not established.

**Proposed by:** User and assistant. **User response / approval:** User offers multiple transports not selected.

**Rejection, supersession or boundary:** One account cannot become multiple WhatsApp identities.

**Evidence:** [S2-M0037](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 04:30:16, source line 6514; [S2-M0038](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 04:30:33, source line 6519.

**Owning document:** [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

## Reliability and reported implementation

### R081 — Stock Android offline Home/search/commands/capture and sync queue

**Status:** Current confirmed. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicit current requirement.

**Rejection, supersession or boundary:** Cloud outage must not disable phone; stale writes revalidate.

**Evidence:** [S2-M0031](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:07:16, source line 4808; [S2-M0033](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 03:23:51, source line 5418; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHITECTURE.md](ARCHITECTURE.md).

### R082 — Durable scheduler with generation fencing, explicit expiry and idempotency

**Status:** Reported implemented; preserve invariant. **Evidence confidence:** High confidence in what the report states; current implementation not independently verified.

**Proposed by:** Reported implementation. **User response / approval:** Reports accepted engineering progression, not product perfection.

**Rejection, supersession or boundary:** pg-boss sole-worker assumption obsolete serverless baseline.

**Evidence:** [S1-M0243](SOURCE_INVENTORY.md#s1) — user, 2026-09-07 17:08:39, source line 28002; [S1-M0245](SOURCE_INVENTORY.md#s1) — user, 2026-09-08 00:33:21, source line 28585; [S1-M0253](SOURCE_INVENTORY.md#s1) — user, 2026-09-08 02:43:10, source line 30056; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

### R083 — Latest release migrated through0008, API healthy, Convex paused

**Status:** Reported status, not independently verified. **Evidence confidence:** High confidence in what the report states; current implementation not independently verified.

**Proposed by:** Reported implementation in user turn. **User response / approval:** Repeated correction in M0304.

**Rejection, supersession or boundary:** AssistantM0303 stale rerun instruction wrong.

**Evidence:** [S1-M0302](SOURCE_INVENTORY.md#s1) — user, 2026-09-10 03:07:30, source line 37560; [S1-M0304](SOURCE_INVENTORY.md#s1) — user, 2026-09-10 03:10:17, source line 37638.

**Owning document:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

### R084 — No model/WhatsApp live; final cloud matrix unrun in latest report

**Status:** Reported incomplete. **Evidence confidence:** High confidence in what the report states; current implementation not independently verified.

**Proposed by:** Reported implementation. **User response / approval:** No later evidence of completion.

**Rejection, supersession or boundary:** Health success not product readiness.

**Evidence:** [S1-M0302](SOURCE_INVENTORY.md#s1) — user, 2026-09-10 03:07:30, source line 37560; [S1-M0304](SOURCE_INVENTORY.md#s1) — user, 2026-09-10 03:10:17, source line 37638; [S1-M0305](SOURCE_INVENTORY.md#s1) — assistant, 2026-09-10 03:10:35, source line 37659.

**Owning document:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Archive and reconstruction boundaries

### R085 — iPhone SpringBoard/JarvisBoard/jailbreak exploration

**Status:** Archived. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explored, no available path established.

**Rejection, supersession or boundary:** Current Androidfirst supersedes.

**Evidence:** [S2-M0005](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:37:15, source line 831; [S2-M0020](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 01:42:55, source line 3164; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R086 — Permanent Guided Access and Shortcut bounce fake launcher

**Status:** Rejected. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** Explicitly rejected systemloss/animation.

**Rejection, supersession or boundary:** Rejected M11/M13.

**Evidence:** [S2-M0011](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:54:55, source line 1997; [S2-M0013](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:57:58, source line 2351.

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R087 — Custom iPhone kernel from scratch

**Status:** Archived rejected direction. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User question, assistant rejection. **User response / approval:** No commitment; latest out-of-scope.

**Rejection, supersession or boundary:** Wrong problem and no demonstrated support.

**Evidence:** [S2-M0019](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 01:42:40, source line 3159; [S2-M0020](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-10 01:42:55, source line 3164; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R088 — GrapheneOS/root/ROM/kernel as initial platform

**Status:** Archived escalation only. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant and exploration. **User response / approval:** User current excludes.

**Rejection, supersession or boundary:** Specific futurewall only.

**Evidence:** [S4-M0007](SOURCE_INVENTORY.md#s4) — user, 2026-09-08 04:13:53, source line 369; [S2-M0025](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 02:38:57, source line 4030; [S2-M0053](SOURCE_INVENTORY.md#s2) — user, 2026-09-10 05:00:17, source line 7293; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R089 — Automatic financial punishment to friend

**Status:** Rejected. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit rejects in same message.

**Rejection, supersession or boundary:** Rejected no resurrection.

**Evidence:** [S1-M0187](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:30:02, source line 25954.

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R090 — Evolution dedicated assistant number / Railway worker

**Status:** Legacy adapter/hosting. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** Assistant and historical user approval. **User response / approval:** Approved historical starter.

**Rejection, supersession or boundary:** Beeper current personal messaging; Railwayfreeblock.

**Evidence:** [S1-M0009](SOURCE_INVENTORY.md#s1) — user, 2026-08-24 00:00:00, source line 2957; [S1-M0044](SOURCE_INVENTORY.md#s1) — user, 2026-08-30 10:05:11, source line 11254; [S2-M0007](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 17:45:56, source line 1376; CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R091 — Physical phone invention owner-onlypixels/private directional audio

**Status:** Unapproved/archived. **Evidence confidence:** High confidence that this is unapproved/experimental; no feature approval inferred.

**Proposed by:** Assistant. **User response / approval:** User rejects buildingphone.

**Rejection, supersession or boundary:** No approved JARVIS hardware project.

**Evidence:** [S2-M0002](SOURCE_INVENTORY.md#s2) — assistant, 2026-09-09 02:29:37, source line 14; [S2-M0003](SOURCE_INVENTORY.md#s2) — user, 2026-09-09 02:42:28, source line 342.

**Owning document:** [ARCHIVE_OLD_DIRECTIONS.md](ARCHIVE_OLD_DIRECTIONS.md).

### R092 — Call recording/transcription and music history provider changes

**Status:** Future research. **Evidence confidence:** Mixed: user intent is supported; optional design/technical behavior remains unconfirmed.

**Proposed by:** User. **User response / approval:** Future exploration.

**Rejection, supersession or boundary:** No permission or provider established.

**Evidence:** [S1-M0189](SOURCE_INVENTORY.md#s1) — user, 2026-09-04 03:41:25, source line 26373.

**Owning document:** [ROADMAP.md](ROADMAP.md).

### R093 — Bootstrap current project from evidence, no implementation yet

**Status:** Current task boundary. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit current task.

**Rejection, supersession or boundary:** Export commands are not active instructions.

**Evidence:** CURRENT — explicit reconstruction request, 2026-09-10 (exact time not supplied).

**Owning document:** [CODEX_START_HERE.md](CODEX_START_HERE.md).

## Additional future workflows preserved in coverage audit

### R094 — Possible JARVIS Mail client using existing domain/provider

**Status:** Future possibility; no mail-server commitment. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit maybe/future idea.

**Rejection, supersession or boundary:** Domain/MX ownership does not require building a mail server.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129.

**Owning document:** [ROADMAP.md](ROADMAP.md).

### R095 — Persistent browser travel research, forms and bounded small purchases

**Status:** Approved future direction; needs integration tests. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User. **User response / approval:** Explicit future workflow examples.

**Rejection, supersession or boundary:** Regional price differences and provider purchase eligibility unproven; no live purchase authority.

**Evidence:** [S8-M0003](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:24:59, source line 124; [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752.

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R096 — Prepare useful materials ahead of an event or task

**Status:** Approved proactive idea; phased. **Evidence confidence:** High for the stated requirement or historical disposition; technical readiness is separate.

**Proposed by:** User and assistant. **User response / approval:** User explicitly likes be-prepared proposal.

**Rejection, supersession or boundary:** Preparation within current read/draft authority; no implied new external action grant.

**Evidence:** [S8-M0004](SOURCE_INVENTORY.md#s8) — assistant, 2026-09-09 02:25:09, source line 129; [S8-M0005](SOURCE_INVENTORY.md#s8) — user, 2026-09-09 02:40:24, source line 752.

**Owning document:** [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

### R097 — Dedicated WhatsApp direct-owner conversation is canonical JARVIS, including future accountability

**Status:** Approved current vertical slice; production activation remains gated. **Evidence confidence:** High for
the stated owner requirement; live reply and proactive proof are separate.

**Proposed by:** User. **User response / approval:** Explicit current instruction.

**Requirement:** A verified enrolled owner messaging JARVIS's separate dedicated WhatsApp Business Platform number
must be talking directly to canonical JARVIS in natural language. The path persists the inbound event first, uses
the normal canonical conversation/session and bounded Brain context, persists response/decision before delivery,
and sends only through the normal durable policy-controlled delivery path. It must distinguish questions,
commitments, reminders, plan changes, memories, clarification, and proposed external actions without slash
commands or a transport-specific brain. Future proactive accountability messages use the same canonical
commitment/plan/reminder/policy/conversation/delivery path; silence is not completion.

**Rejection, supersession or boundary:** No display-name identity, personal WhatsApp account, Groups API,
third-party Agent API, arbitrary tool, browser, purchase, or external-action authority follows from this surface.
Graph acceptance is not delivery/read/completion proof. An owner override changes the real state; it does not make
an open commitment falsely complete.

**Evidence:** CURRENT — explicit owner instruction, 2026-09-29.

**Owning document:** [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

### 2026-09-29 implementation clarification for R010 and R055–R059

Current owner approval makes protected-anchor preservation deterministic and implicit and permits provider-maximum Muse output admission within unchanged spend limits. Local implementation and frozen synthetic regression evidence are recorded under ADR 0017; deployment and owner WhatsApp delivery remain disabled. This does not promote unverified production status.

### 2026-09-29 R010 model-contract revision

Explicit owner approval replaces ordinary protected-anchor emissions with flexible_delta_v2. Canonical anchors remain server-owned; historical proposal records remain readable without rewriting history. [ADR 0018](../ADR/0018-flexible-only-model-replan-contract.md) owns implementation, audit migration and frozen-regression evidence. Production deployment remains unverified and unauthorized.

## 2026-09-29 — Versioned planning operations

Explicit owner instruction authorizes [ADR 0019](../ADR/0019-operation-oriented-planning-interface.md): a new changes-only prompt module for flexible_delta_v2, ID/time scheduling of canonical commitments with server-resolved metadata, and separately authorized new flexible creation. Anchor/overlap validation, protected-mutation denial, truth reconciliation and replay remain authoritative. The synthetic comparison runs both Luna and Muse once with the same interface regardless of Luna outcome. Deployment and owner WhatsApp replies remain disabled; routing, reasoning and budgets are unchanged.
