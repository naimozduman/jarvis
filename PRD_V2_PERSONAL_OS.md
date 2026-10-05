# JARVIS Personal Operating System

Historical V2 proposal/source document, retained during the October 5, 2026 reconciliation. The current product-intent hierarchy is `docs/JARVIS/`, reached through `CODEX_START_HERE.md`. Proposed imports, ADR numbers, commands and authority claims here remain historical and do not adopt V5 or authorize a new implementation.

## Product Requirements Document V2

Status: Draft for owner review  
Owner: Naim  
Audience: Product owner, Codex, future implementation agents, security reviewers, and JARVIS maintainers  
Relationship to PRD V1: Extends and reframes the long-term product. It does not erase the original V1 requirements or automatically authorize code changes.

## 1. Executive summary

JARVIS is a private, single-user Personal Operating System. It combines a persistent life model, executive assistance, accountability, planning, memory, historical recall, voice interaction, device context, first-party personal apps, and a permissioned action layer.

WhatsApp is the first conversational channel, not the final product. The web control center is the first owner-visible administration surface. Android becomes the first deeply integrated JARVIS device. Future first-party apps, device agents, and restricted executors attach to the same canonical JARVIS Core.

JARVIS should know the owner's plans, commitments, people, projects, routines, goals, preferences, and historical context. It should communicate naturally, remain present without becoming noisy, challenge weak excuses, accept valid explicit overrides, replan when reality changes, and gradually earn permission to act.

JARVIS must never become an unbounded model with direct access to devices, money, messages, or shell commands. Intelligence produces structured decisions. Deterministic policy, scoped capabilities, owner authority, approvals, audit, and canonical state control every side effect.

## 2. Product thesis

Most personal assistants fail because they are primarily chat interfaces. They respond well in the moment but lack persistent commitments, reliable memory, real scheduling, contextual planning, permission boundaries, and durable follow-up.

JARVIS succeeds by treating conversation as one interface into a larger operating system.

The product thesis is:

1. Canonical state matters more than conversational recall.
2. Goals and owner-approved values must survive temporary avoidance.
3. Context should shape tactics without rewriting the mission.
4. Useful intervention requires timing, evidence, and permission, not motivational text alone.
5. Personal data becomes more valuable when it is normalized into a private timeline and connected across first-party apps.
6. The system should earn authority progressively and explain why every action was allowed.
7. The same brain should serve WhatsApp, web, Android, voice, and future devices.

## 3. User and scope

### 3.1 Primary user

JARVIS is designed for one owner, Naim. V1 and V2 are not multi-user SaaS products.

### 3.2 Product relationship

JARVIS acts as:

- executive assistant;
- accountability partner;
- planner and replanner;
- personal memory and historical retrieval system;
- journal and life timeline;
- device-aware voice assistant;
- connector and first-party app coordinator;
- restricted executor after authority is explicitly granted.

### 3.3 Product boundaries

JARVIS is not:

- a therapist or doctor;
- a financial institution;
- an autonomous money manager;
- an unrestricted browser or shell agent;
- a surveillance service for other people;
- a public chatbot;
- a replacement for owner judgment in high-impact decisions.

## 4. Core product principles

### 4.1 One brain, many surfaces

WhatsApp, web chat, Android voice, Android UI, future iPhone, desktop, and first-party apps share one identity, one canonical data model, one conversation ledger, one memory system, one permission model, and one audit history.

### 4.2 Behavior changes intervention, not mission

Missed actions may change timing, message style, minimum viable action, environment preparation, or recovery planning. Repeated avoidance must not automatically weaken or delete constitution-level goals.

### 4.3 Silence is not completion

No response may transition an item into waiting, follow-up, escalation, replanning, expiry, or review. It must never become successful completion without explicit evidence.

### 4.4 Context over rigid rules

JARVIS weighs fixed commitments, consequences, current location, travel time, sleep, recovery, available time, dependencies, owner intent, and alternatives. It does not blindly protect one domain at the expense of the entire day.

