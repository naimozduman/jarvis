# JARVIS product requirements

Responsibility: desired outcomes, user workflows, functional and nonfunctional requirements, success criteria and boundaries. Detailed mechanisms belong to the linked subsystem documents. Source evidence and approval status are in [REQUIREMENTS_LEDGER.md](REQUIREMENTS_LEDGER.md).

Version: reconstructed 2026-09-10. “Required” below describes the intended product within the assigned phase, not a claim of existing implementation. The initial release boundary is defined by [ROADMAP.md](ROADMAP.md).

## User, problem and goals

JARVIS is initially private software for Naim. He wants an executive assistant and accountable companion that understands his life, helps him act on intentions and reduces how often he must manually operate disconnected apps. The core problem is loss of context and follow-through: repeated explanation, forgotten commitments, scattered messages, hidden deadlines, ineffective reminders and work that stops when a conversation ends.

JARVIS should know the difference between a preference, an excuse, a temporary tradeoff and a changed decision. It should challenge constructively, remain a trusted friend rather than a source of indiscriminate nagging, and honor deliberate user override. It must not optimize bad habits merely because they are frequently observed. [S1-M0001/M0003/M0181; R001–R007]

Its conversational style can gradually adapt to the owner's humor, phrasing and preference for supportive toughness, while responding appropriately when he is tired or wants quiet. This is bounded preference/pattern learning, not a requirement to retrain a model continuously or copy every observed behavior into policy. JARVIS's coherent personality belongs to the main assistant; Council members intentionally retain their separate personas.

The product goals are useful personal recall; dependable commitments and planning; fewer app/context switches; controlled delegated action; narrowly disclosed personal intelligence; affordable hybrid AI; and continuity across phone, chat, voice and desktop. A possible later public product was exploratory. Multi-tenant SaaS, a custom phone, a ROM distribution and a suite of replacement apps are not initial goals.

The early brief names Gmail email overload, Chase/Amazon Prime credit-card and Mercury debit/finance context, and the owner's Iron & Intervals training project plus a planned food-logging app. These are concrete integration targets/context from S1-M0001/M0003, not proof of present connected accounts or working bank APIs. Preserve them when prioritizing connectors; confirm current account scope and API access before enabling ingestion. Health-source options included WHOOP and Apple Health, with later direct JARVIS-native data and optional Samsung/Apple health synchronization.

## Primary workflows

| Workflow                              | Required outcome                                                                                                                   | Evidence / owner document                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Start using JARVIS                    | Prefilled, reviewable onboarding from supplied context; explicit goals and permission choices; immediate useful search/commitments | R004–R005; [Memory](CONTEXT_AND_MEMORY.md)                 |
| Begin/end the day                     | Grouped useful briefing, changed plans, urgent items and follow-up; cadence configurable rather than a message quota               | R007; [Cases](AUTOMATION_AND_CASES.md)                     |
| Ask about personal history            | Retrieve relevant original evidence across messages, files, saved screens, entities and dates; show gaps and uncertainty           | R017, R028–R033; [Memory](CONTEXT_AND_MEMORY.md)           |
| Understand a current conversation     | With permission, connect visible context to past messages/events and explain privately to the owner                                | R033–R034; [Messaging](MESSAGING_AND_HANDOFF.md)           |
| Get to practice or another commitment | Include preparation, current location, traffic freshness, stops and dwell time; replan when conditions change                      | R010; [Cases](AUTOMATION_AND_CASES.md)                     |
| Handle important email/calendar       | Extract deadlines and clear plans, draft replies, replan under standing rules; later bounded operational correspondence            | R008–R010; [Security](SECURITY_PRIVACY_AND_PERMISSIONS.md) |
| Delegate briefly                      | Configure a specific Handoff/Sleep window; bounded replies, important escalation, owner takeover and exact morning return          | R049–R054; [Messaging](MESSAGING_AND_HANDOFF.md)           |
| Return Home/use the phone             | Real default HOME with left intelligence, center apps/search and right messages while normal phone functions remain available      | R019–R027; [Home](JARVIS_HOME.md)                          |
| Speak to JARVIS                       | Local activation/commands where viable; useful conversation, interruption and honest offline/cloud state                           | R042–R044; [Voice](VOICE_AND_DEVICE_CONTROL.md)            |
| Keep a long-running matter moving     | Case persists through waiting, failure, restart and chat closure; actions and recovery remain inspectable                          | R064, R066–R070; [Cases](AUTOMATION_AND_CASES.md)          |
| Think with Council                    | Distinct specialists discuss evidence and competing priorities; owner joins; decisions become follow-through                       | R074–R080; [Council](COUNCIL_AND_BOARDROOM.md)             |

