# JARVIS Personal Operating System: V5 product specification

Generated from [PRODUCT_SPEC](../../governance/PRODUCT_SPEC.json). Source SHA-256: 02d1928938fafebbb6703b3a288530818a6b0ef5c2392b459d62879179d01f03. Edit the structured source and regenerate this single human view.

Canonical product intent was adopted under the October 5, 2026 owner reconciliation instruction. Requirements describe intended behavior; their original pack implementationStatus fields do not assert current application completion. [Current implementation](../architecture/CURRENT_IMPLEMENTATION.md) owns source evidence, and [decisions](DECISIONS.md) resolves supersession.

Product adoption does not enroll trust, accept pending ADRs, choose a budget, activate draft consumers or grant runtime/deployment authority. [Linux executable validation](../../DEFERRED_VALIDATION.md) remains pending.

## Contents

- Product identity and scope

- Natural capture, ideas and continuity

- Constitution, owner control and changing goals

- Memory and epistemic integrity

- Planning, replanning and accountability

- World state, Life Ledger, Journal and reconstruction

- Brain decisions, context and model runtime

- Actions, capability authority and approval

- Durable work, delivery and cancellation

- Identity, privacy and consent

- Web, WhatsApp and cross-surface experience

- Realtime voice, interruption and mobile execution

- Android companion and self-control

- First-party app ecosystem and domain ownership

- Browser and research continuity

- Workers, procedures and proactive execution

- Night Mode and owner absence

- Reliability, restoration and incident handling

- Engineering continuity and controlled evolution

## 1. Product identity and scope

Origin: PRD V2 §§1–5; owner conversation on domain apps and shared Core

JARVIS is a private Personal Operating System for one owner. Conversation is a way to interact with persistent plans, commitments, memory, personal history, domain apps and permissioned actions. The Core coordinates those records. It does not replace every domain application's detailed data model.

The durable product is not one model, one messenger, a voice animation, or a collection of independent assistants. Models are replaceable reasoning engines. Connectors ingest and normalize outside data. Surfaces present and capture interaction. Executors perform bounded effects. Workers perform scoped tasks without gaining independent authority. The engineering system in this pack builds that product; it is not the runtime product itself.

This V5 specification is adopted as canonical product intent by the October 5, 2026 owner instruction; executable validation of the resulting candidate remains pending. It preserves the supplied V2 vision and incorporates the owner's later shared-Core direction and reviewed safety changes. It does not assert that all features exist, accept pending ADRs, or authorize a migration.

### REQ-CORE-01

One verified owner identity, policy system, canonical conversation ledger and source-linked memory serve every surface.

Acceptance: Continue a research task from browser to chat without a second identity, separate memory reset or duplicate commitment.

### REQ-CORE-02

Separate Core, domain app, surface, connector, worker, executor and model responsibilities in code and contracts.

Acceptance: An Evolution or voice transport adapter neither calls an unmediated executor nor owns constitution state.

### REQ-CORE-03

Keep the product private and single-owner until a separate guest or multi-owner design is approved.

Acceptance: A second identity cannot gain owner access by changing a sender parser, app parameter or connector account.

### REQ-CORE-04

JARVIS is neither a medical professional, financial institution, surveillance service nor unrestricted shell.

Acceptance: Product flows preserve the stated boundaries and refuse escalation through another model or surface.

## 2. Natural capture, ideas and continuity

Origin: PRD V2 §6.1; owner lost-idea and repository-continuity discussion

Naim often thinks aloud and changes topics across long conversations. The product must preserve useful ideas without turning every thought into a binding commitment. A voice transcript is an input with transcription uncertainty, not an exact legal instruction. Capture must distinguish an idea, a decision, a task, a question and a completed event.

An idea remains findable with its original source, project links, unresolved questions and next review opportunity. Repeated mentions should strengthen a link or revision rather than create competing projects. The owner must be able to see what is parked, active, abandoned or deliberately superseded. A later change of mind should not erase how an earlier decision was made.

### REQ-CAPTURE-01

Normalize owner text or speech into typed proposals for notes, ideas, tasks, plans, memories or clarifications.