### 4.5 Internal autonomy, external restraint

Low-risk internal organization may occur automatically under policy. External communication, purchases, money movement, irreversible actions, sensitive disclosure, and device administration require stronger authority.

### 4.6 Minimum necessary data

JARVIS should receive only the context necessary for the current decision. Raw sensitive data may remain local or in a dedicated vault while JARVIS receives a bounded summary or reference.

### 4.7 Visible uncertainty

Known, inferred, stale, conflicting, missing, and unconnected information remain distinct. JARVIS asks one useful question when ambiguity materially changes the decision.

### 4.8 Owner inspectability

The owner must be able to see and correct the constitution, memory, timeline, hypotheses, permissions, devices, connectors, actions, and audit history.

### 4.9 Progressive authority

The system starts read-only and advisory. Authority expands through explicit capabilities, scopes, limits, durations, and approval rules.

### 4.10 Reversibility first

When uncertain, JARVIS should prefer reversible, lower-impact actions over irreversible actions.

## 5. Product identity and operational modes

JARVIS has one canonical identity and memory. Named modes change delivery and authority, not the underlying person or database.

### 5.1 JARVIS mode

Default chief-of-staff mode. Balanced explanation, planning, accountability, and long-term continuity.

### 5.2 FRIDAY mode

Tactical mode for driving, travel, training, deadlines, or high-pressure moments. Short answers, fast replanning, current-context priority, minimal commentary.

### 5.3 KAREN mode

Mentor mode for learning, skill development, habit formation, and reflection. More explanation, encouragement, questions, and teaching.

### 5.4 EDITH mode

Restricted executor mode. Browser actions, APIs, bookings, purchases, device controls, SSH, and other high-authority capabilities. EDITH mode requires stronger capability and approval controls. It is never the default.

### 5.5 Mode invariants

All modes share:

- the same owner identity;
- the same constitution;
- the same canonical memory and timeline;
- the same policy engine;
- the same audit system;
- the same prohibition on hidden authority escalation.

## 6. Core user experiences

### 6.1 Natural conversational capture

The owner may speak or type naturally:

- Dentist Tuesday at 2.
- Do not let me forget the Chase payment.
- Keep bothering me until this is finished.
- Move gym after work.
- Bench was 185 for six.
- I am going home for twenty minutes and then to this address.
- Remind me when I need to leave.
- I watched this movie, eight out of ten.

JARVIS converts statements into structured events, commitments, reminders, plan changes, logs, journal entries, or clarification questions.

### 6.2 Proactive executive presence

JARVIS should notice and surface:

- deadlines and bills;
- unanswered important email;
- schedule conflicts;
- travel and preparation time;
- training and recovery context;
- open loops;
- commitments at risk;
- unusual charges or duplicate subscriptions when finance is connected;
- important relationship promises;
- stale plans and unreviewed hypotheses.

Normal proactive communication should feel present but not spammy. Related information should be grouped. Critical items may bypass the ordinary message budget.

### 6.3 Accountability exchange

When the owner tries to drop an important commitment, JARVIS should evaluate:

- constitutional relevance;
- consequences;
- time remaining;
- current constraints;
- alternate windows;
- minimum viable versions;
- previous misses;
- hard overrides;
- tomorrow's protected obligations.

It should challenge once when a realistic option remains. It should not shame, moralize, or default to insults. A clear valid hard override ends ordinary negotiation after one consequence explanation.

### 6.4 Late wake-up and disruption recovery

A late wake-up, unexpected appointment, work overrun, or missed task triggers a fresh plan. Fixed external anchors and high-consequence commitments are protected first. Flexible and optional work moves, shrinks, or drops with explicit tradeoffs.

### 6.5 Ghosting

When the owner stops responding:

- low-value conversation decreases;
- commitments remain open;
- one useful check-in may occur;
- one commitment-focused follow-up may occur;
- an evening recovery/reset may occur;
- urgent deadlines may escalate under policy.