## Functional requirements

| ID   | Requirement and boundary                                                                                                            | Maturity / initial placement                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| FR01 | Maintain one owner identity, core personality, history and personal memory across surfaces; provider/OEM accounts are integrations  | Confirmed; MVP foundation                                          |
| FR02 | Onboard from known context, flag inferences, allow correction; expose memory/source/capability status                               | Confirmed; MVP                                                     |
| FR03 | Store and retrieve exact evidence, entities, time, relationships, summaries and unresolved work; do not reduce memory to embeddings | Confirmed; MVP narrow corpus, expand later                         |
| FR04 | Capture commitments, deadlines and conditional intentions; distinguish completion from reminder delivery/dismissal                  | Confirmed; MVP                                                     |
| FR05 | Produce useful grouped briefings and contextual interventions with quiet periods, reasons and override                              | Confirmed; MVP bounded rules, later richer context                 |
| FR06 | Provide default HOME, reliable local app launching, search and the three-page concept                                               | Confirmed; early thin Home, phased integration                     |
| FR07 | Ingest authorized messages/history with completeness metadata; unified search/drafts and supported reply UX                         | Confirmed; connector prototype then Phase 2                        |
| FR08 | Support bounded Handoff/Sleep Handoff and morning briefing; preserve exact internal authorship and hand back on risk/expiry         | Confirmed behavior; activation gated by Q03 and tests              |
| FR09 | Fuse notifications, usage, visible screen context, location and other opted-in signals into meaningful events with confidence       | Confirmed; selective Phase 2, advanced sources later               |
| FR10 | Support deterministic commands, selected local AI, inexpensive cloud and premium routing, Auto/manual choice                        | Confirmed; MVP gateway and progressively benchmarked routes        |
| FR11 | Enforce per-task/day/month/agent-step/time/fallback costs in code across agents/providers                                           | Confirmed; before paid autonomous use                              |
| FR12 | Separate Guardian, Firewall, Vault and action evidence; manage standing permissions without repetitive harmless-read approvals      | Confirmed; MVP foundation                                          |
| FR13 | Provide voice activation/ASR/TTS/interruption and urgent JARVIS call presentation with honest fallback                              | Confirmed; staged device prototypes                                |
| FR14 | Persist Cases, actions, reversibility/compensation and Reality Debugging evidence                                                   | Confirmed; Case core early, advanced diagnosis/undo later          |
| FR15 | Provide independent Council seats, ongoing chat and shared decision/action history; rich desktop Boardroom later                    | Confirmed; Phase 3 then advanced                                   |
| FR16 | Read financial context for balances, due bills, recurring/duplicate charges; separate recommendations from money movement           | Confirmed desire; connector-scoped later expansion                 |
| FR17 | Use health/training/nutrition context with source conflict handling; allow native future apps to feed JARVIS directly               | Strongly desired/future approved; no medical diagnosis requirement |
| FR18 | Support journal retrospectives, movie history, contextual calculations, music and wearable context when useful                      | Future desired; individual provider choices unresolved             |
| FR19 | Learn repeated work and propose tested automation with explicit tools/preconditions/outcomes                                        | Approved direction; advanced prototype                             |
| FR20 | Keep root/ROM/kernel, optional DO/Knox and network sensing outside baseline prerequisites                                           | Current architecture boundary; specific future tests only          |

Component ownership for every FR is mapped in [ARCHITECTURE.md](ARCHITECTURE.md). Optional implementation details must not silently become new product requirements.

## Nonfunctional requirements

**Reliability.** Never label an action complete merely because a model proposed it, a worker dispatched it or an API returned a generic success. Track accepted/confirmed/unknown outcomes. Prevent duplicate external effects through idempotency and reconciliation. Preserve work after restart, lost callback, process crash and connector outage. A failed reminder does not delete the underlying intention.

**Offline behavior.** Home, normal phone use, installed deterministic commands, available local speech/model tasks and cached exact search remain usable. Display cache scope and freshness. Queue safe observations/drafts/intents with limits; revalidate stale remote effects before sending. Cloud reasoning, fresh server alerts, broad server search and unavailable connectors are explicitly unavailable. Offline must not become a permission/cost bypass.

**Responsiveness and resource use.** Local app launching must not wait for the backend or LLM. Give visible progress/cancellation for slower work. Measure battery, thermals, RAM pressure and sustained behavior under navigation, calls and messaging. Battery capacity or a benchmark score alone is not acceptance. The owner values daily-phone reliability, coverage and less phone use. Numeric performance targets should be set from the device pilot, not invented as historical user decisions.