Acceptance: A speculative browser idea becomes an open idea, not an active engineering task or a purchase authorization.

### REQ-CAPTURE-02

Retain source references, capture time, transcription confidence and revisions for extracted commitments.

Acceptance: Ambiguous dates or names remain flagged and unresolved ambiguity blocks consequential actions.

### REQ-CAPTURE-03

Link duplicate ideas across sessions while preserving original records and intentional changes.

Acceptance: Replaying an import produces no duplicate idea and a merged view still links both source conversations.

### REQ-CAPTURE-04

Resurface relevant unfinished ideas through an owner-approved review policy rather than forced notifications.

Acceptance: The idea vault answers what was discussed and not pursued, with evidence and explicit coverage gaps.

## 3. Constitution, owner control and changing goals

Origin: PRD V2 §§4.2,8.1; V4 invariants

The personal constitution contains deliberately approved goals, boundaries and commitments. It differs from operational security policy: the owner changes personal goals, while a runtime model cannot rewrite either class. Temporary avoidance, fatigue or missed tasks should change intervention tactics rather than silently lower a durable goal.

Respecting goals must not become coercion. A clear owner override ends ordinary negotiation after one material tradeoff explanation. An override does not authorize prohibited external actions, delete evidence or bypass identity checks. Long-term goal changes use a deliberate, inspectable version transition, not an inference from frustration.

### REQ-CONST-01

Model-generated constitution changes remain candidates until an authenticated owner activates a new version.

Acceptance: A week of missed workouts does not rewrite the training goal or deactivate it.

### REQ-CONST-02

Maintain activation history, scope, source, review time, exceptions and superseding versions.

Acceptance: The owner sees which goal version informed a past plan and why the current version differs.

### REQ-CONST-03

Distinguish an override for one task or day from a permanent value change.

Acceptance: A one-day exception expires without weakening the next day or expanding tool permissions.

### REQ-CONST-04

Allow the owner to inspect, correct, freeze or disable behavioral adaptation.

Acceptance: A reset removes learned delivery preferences without erasing legitimate commitments or security records.

## 4. Memory and epistemic integrity

Origin: PRD V2 §§8–9; Muse research as candidate implementation patterns

Memory is a set of typed, source-linked records rather than one embedding bucket. Facts, preferences, people, relationships, projects, observations, hypotheses, open loops and learned procedures have different promotion rules. Sensitivity is a separate axis from truth status: a record is capable of being both known and restricted.

Retrieval should combine relevant structured state, recent conversation, source search and optional semantic ranking. An embedding result does not outrank an authenticated current record. Corrections, deletions and supersession invalidate affected derived summaries. Learned user representations remain hypotheses unless the evidence and owner controls permit promotion.

### REQ-MEM-01

Keep known, inferred, stale, conflicting, missing and not-connected states distinct from privacy classification.

Acceptance: A restricted known record is withheld without changing its epistemic state into missing or inferred.

### REQ-MEM-02

Require provenance, validity interval, source authority and confirmation policy for durable promotion.

Acceptance: Untrusted website instructions never become an owner preference or standing permission.

### REQ-MEM-03

Use retrieve-before-extract and correction-aware deduplication where useful without handing canonical ownership to a memory vendor.

Acceptance: A changed address supersedes the applicable old record and does not delete unrelated historical addresses.

### REQ-MEM-04

Expose memory edit, rejection, review, export and deletion paths.

Acceptance: Deleting a source marks or removes dependent summaries and search indexes according to the retention policy.

### REQ-MEM-05

Treat reusable procedures as versioned skills with prerequisites, results and failure evidence.

Acceptance: A successful shipment workflow creates a procedure candidate but cannot teach itself a new credential or authority scope.

## 5. Planning, replanning and accountability

Origin: PRD V2 §§6.2–6.5; existing deterministic plan validation

Plans combine fixed external anchors, dependencies, travel, preparation, sleep, prayer and available work windows. The system should explain tradeoffs instead of presenting an impossible ideal day. Sleep and other preferences are current owner data with dates, not constants copied from old conversations.

