# Decisions and chronology

Responsibility: human-readable architecture/product decisions, their evidence, strength and supersession. These new D identifiers belong to this reconstruction and do not reuse potentially conflicting ADR numbers mentioned in old repository reports.

The decision hierarchy is newer explicit user decision → older explicit user decision → user-approved assistant proposal → unconfirmed assistant suggestion → old implementation assumption. All displayed source times retain the export's unspecified timezone. The current reconstruction request is the latest direct instruction. Exact source/message references are resolved in [REQUIREMENTS_LEDGER.md](REQUIREMENTS_LEDGER.md) and [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md).

## Chronological outline

| Period / decisive messages                        | Evolution                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aug 23–24, S1-M0001/M0003/M0009                   | Private proactive executive assistant/accountable companion, WhatsApp access, personal context, reviewed onboarding, reminders, calendar and read-only email/finance; starter integration approved      |
| Aug 28–Sep 3, S1 implementation reports and M0044 | Core/transport scaffolding, cost constraints, refusal to buy Railway capacity; reported shift to Neon/Vercel/Convex with an outbound bridge                                                             |
| Sep 4, S1-M0181/M0183/M0187/M0189                 | User asks for real intelligence, Android voice/device depth, years-long location, personal chat, first-party future apps, journal and richer personal memory; future paid operation acceptable          |
| Sep 5–8, S3–S7 and S4                             | Phone, carrier, battery and temporary-budget exploration; no commitment to ROM work in the next months; data-export interest broadens archive thinking                                                  |
| Sep 7–10, late S1 reports                         | Scheduler freshness/generation defects corrected, real DB tests reported passed, migration/release automation repaired; final report migration0008/API healthy but Convex paused and cloud matrix unrun |
| Sep 9 early, S8 and S2-M0003                      | Guardian/Vault/Action Ledger and persistent computer work approved; future email/payment capability expanded; user rejects building a physical phone and endorses removing workaround causes            |
| Sep 9 evening–Sep 10, S2-M0007–M0035              | Real multi-page launcher desired; iPhone approximations rejected; stock Android/OEM services retained; personal index/local AI and Samsung become central                                               |
| Sep 10 04:30–05:03, S2-M0037–M0055                | Council/Boardroom/urgent app call, bounded Handoff approval, narrow disclosure, S26 Ultra RAM preference, explicit no-ROM focus and passive context elaboration                                         |

## D01 — Private personal intelligence, one coherent core

**Status:** current explicit user requirement. **Evidence:** S1-M0003, Aug 23 16:33:22; S1-M0187, Sep 4 03:30:02; S8-M0003, Sep 9 02:24:59; current request.

The owner wants an executive assistant, accountable friend and operating layer across life domains, with shared identity/memory/history across surfaces. A later possible public product does not change the current private goal. Separate apps/models must not create disconnected versions of the owner. The core remains useful even if a particular transport changes. See [PRD.md](PRD.md).

## D02 — Stock Android first, real default HOME

**Status:** current explicit architecture decision. **Evidence:** S4-M0007's near-term no-ROM position; S2-M0007, Sep 9 17:45:56; S2-M0025, Sep 10 02:38:57; M0035, 03:40:56; M0053, 05:00:17; current request.

Use the Android HOME role for the Ratio-inspired left intelligence / center Home / right messages concept. Keep normal Android/OEM security, Wallet, banks, camera, connectivity, settings and updates. Samsung Good Lock/system surfaces are useful existing infrastructure. Root, ROM, GrapheneOS and kernel work move to conditional future research. This supersedes iPhone fake-launcher and deep-OS-first interpretations. See [JARVIS_HOME.md](JARVIS_HOME.md).

## D03 — S26 Ultra is the latest hardware preference

**Status:** current explicit preference; purchase unconfirmed. **Evidence:** S2-M0035, Sep 10 03:40:56 and M0051, 04:56:49.

Prefer T-Mobile Galaxy S26 Ultra, 16 GB RAM if affordable, 12 GB acceptable. Earlier Pixel-only recommendations and temporary S22/cloud advice were made under different assumptions. Pixel remains conditional for a verified future need involving an appropriately unlockable device; brand alone does not establish bootloader access.