**Privacy and security.** Apply least necessary data per recipient/purpose. Keep secrets outside models. Sensitive derived data inherits restrictions. Revocation affects pending actions, caches and agent memories. The owner can inspect, correct, exclude, pause, export and delete within documented retention/backup limits. Test prompt injection and cross-agent leakage.

**Cost predictability.** Show actual and reserved spend, useful task cost and budget status. All paid paths need known pricing bounds and independent enforcement. No implicit $50 cap, unlimited premium fallback or assumption that subscription chat access includes API usage.

**Usability and accessibility.** Use clear status language, large-text/screen-reader-compatible core flows, explicit microphone/capture state, a visible Handoff stop and a recoverable route to normal Android. Avoid requiring engineering knowledge for ordinary permissions or failure recovery. Technical implementation details belong in diagnostics, not the main daily flow.

**Portability and maintainability.** Preserve portable originals/provenance and canonical records independent of one model vendor or phone brand. Use versioned schemas, adapter capability maps and documented migrations. Do not buy specialized storage infrastructure before measured scale justifies it.

## Permissions and sensitive boundaries

Permissions are progressive and feature-specific. Denial reduces the relevant feature, not the entire product. HOME, assistant, notification, usage, Accessibility, location, audio, media, calendar, VPN and managed-device capabilities remain separate. OAuth scopes, device permissions and JARVIS sending/disclosure grants are different layers.

Email starts with read/draft; later operational sending can be authorized for a task. Calendar changes can use explicit standing rules. Financial intelligence is distinct from purchase/payment authority. Handoff needs recipient/topic/time boundaries and resolved authorship policy. No agent can self-grant, expose business details to a personal chat or bypass secure unlock. No factory reset or purchase is implied by this PRD.

## Edge cases that must be designed, not ignored

Handle duplicate names/accounts, group participants changing, ambiguous dates/timezones, edited/deleted messages, disappearing content, two devices acting concurrently, stale presence, user takeover mid-send, provider timeouts after acceptance, disconnected Desktop host, missing history, sensor gaps, secure screens, permission revocation, exhausted storage/budget and restored backups containing old jobs. Each subsystem document owns the detailed response.

When an assistant suggestion conflicts with explicit user language, use the decision hierarchy in [CODEX_START_HERE.md](CODEX_START_HERE.md). Unresolved product policies belong in OPEN_QUESTIONS; unresolved API behavior belongs in a test, not a confident PRD claim.

## Acceptance and success criteria

| Scenario                  | Pass condition                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Known historical question | Correct source-backed answer or explicit bounded gap; no invented memory                                         |
| Personal correction       | Current answers and derived records use the correction; obsolete belief remains noncurrent                       |
| Useful commitment         | Captured from explicit evidence, reminded/replanned appropriately and closed only with real outcome/cancellation |
| Context boundary          | A restricted agent/recipient cannot retrieve or receive forbidden records or derived summaries                   |
| Offline day segment       | Home and permitted local functions continue; gaps/pending work are clear; no stale autonomous sends on reconnect |
| Uncertain external send   | No blind duplicate retry; reconciliation and owner-visible uncertainty                                           |
| Budget race               | Concurrent agents cannot exceed configured aggregate limits through separate reservations                        |
| Handoff                   | Ends on time/takeover, escalates within policy and produces an accurate return briefing                          |
| Council                   | Distinct perspectives/access, evidence-backed disagreement and a traced decision-to-action outcome               |
| Device daily use          | Actual phone retains Wallet/banking/camera/connectivity and acceptable measured resource behavior                |
| Recovery                  | Restore preserves records, deletions, grants and job fencing without replaying obsolete actions                  |

During pilots, measure useful commitments resolved, manual steps/app switches avoided, retrieval correctness/coverage, inappropriate interruptions, correction frequency, action failures/duplicates, battery impact and actual cost per useful workflow. Establish a baseline and compare real use. Do not substitute message volume, agent count or visual polish for user value.

## Explicit scope boundaries

No JARVIS implementation, UI redesign, deployment, account connection, purchase or phone enrollment was performed in this reconstruction. First-party food/workout/running/calendar tools are future integrations, not required replacements for every existing app. Call recording, predictive simulations, network sensing and self-built systems are experimental/future. Public release and production likeness/voice decisions are later matters. Archived phone/ROM/kernel routes cannot re-enter the active plan through an old document.