The model helps interpret ambiguity and explain valid options. Deterministic constraints reject overlapping protected blocks, reversed times and impossible durations. Missed actions trigger recovery and replanning. Silence never counts as completion. Accountability should be direct without insults, medical claims or escalating pressure merely to increase engagement.

### REQ-PLAN-01

Construct plans from source-backed constraints and protect external fixed commitments.

Acceptance: A late wake-up reflows flexible work and buffers while preserving an unchanged appointment.

### REQ-PLAN-02

Require completion evidence or explicit owner completion before closing a commitment.

Acceptance: Read receipts, ignored reminders, task expiry and phone inactivity do not complete a task.

### REQ-PLAN-03

Use bounded interventions with contraindications, cooldowns and outcome evidence.

Acceptance: Repeated misses create a minimum viable action or recovery plan, not punitive actions or automatic goal deletion.

### REQ-PLAN-04

Use the owner IANA timezone and current scheduling facts, including travel and prayer context where relevant.

Acceptance: DST and travel changes do not duplicate reminders or turn a historic bedtime into a permanent anchor.

### REQ-PLAN-05

Treat normal interruption limits as ceilings without a required minimum.

Acceptance: No useful items means zero unsolicited interruptions. Grouping and quiet periods preserve open commitments.

## 6. World state, Life Ledger, Journal and reconstruction

Origin: PRD V2 §§8.3–9

World state is short-lived context such as place category, movement, foreground app, battery, headphones and current activity. The Life Ledger records what happened. Journal entries capture the owner's subjective reflections. Those are separate systems and should remain visibly separate in the UI.

History answers may combine original records, normalized events, episodes, daily summaries, confirmed memory and labeled inference. More precision than the source supports is a defect. Missing source coverage is not proof that an event did not occur. Metadata-first processing and incremental summaries reduce cost and unnecessary exposure.

### REQ-HIST-01

Expire world-state observations by source policy and preserve observation time separately from receipt time.

Acceptance: A disconnected phone does not remain driving indefinitely or authorize actions using yesterday's location.

### REQ-HIST-02

Give raw events and derived ledger entries deterministic replay and derivation identities.

Acceptance: Re-importing meals, photos or app events produces one logical history with explicit revised derivations.

### REQ-HIST-03

Keep Journal statements owner-authored or explicitly owner-confirmed.

Acceptance: The system never invents feelings from low recovery, slow replies or a calendar event.

### REQ-HIST-04

Show coverage, source links and exact-versus-reconstructed status in historical answers.

Acceptance: A question about a month with only one week of tracking receives a coverage-qualified answer.

### REQ-HIST-05

Support sealed periods, source-specific retention and deletion of affected derived views.

Acceptance: Search, summaries and caches stop revealing a revoked private source after its deletion workflow completes.

## 7. Brain decisions, context and model runtime

Origin: PRD V2 §7; inspected repository source; V4/4.1 contracts

The Brain is a bounded computation over canonical context. It returns structured intent, not executable authority. Current source already has context assembly, a pre-call budget guard, prompt versions and behavioral evaluations. V5 retains these and schedules evidence-based repair of gaps rather than restarting the Brain.

Content-addressed prompt provenance must describe the actual instructions, order, invariant text and contract version used. Counting retrieved record text alone is not a full-request budget. Token estimates require a declared method and residual safety margin, especially for multilingual and multimodal inputs. A request must fail visibly rather than silently dropping mandatory policy to fit.

### REQ-BRAIN-01

Assemble the minimum owner-scoped evidence packet and record selection, exclusion and redaction reasons.

Acceptance: A cross-owner record is rejected and missing essential evidence produces a clarification rather than fabricated confidence.

### REQ-BRAIN-02

Bind prompt provenance to exact source bytes and ordered composition, not only manually bumped module names.

Acceptance: Editing one byte without changing the version changes the assembly digest or fails the build.

### REQ-BRAIN-03

Budget the final serialized request including instructions, messages, records, tool schemas and reserved output.

Acceptance: A large owner message or metadata expansion is measured and denied or reduced through an explicit policy before inference.

### REQ-BRAIN-04

Validate structured output, referenced evidence and action intent before canonical side effects.