Samsung's official US specification lists 12 GB at 256/512 GB storage and 16 GB at 1 TB. This supports the RAM/SKU distinction, not T-Mobile stock, price, promotion, compatibility under every management policy or model performance. Checked 2026-09-10. [Samsung announcement](https://news.samsung.com/us/samsung-unveils-galaxy-s26-series-most-intuitive-galaxy-ai-phone-yet/)

## D04 — Meaningful permanent personal index, not ephemeral context alone

**Status:** current explicit requirement and architecture direction. **Evidence:** S1-M0187, Sep 4 03:30:02; M0189, 03:41:25; S5-M0001, Sep 8 00:35:16; S2-M0031, Sep 10 03:07:16; M0045, 04:47:21; current request.

Retain meaningful personal records and relationships for years under owner control. Location is not limited to temporary context; personal message history must be searchable. Raw ambient noise can expire while meaningful visits/events remain. Exact, semantic, entity, chronological, recent and derived retrieval have distinct roles. This supersedes provider-only/no-personal-archive and ephemeral-location assumptions. See [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

## D05 — Broad authorized knowledge, narrow disclosure

**Status:** explicit user requirement; enforcement details are architecture synthesis. **Evidence:** S1-M0189; S8-M0003; S2-M0045, Sep 10 04:47:21; current request.

An agent, recipient or external model gets only context appropriate to its purpose. Relationship/business boundaries are explicit. Guardian, Context Firewall and Vault perform different jobs outside the LLM. Summaries/embeddings inherit restrictions, and chairman status does not bypass them. See [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

## D06 — Hybrid intelligence with independent cost control

**Status:** current explicit architecture requirement. **Evidence:** S1-M0183, Sep 4 02:58:59 expands permanent-free assumptions; S2-M0033, Sep 10 03:23:51; M0035; M0051; current request.

Use deterministic code, useful local phone intelligence, inexpensive cloud and stronger models when justified. Support Auto/manual provider choice and shared canonical history. Limits must be enforced in code across tasks, days, months, agents, steps, timeouts and fallbacks. No exact provider roster/model or numeric budget is approved. Historical free-credit gates and the $50 example are not current settings. See [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md).

## D07 — Beeper beneath the unified messaging experience

**Status:** current user-selected integration direction; host and network behavior require prototype. **Evidence:** S8-M0003/M0005, Sep 9; S2-M0007; M0031; current request.

JARVIS owns presentation, memory, drafts and authority while using Beeper as an adapter. The old Evolution dedicated assistant number is a separate historical transport. Do not rebuild every network bridge or assume Beeper is a hosted headless API. Full history, presence and unattended Desktop hosting remain tests. See [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

## D08 — Temporary Handoff and Sleep Handoff are approved behavior

**Status:** explicitly approved product behavior; disclosure/grants unresolved before activation. **Evidence:** S8-M0007; S2-M0037, Sep 10 04:30:16; assistant M0042, 04:41:04; user M0043, 04:44:15.

The user strongly approves bounded routine handling during a delivery/sleep period, important escalation, a closing interaction where appropriate and an accurate return briefing. This supersedes an assistant's blanket refusal to allow relationship Handoff. Example times are not permanent settings. Do not claim that the partner's awareness or per-message labeling was separately settled; preserve Q03. See [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md).

## D09 — Email scope expanded, payment scope still bounded and future

**Status:** later approved capability, not an active unrestricted grant. **Evidence:** S1-M0003, Aug 23 explicitly no email sending; S8-M0003, Sep 9 02:24:59 asks for email back-and-forth in persistent work; M0005, 02:40:24 endorses the money/email proposal.

MVP email remains read/draft. Later operational correspondence can run under a concrete task/recipient/purpose permission. Financial read intelligence and future payment broker are distinct from authorization to move money. The owner has not selected a payment provider, amount or blanket spending permission. Do not make early no-email-send eternal or later capability approval universal. See [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

## D10 — Council is persistent and genuinely multi-agent; Boardroom shares it

**Status:** current explicit product/architecture requirement, phased. **Evidence:** S2-M0035, Sep 10 03:40:56; M0037, 04:30:16; current request.

Separate objectives, prompts, tools, private working memory and context permissions are essential. Different model providers are possible. JARVIS chairs; disagreement follows real competing priorities. Native Council chat and optional transport windows share identities and history; desktop Boardroom adds a richer experience later. Original/fictional-inspired agents remain distinct from labeled real-person-inspired simulations. See [COUNCIL_AND_BOARDROOM.md](COUNCIL_AND_BOARDROOM.md).

## D11 — Voice is modular; urgent interaction may be an app call

**Status:** explicit requirement; device behavior unproven. **Evidence:** S1-M0183; S2-M0035/M0037; current request.

Use local activation/commands where viable, replaceable speech providers, interruption and cloud conversation when necessary. The incoming JARVIS call is an Android app interaction with answer/decline, not a requirement for a PSTN number. API existence does not prove full-screen or locked-device behavior. See [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md).

## D12 — Passive context is evidence fusion, not continuous omniscience

**Status:** current explicit requirement; sensor choices phased/experimental. **Evidence:** S2-M0031 screenshots/context; M0055, Sep 10 05:03:22; assistant M0056; current request.

Combine permitted weak signals into meaningful events with uncertainty. No single notification, location or domain proves an activity. Process locally where useful and discard raw noise. VPN/DNS is optional, not SSH or decrypted universal content. Context acquisition does not imply disclosure. See [PASSIVE_CONTEXT_ENGINE.md](PASSIVE_CONTEXT_ENGINE.md).

## D13 — Cases, action evidence and deliberate override

**Status:** current explicit product direction; detailed state machine synthesized. **Evidence:** S1-M0003; S8-M0003; S2-M0004 assistant proposal; current request explicitly adopts Cases, Reality Debugging, intentions and reversibility.

Persistent work survives chat closure and waits for real outcomes/conditions. Action history shows authority and actual effect; recovery is honest about irreversible disclosure/sends. Accountability is contextual and supports deliberate override. Goals outrank observed habits. The financial-punishment transfer in S1-M0187 is explicitly rejected. See [AUTOMATION_AND_CASES.md](AUTOMATION_AND_CASES.md).

## D14 — Keep deployment separate from logical architecture

**Status:** existing deployment reported; VM direction favored but unresolved. **Evidence:** explicit Railway no-upgrade S1-M0044, Aug 30 10:05:11; later willingness to pay S1-M0183; VM discussion S8-M0003/M0004 and S2-M0031/M0033.

The reported Neon/Vercel/Convex baseline is historical implementation, not a permanent three-vendor product requirement. A consolidated VM may fit persistent workloads but needs Beeper-host and operations proof. Do not silently migrate or run two authoritative schedulers. Preserve canonical data and reliability contracts while selecting deployment. See [ARCHITECTURE.md](ARCHITECTURE.md), Q04.

## D15 — Generation-fenced durable jobs and explicit freshness

**Status:** reported implemented engineering invariant to preserve; not independently reverified here. **Evidence:** S1-M0243, Sep 7 17:08:39 identifies real failure; M0245, Sep 8 00:33:21 reports correction; M0253, 02:43:10 reports real DB validation.

Atomic leases use canonical generation/state/deadline and completion fencing. Durable work has no blanket TTL; explicit latest-start expiry can terminate a stale step without resolving its Case. Unknown external effects require reconciliation. Old pg-boss topology and fixed timeout examples are not product requirements. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## D16 — Latest reported release state overrides stale assistant instructions

**Status:** reported operational fact, not a new deployment instruction. **Evidence:** S1-M0302, Sep 10 03:07:30 and M0304, 03:10:17.

The latest user-role reports say migrations through 0008 succeeded, the API was deployed/ready, compatible Convex code was deployed but dispatch remained paused, and the final synthetic cloud matrix was not run. Assistant M0303's stale instruction to rerun migration is superseded by the correction. No live model/WhatsApp product is demonstrated. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## D17 — Optional management tiers, no enrollment prerequisite

**Status:** architecture option requested for evaluation, not explicit enrollment approval. **Evidence:** S4/S2 Device Owner/Knox discussion; current request; D02 stock-first constraint.

Ordinary permissions are the baseline. Device Owner and Knox may satisfy a specific stronger control need after testing. Neither is root or a guarantee of every API. No factory reset, license purchase or managed-device conversion is authorized. Retain Q05/T06 rather than claiming the owner chose enrollment.

## D18 — First-party personal tools and retrospectives are later, still preserved

**Status:** explicit future desires/approved ideas. **Evidence:** S1-M0187, Sep 4 03:30:02; M0189, 03:41:25; S8-M0003.

Food/workout/running/calendar tools can feed JARVIS directly. Journal, music/activity/photo retrospectives, movie history and calculation context remain valuable ideas, not immediate app-replacement scope. Wearable/music switches and call recording require evidence and later choices. See [ROADMAP.md](ROADMAP.md).

## D19 — Remove workaround causes; usefulness precedes spectacle

**Status:** explicit philosophy. **Evidence:** S1-M0181; S2-M0003, Sep 9 02:42:28; M0011/M0013; M0035; current request.

Do not improve repetitive app-opening when better data integration can remove the need. Do not rebuild OEM surfaces that already satisfy the requirement. Do not mistake infrastructure or visuals for useful intelligence. This principle governs sequencing and architecture changes, not merely tone. See [JARVIS_MASTER.md](JARVIS_MASTER.md).

## D20 — Unconfirmed proposals remain labeled; reconstruction is not implementation

**Status:** current explicit documentation instruction. **Evidence:** current request.

Every source is relevant to reconstruction, but every assistant idea is not a requirement. Preserve unapproved simulations, autonomous system-building, arbitrary rosters/models and outdated implementation assumptions as such. Prototype success is scoped evidence, not production approval. No code, UI redesign, account connections, messages, migrations or device changes were authorized by this reconstruction task. See [CODEX_START_HERE.md](CODEX_START_HERE.md).

## D21 — Official WhatsApp Cloud API is a dedicated inbound JARVIS transport

**Status:** current explicit user decision; direct inbound slice under implementation. **Evidence:** owner-approved Meta/Cloud API setup and explicit backend instruction, 2026-09-29.

Use Meta's official WhatsApp Business Platform only through JARVIS's own dedicated Business
Platform number. The owner's and Zara's personal WhatsApp accounts stay unchanged. The deployed
WhatsApp bridge owns Meta signature verification, raw evidence, provider deduplication,
participant/conversation mapping, and delivery retries. JARVIS accepts only the bridge's stable
normalized event contract through a private server-to-server endpoint; it must never consume a raw
Meta webhook payload.

The first live proof was direct inbound recording only: it stored a privacy-filtered canonical
message and queued deterministic processing. D22 now defines the separately gated canonical owner
conversation extension; it does not activate it. Groups API, the separate third-party Agent API,
outbound sending, and permanent participant-to-person linking remain deliberately disabled until
their own documented gates are met. This is separate from both the legacy Evolution transport and
D07's Beeper-based unified personal-messaging direction; it does not grant access to the owner's
personal WhatsApp history or create a competing sender.

## D22 — Verified owner direct messages use the canonical JARVIS conversation, not a bot layer

**Status:** current explicit user decision; implementation is gated pending explicit production
configuration and a configured Brain model route. **Evidence:** current owner instruction,
2026-09-29.

For a deliberately enrolled owner participant in a direct conversation with JARVIS's dedicated
Cloud API number, WhatsApp is only a surface. The bridge persists the signed inbound evidence and
normalized event first. JARVIS then attaches the already-persisted canonical message to its normal
conversation/session history, assembles the existing bounded context, and runs the normal Brain,
decision, validation, policy, approval, persistence, and durable-delivery path. It must never
construct a WhatsApp-specific prompt, memory, command syntax, action authority, or competing
conversation store.

Natural language is the interface: questions, memory-worthy statements, reminders, commitments,
plan changes, clarification, and proposed external actions are classified by the canonical Brain
and its existing deterministic controls. A response is persisted before it becomes a transport
delivery intent. Meta acceptance means only `sent`; it does not prove delivered, read, actioned,
or completed.

The same transport-neutral persisted-response and delivery-intent path is reserved for future
canonical proactive accountability messages. Proactivity must be driven by canonical commitments,
plans, reminders, deadlines, accountability state, and owner preferences; silence never proves
completion. It is not a WhatsApp notification bot, a source of arbitrary authority, or permission
to activate Groups, the third-party Agent API, personal accounts, browser control, or purchases.

## D23 — Use Vercel AI Gateway OIDC for the first cloud Brain route, without provider lock-in

**Status:** historical provider-path approval; its model-activation boundary is superseded by
D24. **Evidence:** owner instruction, 2026-09-29.

Use the existing provider-neutral Vercel AI Gateway adapter and Vercel deployment OIDC identity
for the first live Brain probe. Do not add a direct OpenAI API key, a static Gateway key, or a
provider-specific canonical conversation path. A model from OpenAI or another provider may be
selected through Gateway only after its exact current catalog capability, structured-output
compatibility, and bounded cost have been shown to the owner and explicitly approved.

The existing deterministic Cost Governor, strict `BrainDecision` schema, bounded prompt/output
limits, exact receipt accounting, and no-silent-fallback rules remain mandatory. As of the
2026-09-29 catalog check, no model tagged `free` also advertised `response_format` plus
`structured_outputs`; therefore no zero-cost model is approved for the strict Brain route. This
decision itself did not enable a Gateway budget, model, paid call, or direct-owner reply.

## D24 — First bounded live Brain probe uses GPT-6 Luna through Gateway OIDC

**Status:** completed bounded probe; direct-owner messaging remains disabled. **Evidence:**
owner instruction and a live, auditable canonical run on 2026-09-29.

The first paid strict-structured-output probe uses `openai/gpt-6-luna` through the existing
provider-neutral Vercel AI Gateway/OIDC adapter. It is the standard route with `medium` reasoning
effort, approximately 6,000 input tokens, at most 2,500 output tokens, one model call, no
fallback, and deep escalation disabled. It retains `store: false`, the strict `BrainDecision`
schema, deterministic cost admission, and provider-receipt accounting.

The live canonical no-action probe completed with a validated `BrainDecision`: 2,340 input
tokens, 333 output tokens, 147 reasoning tokens, zero cached input tokens, an actual Gateway
receipt of $0.00045893, and 3,979 ms model latency. Replaying the same idempotency key produced
no second event, job, Brain request, model run, or decision.

This decision does not authorize a standing paid route, owner-DM replies, a Terra route, a
fallback, deep escalation, proactive messaging, or any external action. The current deterministic
Brain evaluation suite must remain green, and broader live qualitative evaluation remains an
activation gate before direct-owner messaging can be enabled.

## 2026-09-29 — Implicit fixed-anchor preservation and Muse safety profile

Explicit owner approval in the current task revises R010 planning and R055–R059 model/cost implementation: deterministic replanning preserves canonical protected anchors without model output; only safe unchanged duplicates normalize, and protected edits/removals remain unauthorized in this path. Muse retains its requested output control but uses verified model maximum/shared-context bounds for admission. Prompts, defaults, budgets, WhatsApp state and conversational truth remain unchanged. See [ADR 0017](../ADR/0017-implicit-anchor-preservation-and-model-output-bounds.md), which supersedes the temporary Muse block in ADR 0016. Local regression evidence does not authorize deployment.

## 2026-09-29 — Flexible-only model replan contract

Current explicit owner instruction supersedes ordinary protected-anchor normalization from the preceding repair. New model proposals cannot emit protected roles/classes, preservation is server-derived, protected modifications/removals are unavailable, and legacy persisted records retain versioned read compatibility without history rewrites. R010 and model-contract implementation are governed by [ADR 0018](../ADR/0018-flexible-only-model-replan-contract.md). No prompt tuning, default routing, budget, WhatsApp or deployment change is authorized.

## 2026-09-29 — Versioned planning operations

Explicit owner instruction authorizes [ADR 0019](../ADR/0019-operation-oriented-planning-interface.md): a new changes-only prompt module for flexible_delta_v2, ID/time scheduling of canonical commitments with server-resolved metadata, and separately authorized new flexible creation. Anchor/overlap validation, protected-mutation denial, truth reconciliation and replay remain authoritative. The synthetic comparison runs both Luna and Muse once with the same interface regardless of Luna outcome. Deployment and owner WhatsApp replies remain disabled; routing, reasoning and budgets are unchanged.

## 2026-09-29 — Server-materialized validated-plan action

Explicit owner instruction authorizes [ADR 0020](../ADR/0020-server-materialized-operation-actions.md): a valid operation-oriented planning proposal now creates its canonical plan-update action server-side and enters the existing policy/executor path. The authenticated-owner internal-plan policy allowed the frozen synthetic Case 3 operation. Its action, execution, post-commit verification, success response, and replay were all recorded in an isolated synthetic run. This does not alter policy, defaults, routes, budgets, prompts, schema, anchor behavior, WhatsApp delivery, or deployment state.