### 6.6 Voice assistant

The owner can say a wake phrase such as "Hey JARVIS" and ask:

- When is my assignment due?
- When is soccer practice?
- How long until I need to leave?
- What did I promise my professor?
- Move the gym session to tonight.
- Start navigation after I leave home.

The system should combine speech, calendar, email, location, travel estimates, preparation habits, and current commitments rather than returning a single isolated fact.

### 6.7 Historical recall

The owner can ask:

- Where was I on May 26, 2027?
- What was I doing during summer 2027?
- What music did I listen to while driving that month?
- Which movies did I love that year?
- When did this relationship conflict start?
- What was I working on before this project stalled?

JARVIS reconstructs answers from evidence in the Life Ledger, Journal, memory, connected apps, and retained source references. It distinguishes exact records from inferred summaries.

### 6.8 Owner control center

The owner can inspect:

- today and upcoming plans;
- commitments and reminders;
- Brain memory and hypotheses;
- Life Ledger and Journal;
- approvals and actions;
- devices and capabilities;
- connectors and sync health;
- model activity and costs;
- audit and security history.

## 7. JARVIS Core requirements

### 7.1 Canonical state

A JARVIS-owned canonical database stores durable state. Conversation providers, model providers, Convex, device caches, and external apps are not canonical truth.

### 7.2 Event-oriented architecture

Every meaningful observation, user message, connector update, plan change, action proposal, approval, execution, and result becomes a typed event or durable state transition with source and timestamps.

### 7.3 Brain request lifecycle

The Brain must:

1. persist the inbound event;
2. retrieve owner-scoped context;
3. assemble a bounded context manifest;
4. select versioned prompt modules;
5. choose a model route under budget;
6. receive strict structured output;
7. validate all references and action intents;
8. persist the safe decision and evidence;
9. pass actions through policy and approval;
10. create follow-up jobs and a user-visible response;
11. remain idempotent on replay.

### 7.4 Prompt architecture

Prompts are versioned modules, not one universal instruction blob. Required modules include:

- core identity;
- constitution;
- memory rules;
- accountability;
- planning and replanning;
- behavioral interventions;
- reminders and ghosting;
- communication style;
- action and tool rules;
- uncertainty;
- security;
- privacy.

### 7.5 Personality learning

JARVIS may learn bounded delivery preferences:

- message length;
- directness;
- humor;
- profanity tolerance;
- strictness;
- praise style;
- explanation depth;
- choice count;
- reminder density;
- morning/evening style.

One emotional interaction must not create a permanent preference. Traits require repeated evidence or owner review and remain editable, freezeable, resettable, and disableable.

## 8. Constitution, memory, world state, Life Ledger, and Journal

### 8.1 Personal constitution

The constitution contains owner-approved goals, rules, boundaries, promises, and standing prohibitions. Each item is versioned and auditable.

The model may propose a constitution candidate but may not activate, weaken, replace, or delete an active constitution item.

### 8.2 Structured memory

Memory types remain distinct:

- permanent facts;
- preferences;
- people and relationships;
- projects;
- observations;
- hypotheses;
- open loops;
- personality traits.

### 8.3 Ephemeral world state

Current context is temporary and may include:

- current location or place class;
- travel state;
- foreground app;
- screen lock state;
- battery and charging;
- headphones;
- current calendar block;
- active workout;
- driving state;
- local time and weather context;
- device availability.

World state expires unless promoted to the Life Ledger or another durable record under policy.

### 8.4 Life Ledger

The Life Ledger records what happened historically without claiming every event is a personal fact or preference.

It supports:

- location episodes;
- travel segments;
- app sessions;
- music listening;
- workouts;
- meals;
- photos and media references;
- movie and show watches;
- calculations;
- conversations and call summaries;
- calendar activity;
- work sessions;
- purchases and bills;
- JARVIS decisions and interventions.

### 8.5 Journal

