# Passive Context Engine

Responsibility: convert authorized noisy observations into useful events. Durable knowledge belongs to [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md); action selection belongs to [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

**Product requirement, phased:** combine weak signals, preserve uncertainty, and collect enough context to reduce manual explanation without permanently recording every raw signal. S2-M0055 explored network, app, purchase and location awareness; the current request explicitly adopts the multi-signal engine. No single Android permission supplies complete awareness. [R031, R035–R041]

## Collectors and their limits

| Signal                        | Access/integration                                                         | Useful evidence                                                | What cannot be inferred reliably                                                                |
| ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Notifications                 | User-enabled Notification Listener; source app notifications               | Message previews, merchant alerts, reminders, delivery updates | Complete chat history, hidden text, every event, guaranteed interception before display         |
| Foreground app usage          | Android usage access; availability tested by version                       | App session/duration and transitions                           | Exact content read, intention, attention or every interaction                                   |
| Accessibility-visible content | Enabled service, selected apps and supported nodes                         | Visible text, labels, bounded interactions                     | Private app databases, inaccessible custom views, secure unlock or arbitrary background content |
| Screenshots                   | Deliberate share/import; optional explicitly enabled capture path          | Product/design memory, OCR, instructions, visual context       | Purchase, approval or uninterrupted invisible screen recording                                  |
| Location                      | Foreground/background permission, accuracy setting, power-aware collection | Approximate visits, trips, arrival/departure candidates        | Exact store in a mall, who was present, what was bought or consumed                             |
| Messages                      | Beeper and authorized historical imports                                   | Conversation context, commitments, plans, people               | Complete backfill or controllable presence without testing                                      |
| Calendar                      | Provider OAuth or Android calendar permission                              | Explicit plans, changes, free/busy, event metadata             | Attendance or task completion merely because time passed                                        |
| Files and saved web content   | User selection, share sheet, authorized file/browser connector             | Documents, receipt text, saved pages and URLs                  | Universal browsing history or paid/private page access                                          |
| Purchases                     | Transaction notification, email receipt, later financial API               | Merchant, amount, time and possible purchase category          | Exact item or dietary/religious behavior from merchant alone                                    |
| Device state                  | Supported battery, network, lock, motion/connection signals                | Availability and reliability context                           | Perfect knowledge while force-stopped or permissions are revoked                                |
| Optional network clues        | Local VpnService or permitted DNS metadata                                 | Domain/service/activity hints and rule-based blocking          | HTTPS page paths, message content, video title or exact purchase by default                     |

Android permission and API evidence is centralized in [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md). Every collector advertises enabled/disabled/degraded state, last observation, scope and version. Missing observations are missing data, not proof that an activity did not happen.

## Pipeline and state

1. **Capture:** create a short-lived observation with source, event ID, source time, ingestion time, device, access grant, sensitivity and freshness.
2. **Local filtering:** omit excluded applications, sensitive fields and obvious secrets; debounce repetitive UI events and coalesce notification updates. Avoid expensive image/model processing on every event.
3. **Normalize:** translate source schemas into a common vocabulary without deleting the original interpretation boundary. “Notification received” remains distinct from “purchase confirmed.”
4. **Correlate:** join likely related observations by account/provider ID, entity, time and place. Record uncertainty when a link is inferred. A bank SMS and its mirrored notification are one underlying source, not two independent witnesses.
5. **Fuse:** evaluate corroborating and contradictory evidence against the candidate event. Prefer deterministic rules for clear structures, local extraction for adequate private tasks, then allowed cloud analysis only when needed.
6. **Promote or discard:** keep meaningful events with evidence references; discard redundant raw material according to retention. A useful low-confidence candidate can remain a hypothesis instead of becoming permanent fact.
7. **Publish:** notify the personal index or Case engine only if the event changes something relevant. Collection does not automatically trigger a user interruption.

Candidate states: observed → correlated → tentative event → confirmed/corrected/dismissed. Confidence is scoped to a proposition, not a universal trust score for an app. Use qualitative labels or a calibrated probability model with recorded validation. Do not add arbitrary percentages from correlated sensors or produce totals over 100%.

Store the evidence basis, competing explanations and time window. A correction must update downstream summaries and any Case that depended on the event. The engine should be able to say “possible restaurant visit; location accuracy is low; no receipt found.”

## Examples that preserve uncertainty

**Restaurant and food log.** Location near a restaurant plus a matching merchant receipt is stronger evidence of a transaction than location alone. It may justify “Did you have lunch there?” or a draft food-log entry if the owner wants prompts. It does not justify recording a specific meal or calories. No health recommendation should be built on a guessed food intake.

**Online order.** An order-confirmation email and delivery notification can form one purchase/shipment event, linked to a project and a delivery Case. A shopping-domain connection or screenshot alone is an interest signal. If the confirmation is unavailable, leave the purchase uncertain.

**YouTube or a reel.** App usage shows an app session. An accessible title, explicit share or permitted media fetch can add content context. Network metadata alone usually identifies a service, not the exact video or what the owner thought about it. Media understanding remains a separate, budgeted capability.

**Departure for practice.** Calendar, current location and the owner's preparation routine support a leave-time recommendation. Refresh traffic through a permitted service when online; label an offline estimate. Include preparation and planned stops/dwell time instead of repeatedly reminding the owner at the appointment time. [S1-M0183]

**Self-discipline intervention.** The owner wants optional assistance aligned with personal and Islamic values. A configured category rule can prompt or block within supported capability, with a deliberate override. Viewing a domain does not establish a physical act, state of purity or religious obligation. Rules must come from the owner; sensitive religious/sexual inferences are not silently stored as facts. [S2-M0055]

**Stale Love8 state.** Detect that a source is stale, investigate sync/permissions/API refresh and explain the limitation. Repeatedly unlocking the phone to open an app is not the canonical solution. A specific permitted UI refresh can be tested; no secure unlock bypass is promised. [S2-M0031]

## Network-sensing boundary

This is an optional experiment, not an MVP dependency. SSH is an execution connection, not a phone traffic sensor. Do not propose TLS interception or installing a trust certificate as an assumed part of personal context collection.

Android permits one active VPN per user/profile. Starting another stops the existing VPN. Therefore a local VPN sensor and a separate phone Tailscale connection cannot simply be enabled together. Prefer normal authenticated outbound JARVIS API traffic; test a combined networking design only if both functions are needed. Always-on/lockdown configuration has connectivity consequences and needs a recoverable opt-in setup. **Confirmed Android capability; integration needs device testing.** [Android VPN documentation](https://developer.android.com/develop/connectivity/vpn)

## Privacy and battery policy

Provide global pause, per-source toggles, per-app exclusions, sensitive zones/categories, local-only modes and collection history. Keep microphone/camera/screen state visible when used. A pause stops new capture; forgetting historical data is a separate action. Explain this without burying the owner in repeated prompts.

Begin with low-volume high-value sources: deliberate saves, messages and selected notifications. Add background location only after measuring utility and battery impact. Accessibility and screenshots should be selective and event-driven. Network collection is last, only for a specific missing signal. Avoid continuous raw screen/audio/video storage.

Raw buffers need bounded bytes and age, backpressure and a priority policy. On low battery, thermal pressure or low storage, reduce optional capture, retain important unsynced events and record gaps. Do not keep waking the phone merely to maintain an appearance of omniscience. Heavy OCR/embedding/media work can wait for charging or run on the backend if authorized.

Meaningful location and event history can be retained long term even when raw samples expire. This reconciles the permanent-index requirement with short-lived ambient data. Exact retention and cloud sensitivity choices are Q02 in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Prototype acceptance

Use consenting test data on the actual phone. Compare observations against a known timeline, measure missed/duplicate events, confidence calibration, false interventions, battery/thermal impact and recovery after reboot/Doze/permission revocation. Verify that correlated copies do not inflate confidence. Test location ambiguity, missing notification text and excluded screens. The prototype succeeds when useful events are accurate enough for their specific action thresholds, not when it stores the most data.