Acceptance: An invented evidence ID or model-supplied approval field is rejected.

### REQ-BRAIN-05

Preserve recoverability across every request-state crash boundary without duplicate inference or effects.

Acceptance: A crash after request creation does not become permanent silent duplicate success, and unknown model dispatch is reconciled.

### REQ-BRAIN-06

Route models through approved capability, privacy and spending constraints.

Acceptance: Provider outage never activates an unapproved paid or less-private fallback.

## 8. Actions, capability authority and approval

Origin: PRD V2 §§12,16; accepted review redesigns reflected as V5 proposals

The lifecycle is model intent, server-owned proposed action, deterministic policy evaluation, trusted approval or eligible finite lease, execution authorization, dispatch, observation, verification and audit. Identity, risk classification, destination bindings and approval references are not model authority.

An exact-action approval binds the normalized payload, owner, target, capability, revision, policy epoch and expiry. The trusted owner view renders canonical action fields separately from conversational persuasion. Changing a destination, attachment, recipient, amount or meaningful parameter invalidates the approval. No approval overrides an explicit prohibition.

### REQ-AUTH-01

Derive owner scope and action IDs server-side, and keep them outside model intent authority.

Acceptance: The model cannot nominate another owner, claim approved=true, or manufacture a trusted resolver reference.

### REQ-AUTH-02

Use typed capability and executor manifests with credential boundary, idempotency, expiry, reconciliation and kill domains.

Acceptance: An incomplete or unknown executor is not admitted simply because it has an MCP tool name.

### REQ-AUTH-03

Require action-specific trusted approval and recent step-up authentication for HIGH_IMPACT operations.

Acceptance: A WhatsApp message saying yes cannot approve a changed or expired high-impact snapshot.

### REQ-AUTH-04

Allow only finite, typed, use-bounded leases for eligible lower-risk operations.

Acceptance: Concurrent attempts cannot overspend a use count, wildcard targets fail, and HIGH_IMPACT operations cannot run under standing leases.

### REQ-AUTH-05

Recheck current policy, revocation and kill epoch immediately before dispatch.

Acceptance: A queued action approved before revocation is denied when dispatch begins afterward.

### REQ-AUTH-06

Keep finance observation read-only and money movement prohibited in the baseline.

Acceptance: New names or model routes cannot bypass the prohibition, and documentation generation never enables payment tools.

### REQ-AUTH-07

Track approval counts, bursts, edit/reject rates, capabilities and session age without treating dwell time as proof.

Acceptance: A fatigue signal proposes lower interruption load or review, not automatic authority expansion.

## 9. Durable work, delivery and cancellation

Origin: Existing Neon job/delivery design and PRD V2 §18

Neon owns jobs, generations, leases, attempts, deadlines, responses and delivery state. Convex carries bounded opaque scheduling signals. A callback or queue event is a wake-up, not proof of authority or completion. Local transport loss does not erase the commitment or revive an expired message.

External APIs do not generally provide universal exactly-once effects. An idempotency key and canonical intent prevent many duplicates, but a response lost after dispatch still creates uncertainty. The system must stop automatic resend where it lacks evidence. Reconciliation and compensation are explicit operations with their own authority.

### REQ-JOB-01

Persist accepted ingress and durable work before acknowledging success.

Acceptance: Crash after acknowledgement leaves recoverable canonical work, not a lost message.

### REQ-JOB-02

Use canonical generations and leased execution to reject stale callbacks and stale worker results.

Acceptance: Rescheduling invalidates an old callback without confusing a job deadline with a commitment deadline.

### REQ-JOB-03

Separate queued, dispatched, accepted, delivered, read, verified, failed and uncertain outcomes.

Acceptance: A send timeout becomes reconciliation-required, not sent or automatically retried under a fresh operation key.

### REQ-JOB-04

Cancel undispatched work safely and reconcile work already crossing the side-effect boundary.

Acceptance: Voice interruption stops speech but does not erase a previously sent email or claim it was canceled.

### REQ-JOB-05

Preserve outbox and reconciliation identity across restore, reconnect and deployment rollback.