Journal entries contain the owner's subjective reflection. JARVIS may suggest prompts based on the day's ledger, but it must not fabricate feelings.

### 8.6 Promotion rules

Life Ledger events do not automatically become memory. The memory engine may generate a candidate when evidence suggests a stable fact, preference, or pattern. The owner can confirm, reject, or leave it as an observation.

## 9. Historical reconstruction requirements

### 9.1 Query levels

Historical answers may use:

1. exact source records;
2. normalized Life Ledger events;
3. episodes and daily summaries;
4. Journal entries;
5. confirmed memory;
6. explicit inference labeled with confidence.

### 9.2 Evidence and uncertainty

Every historical answer should expose, when useful:

- source coverage;
- confidence;
- missing periods;
- whether the answer is exact or reconstructed;
- relevant source links.

### 9.3 Cost-aware reconstruction

JARVIS should avoid expensive analysis on every raw record. It should:

- extract metadata first;
- cluster events;
- create episodes;
- analyze representative media;
- summarize daily and monthly periods incrementally;
- run deeper reconstruction only when asked.

## 10. Voice and Android requirements

### 10.1 Android companion

The Android app initially provides:

- authenticated text/voice conversation;
- push notifications;
- current-day view;
- location events;
- Health Connect integration;
- device status;
- offline queue;
- encrypted local storage.

### 10.2 Default assistant phase

A later Android phase may become the selected assistant and support:

- local wake-word detection;
- streaming speech recognition;
- voice activity detection;
- personalized vocabulary correction;
- barge-in and interruption;
- streaming text-to-speech;
- call-style escalation;
- hands-free navigation and planning.

### 10.3 Device context

Android may expose explicitly granted signals such as:

- app usage duration;
- notification metadata;
- local blocking events;
- location;
- health and fitness records;
- media playback metadata;
- connectivity and battery;
- device policy state.

### 10.4 On-device processing

Sensitive or high-volume processing should occur locally when practical, including:

- wake word;
- domain/category blocking;
- foreground-app classification;
- basic media metadata;
- local privacy filters;
- raw call/audio handling where legally and explicitly enabled.

## 11. First-party app ecosystem

JARVIS should expose a first-party SDK and data contracts so personal apps become clients of the same core rather than isolated products.

Candidate apps include:

- JARVIS Journal;
- JARVIS Calendar;
- JARVIS Food;
- Iron & Intervals / training;
- JARVIS Movies;
- JARVIS Calculator;
- Relationship Vault;
- Media and music history;
- research and reading;
- device-control app;
- Android assistant.

All first-party apps share owner identity, canonical event logging, offline sync, encryption, permissions, and audit.

## 12. Capability and authority requirements

### 12.1 Capability registry

Every client, device, connector, and executor declares supported capabilities, such as:

```text
location.read
health.sleep.read
notifications.metadata.read
maps.route.prepare
apps.social.suspend
email.read
email.send
browser.navigate
browser.purchase
payment.charge
ssh.inspect
ssh.execute
```

### 12.2 Permission layers

Technical permission is not authority. The system separates:

1. platform or OS permission;
2. registered JARVIS capability;
3. owner authorization policy;
4. action-specific approval when required.

### 12.3 Permission leases

Authority may be:

- one time;
- for a time window;
- for the current activity;
- for a named project;
- under an amount limit;
- limited to a merchant or recipient;
- standing until revoked.

### 12.4 Authority ledger

Every side effect records why it was allowed:

- actor;
- device/executor;
- capability;
- owner rule or approval;
- scope;
- limits;
- start and expiry;
- result;
- rollback status.

### 12.5 Reversibility metadata

Every action type declares:

- impact;
- risk;
- reversibility;
- rollback mechanism;
- approval requirement;
- freshness/expiry;
- data sensitivity.

## 13. Commitment devices and self-control

JARVIS may support graduated intervention levels:

1. remind and explain;
2. increase friction;
3. temporarily block an app/site;
4. require explicit override and reason;
5. notify an approved accountability person;
6. execute a separately enrolled bounded commitment contract.

Autonomous punitive money movement is prohibited by default. A future financial commitment mechanism would require a separate product/security review, fixed caps, grace periods, explicit enrollment, clear cancellation, and no emotional model discretion.

## 14. Web control center requirements

The owner-only web app should include:

- Today dashboard;
- canonical chat mirror;
- Brain and memory editor;
- constitution editor;
- Life Ledger and Journal;
- projects and commitments;
- plans and calendar;
- approvals;
- capabilities and authority ledger;
- devices;
- connectors;
- activity and audit;
- privacy and retention;
- model/cost controls;
- operational health.

Authentication should be owner-only, preferably passkey/WebAuthn with trusted-device and session management. There is no public registration.

## 15. Connector and external data requirements

### 15.1 Email and calendar

Gmail starts read-only. Calendar may create or update approved JARVIS-owned flexible blocks while preserving fixed external events.

### 15.2 Health

Health data may come from Health Connect, Apple Health/HealthKit, WHOOP, Oura, training apps, or first-party apps. JARVIS does not make unsupported medical claims.

### 15.3 Finance

Finance remains read-only until a separate authority review. Account data, balances, bills, subscriptions, and duplicate charges may inform reminders. Money movement remains prohibited.

### 15.4 Media and music

Music and media history should use provider interfaces and local now-playing signals. JARVIS stores normalized listening events and source references, not copyrighted audio.

### 15.5 Relationship and communications vault

Raw intimate communications may remain in a dedicated encrypted source. JARVIS should receive summaries, commitments, unresolved topics, and source references based on owner policy. Deeper retrieval requires explicit purpose and authority.

### 15.6 Calls and recordings

Call recording/transcription requires explicit consent controls and jurisdiction-aware implementation. Raw recordings should remain local or in a dedicated encrypted archive by default.

## 16. Executor and EDITH requirements

A future executor layer may perform:

- browser navigation;
- forms;
- bookings;
- ride requests;
- purchases;
- APIs and MCP tools;
- SSH inspection or commands;
- device administration.

Executor requirements:

- capability allowlist;
- isolated credentials;
- sandboxing;
- dry-run/preview;
- deterministic policy;
- approval and spending limits;
- idempotency;
- evidence and screenshots where appropriate;
- result verification;
- audit;
- rollback where possible;
- emergency kill switch.

The model never receives raw payment credentials or unrestricted shell authority.

## 17. Privacy, security, and retention

### 17.1 Data locality classes

Every source or record may be classified as:

- local_only;
- cloud_allowed;
- memory_allowed;
- ephemeral;
- restricted;
- shareable_with_approval.

### 17.2 Retention tiers

Example policy:

- high-resolution raw sensor data: short or configurable retention;
- compressed timeline episodes: long-term;
- important events and journal entries: long-term;
- raw media: source storage with references;
- sensitive communication archives: dedicated policy;
- derived memories: reviewed and versioned.

### 17.3 Encryption

Sensitive credentials and high-risk data require encryption at rest and in transit. Connector secrets must never live in ordinary plaintext columns or logs.

### 17.4 Deletion and export

The owner can export and delete data by source, date range, person, domain, or entire system. Derived records should preserve provenance so deletion can cascade safely.

### 17.5 No hidden surveillance

JARVIS must clearly indicate active sensors, permissions, local blockers, recordings, and retained history. It may not silently record other people or upload private content merely because an OS permission exists.

## 18. Nonfunctional requirements

### 18.1 Reliability

- durable idempotent jobs;
- provider reconciliation;
- no duplicate external effects;
- bounded retries;
- explicit degraded states;
- canonical recovery after device or transport outages.

### 18.2 Latency

- text acknowledgement should feel immediate;
- voice should stream and allow interruption;
- deterministic work should happen before model calls;
- deep historical reconstruction may take longer and report progress.