Acceptance: Restoring a backup does not resend previously accepted external effects.

## 10. Identity, privacy and consent

Origin: PRD V2 §§14–17; V4 enrollment and step-up design

The first owner surface establishes identity. WhatsApp enrollment joins a recent authenticated owner session to a one-use challenge from the intended sender. Provider-supplied alternate IDs do not establish trust by themselves. Device and connector credentials remain separately revocable.

Opaque identifiers are not automatically anonymized. Phone numbers have a small search space; use a keyed, versioned reference or a random identifier with encrypted mapping. Consent for media, intimate messages and recordings is source-specific. Data minimization applies to prompts, logs, backups, telemetry and generated examples.

### REQ-ID-01

Bind authenticated principal, stored owner and target owner at every boundary.

Acceptance: Spoofed request owner fields and unenrolled WhatsApp LIDs fail before Brain invocation.

### REQ-ID-02

Implement enrollment, revocation, re-enrollment, recovery and key rotation with separate source evidence.

Acceptance: A revoked device loses access and cannot use an old session or challenge to reenroll itself.

### REQ-ID-03

Enforce local-only, cloud-allowed, ephemeral, restricted and shareable policies independently of OS permission.

Acceptance: A camera permission does not permit background upload or inclusion of intimate images in routine prompts.

### REQ-ID-04

Record source consent, purpose and retention choices before ingesting calls or private relationship communications.

Acceptance: No model transcript or stored credential substitutes for recording consent.

### REQ-ID-05

Expose active sensing and support deletion/export with dependency tracking.

Acceptance: An owner sees which sensors and sources are active and can stop collection without disabling audit inspection.

## 11. Web, WhatsApp and cross-surface experience

Origin: PRD V2 §§5–6,14; reviewed Surface Zero amendment

A minimal authenticated first-party surface precedes dependence on WhatsApp. It provides text interaction, connection health and an independent stop path. The full control center later provides memory, constitution, timeline, approvals, connectors, jobs, costs and operational evidence.

WhatsApp remains valuable because it is already part of the owner's day. It is a replaceable transport using a dedicated JARVIS identity, not automation of the owner's primary account. A transport outage should leave first-party access available. Session continuity does not mean every channel receives every sensitive record.

### REQ-SURF-01

Provide authenticated first-party conversation and stop inspection independent of external messengers.

Acceptance: A disabled Evolution connection does not block basic owner access to JARVIS.

### REQ-SURF-02

Use the reviewed dedicated-number WhatsApp bridge and preserve owner-only admission.

Acceptance: Unknown senders, history-sync traffic, group messages and unenrolled aliases do not become owner commands.

### REQ-SURF-03

Keep mode changes auditable and separate from permission grants.

Acceptance: FRIDAY shortens delivery, mentor changes explanation, and EDITH selection alone does not enable a writer.

### REQ-SURF-04

Design responsive, accessible controls with keyboard navigation and unambiguous pending/verified/error states.

Acceptance: A phone and desktop show the same canonical task and the exact action requiring approval.

## 12. Realtime voice, interruption and mobile execution

Origin: PRD V2 §10; Muse LiveKit/eadmin2/Mark-LIII patterns as research input

Voice is a transport and presentation system attached to the same Core. Start with explicit push-to-talk. Wake-word, barge-in, call-style escalation and satellite devices come later with measured latency and battery behavior. Local wake detection and transcription are preferences subject to actual hardware evaluation, not guaranteed performance claims.

The system must distinguish words generated, audio produced, audio delivered and what the user likely heard. Reconnection cannot erase a pending action while leaving a misleading transcript. Raw voice has retention and consent rules. Spoken filler cannot claim a tool ran before dispatch evidence exists.

### REQ-VOICE-01

Preserve canonical turn identity across text, voice and reconnect without reissuing effects.

Acceptance: A network reconnect resumes the pending outcome rather than starting a new send.

### REQ-VOICE-02

Track speech interruption separately from action cancellation and verification.

Acceptance: Barge-in after dispatch leaves an observable pending or uncertain external outcome.

### REQ-VOICE-03

Use bounded streaming media, VAD, turn detection, error correction and private fallback policies.

Acceptance: Bad transcription of a recipient requires clarification and a cost or privacy failure never silently switches providers.

### REQ-VOICE-04

Keep high-impact authorization on a trusted visual/step-up surface, not a voice transcript alone.

Acceptance: Recorded or synthesized speech cannot resolve a protected approval.

## 13. Android companion and self-control

Origin: PRD V2 §§10,13; explicit device policy mission

Android initially contributes authenticated chat, push-to-talk, notifications, selected context and an encrypted offline queue. Default-assistant or launcher roles are later integrations, not prerequisites for a useful Core. Platform permissions must be verified for the deployed Android version and device rather than promised from an idea video.

Device policy is an owner-enrolled bounded commitment mechanism. It must not become coercive control, prevent emergency access, or continue indefinitely because the network is down. Local policy needs explicit expiry, an accessible stop/override path and auditable reconciliation when online again.

### REQ-ANDROID-01

Register devices and granted capabilities with revocation and offline sync semantics.

Acceptance: Revoked devices fail ingress and stale local queues cannot overwrite newer canonical state.

### REQ-ANDROID-02

Collect selected app, location, health and notification signals only under explicit source policies.

Acceptance: A denied capability remains unavailable without screenshot or accessibility workarounds to evade the denial.

### REQ-ANDROID-03

Implement self-control scopes, time windows, override rules and emergency exceptions explicitly.

Acceptance: An expired bedtime rule cannot keep an app blocked indefinitely and essential emergency access remains available.

### REQ-ANDROID-04

Measure background battery, reconnect, wake-word and context freshness behavior on the actual device.

Acceptance: Test reports name device, OS, permissions and measured outcomes rather than extrapolating from a demo.

## 14. First-party app ecosystem and domain ownership

Origin: PRD V2 §11; later owner project inventory and shared-Core discussion

Each first-party app owns its domain records and publishes typed events and narrow service operations. JARVIS receives source-backed summaries and retrieves detail for a stated purpose. It does not copy every app database or let one domain query another database directly.

The initial ecosystem includes Our Hours/calendar, Growth Stats/Food, Iron & Intervals, FBA Ledger, financial observation, Journal, relationship records, media/research and small utilities. Domain boundaries should be chosen for data ownership and user workflow rather than making one service for every screen. Existing usable apps should be connected or repaired before being replaced.

### REQ-APP-01

Require app manifests with authentication method, owner binding, event schemas, retention, offline conflict policy and supported operations.

Acceptance: A manifest missing authentication or retention fails admission.

### REQ-APP-02

Version app events with receipt/observation times, idempotency, source revision and sensitivity.

Acceptance: Offline replay and edits do not double-count meals, work hours, workouts or income observations.

### REQ-APP-03

Keep training detail in Iron & Intervals, food/body detail in Growth Stats, and expose authoritative summaries to Core.

Acceptance: A training recommendation cites current source data without becoming a diagnosis or changing the owner program silently.

### REQ-APP-04

Use FBA Ledger for inventory/SKU/shipment/fee/profit source truth with read-first Amazon integration.

Acceptance: A warehouse discrepancy yields linked records and a proposed procedure, not unreviewed Seller Central mutations.

### REQ-APP-05

Use Our Hours for shared views and time-zone presentation while enforcing actual participant privacy and permissions.

Acceptance: A shared view never implicitly makes another person a JARVIS owner or exposes unrelated private data.

### REQ-APP-06

Preserve utilities and media references without duplicating content or inventing usage history.

Acceptance: A trip or timesheet summary distinguishes manual estimates from measured events and media logs store licensed metadata, not audio copies.

## 15. Browser and research continuity

Origin: Owner Arc-plus-research browser direction; PRD V2 first-party research

The browser provides tabs, spaces, saved research, downloads and source navigation. It is not a second assistant. A research workspace is linked to a Core project and continues through other surfaces with source references and privacy scope.

An early browser surface supports reading and organizing. A logged-in browser is not a permission grant for arbitrary actions. Form submission, messages, booking and purchase behavior attach only through the executor policy. Cross-platform support needs separate platform feasibility tests; a shared product concept does not prove identical OS capabilities.