### 18.3 Cost control

- free-tier and hard-spend guards where applicable;
- provider-neutral model routing;
- metadata-first media analysis;
- incremental summaries;
- no silent billable fallback.

### 18.4 Auditability

Every meaningful decision or side effect records trigger, selected context, model/prompt version, policy result, authority source, action, external result, and follow-up.

### 18.5 Portability

The canonical data model and first-party SDK should avoid locking core state to WhatsApp, Vercel, Convex, Neon, one phone OS, or one model provider.

## 19. Success metrics

### 19.1 Usefulness

- fewer missed deadlines and bills;
- increased completion of protected commitments;
- faster recovery after disrupted days;
- accurate historical recall;
- fewer manual context switches among apps.

### 19.2 Trust

- low false-completion rate;
- no unauthorized external action;
- clear explanations and audit trails;
- corrections persist;
- owner understands why JARVIS acted.

### 19.3 Interaction quality

- messages feel timely and personal;
- challenge level matches owner preference;
- voice interaction feels natural;
- low repetition and noise;
- appropriate emotional tone without pretending to be human.

### 19.4 System quality

- idempotent processing;
- deterministic policy coverage;
- connector recovery;
- secure credential handling;
- bounded cost;
- clean source provenance for historical answers.

## 20. Rollout strategy

The implementation should expand through reviewed phases:

1. complete current cloud runtime and orchestration;
2. perform first real structured Brain model probes;
3. connect WhatsApp through the reviewed transport path;
4. use JARVIS in real daily life and tune the Brain;
5. build the owner-only web control center;
6. add Gmail and Calendar;
7. add Life Ledger and Journal foundations;
8. define Personal OS Core V2 capabilities, authority, device protocol, and world state;
9. build Android companion and voice;
10. add first-party apps and JARVIS SDK;
11. add restricted EDITH executor capabilities gradually.

## 21. Explicit non-goals for the current implementation

This PRD does not authorize the current Codex task to:

- redesign the working Brain;
- migrate databases;
- change deployment providers;
- create Android code;
- ingest gallery, relationship, or phone-call data;
- enable purchases or money movement;
- start an executor;
- pair WhatsApp;
- add new runtime secrets.

These documents record direction. Each implementation phase still requires a scoped prompt, ADR review, tests, and security gates.

## 22. Principal risks

### 22.1 Overcollection

Mitigation: locality classes, minimum necessary data, source-specific retention, owner visibility, and local processing.

### 22.2 Incorrect memory or historical reconstruction

Mitigation: typed memory, source provenance, confidence, exact-versus-inferred labels, correction workflows.

### 22.3 Excessive authority

Mitigation: capabilities, permission leases, authority ledger, risk classes, approvals, spending limits, kill switch.

### 22.4 Behavioral harm

Mitigation: intervention registry, no shaming default, explicit overrides, bounded commitment devices, no autonomous punitive financial actions.

### 22.5 Provider lock-in

Mitigation: provider-neutral ports, canonical JARVIS state, first-party SDK, source references.

### 22.6 Cost growth

Mitigation: tiered analysis, incremental summaries, on-device processing, configurable retention, provider routing and hard budgets.

### 22.7 Security breach

Mitigation: encryption, least privilege, isolated credentials, local-only sensitive sources, audit, secret scanning, rotation and revocation.

## 23. V2 acceptance criteria

The long-term V2 vision is satisfied when:

- the same JARVIS identity works through WhatsApp, web, and Android;
- the owner can inspect and correct memory, constitution, timeline, permissions, and actions;
- JARVIS reconstructs historical periods with evidence and uncertainty;
- the Android device agent supplies current context without uncontrolled surveillance;
- first-party apps feed one canonical data fabric;
- authority is scoped, temporary when appropriate, and explainable;
- high-impact actions remain controlled;
- a restricted executor performs approved tasks safely;
- the owner experiences continuity rather than retraining separate assistants.