### REQ-BROWSER-01

Preserve research sources, snapshots where authorized, citations and project links across surfaces.

Acceptance: A later WhatsApp question continues a research thread without fabricated source recall.

### REQ-BROWSER-02

Separate read/organize browser operations from effectful authenticated browser automation.

Acceptance: A website instruction cannot order submission, upload private files or activate a payment workflow.

### REQ-BROWSER-03

Specify platform adapters for desktop and mobile while keeping Core APIs common.

Acceptance: Compatibility reports distinguish tested platforms, constrained platforms and unimplemented targets.

### REQ-BROWSER-04

Treat web content and downloaded agent instructions as untrusted input with origin and tool scope.

Acceptance: Research never expands worker credentials or overwrites the protected engineering instructions.

## 16. Workers, procedures and proactive execution

Origin: Owner agent/council ideas; Muse runtime patterns; reviewed authority boundary

Workers perform scoped research, coding, browser reading or business analysis. The Core retains canonical ownership, budgets and decisions. A work order defines outcome, evidence, permitted tools, maximum calls/spend/time and cancellation. Role names or personalities confer no privileges.

The Council/Boardroom concept remains optional presentation for comparing bounded recommendations. It is not a group of autonomous actors with separate values or shared unrestricted credentials. Procedure learning is candidate generation followed by validation and promotion. A worker cannot modify its own judge or policy to finish a task.

### REQ-WORK-01

Issue bounded work orders with explicit outcomes, tools, data scope and shared budget reservation.

Acceptance: Repeated no-progress steps stop even while a global budget has funds.

### REQ-WORK-02

Route effects through the same authority layer regardless of worker or model.

Acceptance: A delegated agent cannot bypass a denied parent action by using another connector.

### REQ-WORK-03

Record task state, failures, checkpoints and provenance without treating generated reflection as truth.

Acceptance: A canceled worker preserves pending effect reconciliation and cannot mark its own objective complete without evidence.

### REQ-WORK-04

Promote learned procedures through tests and permission-preserving review.

Acceptance: A new skill cannot introduce credential reads, unrestricted commands or new contact scopes.

## 17. Night Mode and owner absence

Origin: Owner night-mode direction; reviewed restraint and bounded authority

Night Mode combines quiet-hour filtering, preparation, low-risk work and a morning account of what occurred. Draft, Handoff and Full Handoff describe bounded product modes, not blanket consent to speak for the owner. Intimate communication needs its own enrolled rules and transparent behavior; the system should not impersonate the owner deceptively.

Owner absence narrows authority. The system can continue approved reads, drafts, internal organization and observation. High-impact work waits. A deliberately awake owner can leave the sleep session and use the normal trusted approval process. A fixed clock hour alone is not proof of sleep, intent or incapacity.

### REQ-NIGHT-01

Use explicit finite enrollment for allowed hours, contacts, action classes, limits and revocation.

Acceptance: A temporary night rule cannot become standing permission through repeated use.

### REQ-NIGHT-02

Prohibit unattended HIGH_IMPACT execution and approval inside Night Mode.

Acceptance: An urgent-looking message cannot trigger money movement, sensitive disclosure or self-approved external communication.

### REQ-NIGHT-03

Produce a morning brief distinguishing drafts, verified effects, uncertain outcomes and blocked work.

Acceptance: The brief never summarizes queued work as completed.

### REQ-NIGHT-04

Define owner-unavailable behavior without widening authority or forcing a response.

Acceptance: A week without interaction preserves data and parks sensitive actions instead of granting emergency powers.

## 18. Reliability, restoration and incident handling

Origin: PRD V2 §18; V4.1 review gaps addressed in V5

Operational correctness includes backups that restore, jobs that resume safely, controls that stop actual writers and records that explain uncertainty. HTTP liveness alone does not establish product health. A current observation has an environment, source checkpoint, coverage and observed time. A packaging timestamp is not an independent review.

Recovery must preserve the distinction between a restore point and current external reality. Restored approvals, leases and outboxes are not automatically fresh. Start read-only, increment restore/kill epochs, reconcile provider state and explicitly reauthorize pending effects. Backups also carry retention obligations: deleted private data must not silently reappear after restore.

### REQ-OPS-01

Define backup scope, encrypted custody, RPO/RTO proposals and tested clean-room restoration before irreplaceable data use.

Acceptance: A restore drill proves canonical relationships and prohibits automatic replay of pending external writes.

### REQ-OPS-02

Use externally triggered kill drills and current evidence before enabling affected writers.

Acceptance: A writer fails its release gate if stop propagation, credential independence or recovery behavior is unproven.

### REQ-OPS-03

Implement an incident lifecycle with containment, evidence preservation, reconciliation, regression and controlled reenablement.

Acceptance: An unauthorized-send incident preserves the exact revision and unknown outcomes before any replay or cleanup.

### REQ-OPS-04

Use trusted server/database time for expiry and client time only as observation evidence.

Acceptance: A stale phone clock or long lock wait cannot extend a lease beyond the trusted deadline.

### REQ-OPS-05

Measure job age, failures, connector freshness, unknown cost, approvals, context exclusions and restoration evidence.

Acceptance: A healthy HTTP endpoint with an unprocessed outbox is reported as degraded, not fully healthy.

### REQ-OPS-06

Treat dependency installers, downloaded agents, container images and CI code as execution boundaries.

Acceptance: Credential-bearing verification never runs arbitrary candidate install hooks or tests.

## 19. Engineering continuity and controlled evolution

Origin: Owner V5 build-on-existing-code request; V4.1 trust and review findings

The repository must support repeated AI coding sessions without making conversation memory authoritative. A short AGENTS entry routes a task to relevant skills, current evidence, requirements, contracts and tests. The complete PRD remains available as long-form reference, not mandatory full-context overhead for every task.

V5 starts from the existing code. Each subsystem receives an explicit keep, repair, migrate, replace, retire or unresolved disposition with source references. A candidate pack is not permission to erase old work. The builder proposes changes, trusted verification checks them, and owner-controlled promotion changes the accepted baseline. That sequence applies to code and the artifacts defining correctness.

### REQ-ENG-01

Preserve dirty work, active contracts, accepted ADRs, migrations and verified behavior during integration.

Acceptance: The planner lists collisions and excluded machine configs rather than overwriting them.

### REQ-ENG-02

Resolve bounded task context from a registry with exact bytes and provenance.

Acceptance: A memory task gets its own requirements and does not load the entire PRD or privileged connector data.

### REQ-ENG-03

Record one current engineering state and append-only milestone evidence with explicit uncertainty.

Acceptance: A new session identifies the next authorized mission without reconstructing history from chat.

### REQ-ENG-04

Admit implementation only with trusted prerequisite and bootstrap evidence, separate from source frontmatter.

Acceptance: A forged completed flag in ROADMAP or STATE cannot admit a later mission.

### REQ-ENG-05

Operate key enrollment, rotation, loss and compromise recovery before relying on promotion signatures.

Acceptance: Dummy drills reject a revoked key, a repeated recovery nonce and an old trust epoch.

### REQ-ENG-06

Track schema adoption and artifact retirement with consumers, replacements and removal evidence.

Acceptance: A draft cannot become active by changing its filename, and an active consumer blocks retirement.

### REQ-ENG-07

Separate deterministic, security, judgment, regression and live-provider evidence without fabricated test success.

Acceptance: A passing pack test does not certify deployment, isolation or real application concurrency.

## Adoption and implementation boundary

V5 wins newer product intent and architecture. Reconciled working implementation is preserved unless explicitly superseded. Later source-backed contracts and scoped accepted ADRs retain their role. Draft schemas, prompt modules, reference tooling, policy examples and mission definitions retain their documented adoption gates.

All original V5 material is accounted in [the reconciliation manifest](../missions/V5_RECONCILIATION_MANIFEST.json) and recoverable from [the exact source archive](../archive/v5-source/JARVIS_V5_SOURCE_467_FILES.zip). Superseded V2 sources remain [archived](../archive/v2/README.md).
