# Messaging and Handoff

One canonical conversation and durable delivery model serves distinct adapters. Telegram source includes deliberate owner enrollment, direct processing, Bot API delivery, typing presentation and requested reminders. The independent official Meta Cloud bridge owns verified raw ingress, deduplication and normalization; JARVIS accepts its stable authenticated event contract. Enrolled direct Cloud owner conversations enter the shared Brain/persisted-response/outbox path only under their separate gates.

The retained Evolution/local bridge has its own session isolation, version gate and canonical one-time leases. Source existence does not prove adapter enablement. No import pairs the primary WhatsApp account, enables Groups/Agent API or creates a competing sender.

Future unified personal-message history/search through Beeper remains desired and distinct from the dedicated assistant identity. Desktop hosting, unattended restart, history completeness, network-specific replies, presence and privacy require actual prototypes; no hosted headless capability is assumed.

## Authority

Relationship/intimate messages remain draft-only in the V5 baseline. General routine Handoff is future finite recipient/topic/account/time/use-bounded controlled-write scope. HIGH_IMPACT never runs under a standing lease or unattended Night Mode. A presentation mode does not grant authority, and transparent authorship cannot be inferred from a lease.

An eligible future Handoff must support immediate owner takeover, expiry/revocation, escalation within policy, queue fencing, exact internal authorship, provider uncertainty and a return brief distinguishing verified effects, drafts, blocked work and unknown outcomes. Late cancellation cannot undo an already accepted disclosure.

[NIGHT_MODE](../product/NIGHT_MODE.md), [approval](../security/APPROVAL_MODEL.md), [WhatsApp architecture](WHATSAPP_ARCHITECTURE.md) and [outbound delivery](OUTBOUND_DELIVERY.md) own the corresponding controls. The exact older relationship/Beeper discussion remains [archived](../archive/r1-product/MESSAGING_AND_HANDOFF.md).

## Compatible detailed subsystem contracts

The following retained R1 detail remains current design where compatible with V5. The September 10 external-API observations are dated source evidence and require current prototypes before implementation claims. History/search, identity, ingestion, presence, outcome reconciliation and calendar-candidate contracts survive the product update. Sending/Handoff transitions below describe future eligible non-relationship controlled writes only. Relationship/intimate content stays draft-only; disclosure decisions alone cannot supersede that rule. The later dedicated Cloud transport detail is preserved as source-backed scoped behavior, with executable/provider validation still pending. Android Home placement remains later-phase design.

## Beeper capability boundary

As checked on 2026-09-10, Beeper's Desktop API is a local API inside a running Beeper Desktop application. Initial available history may be limited; the docs recommend on-device connections for fuller history. It is not a hosted universal API that JARVIS can call without a Desktop host. **Confirmed external API capability and host requirement.** [Beeper Desktop API](https://developers.beeper.com/desktop-api/)

The API documents message sending and explicit chat read-state operations. Test each required network and account mode; documented endpoints do not establish typing/online controls, unlimited backfill, calling or complete network feature parity. **Confirmed API surface; JARVIS integration needs prototype.** [Send message](https://developers.beeper.com/desktop-api-reference/resources/messages/methods/send/), [mark chat read](https://developers.beeper.com/desktop-api-reference/resources/chats/methods/mark_read/)

Remote access can be enabled, but secure external connectivity is the integrator's responsibility. Prefer a narrow authenticated outbound bridge between the Desktop host and JARVIS, exposing only approved operations. A sleeping physical PC is unavailable; an unattended VM/Desktop session must be tested. No headless Linux or phone-only replacement is assumed. [Beeper remote access](https://developers.beeper.com/desktop-api/advanced/remote-access/)

The live WebSocket stream is experimental. Its sequence numbers are per connection, and event payloads may be best effort. Use events for freshness plus persisted cursors/pagination/reconciliation; reconnect must not be treated as guaranteed replay of every missed message. [Beeper experimental WebSocket](https://developers.beeper.com/desktop-api/websocket-experimental/)

## Adapter architecture

JARVIS UI → authenticated messaging service → Guardian/Firewall → narrow connector → Beeper Desktop → connected network. Incoming changes travel back through normalization, deduplication, indexing and conversation/Case updates. Keep network/account/chat/message IDs and supported capabilities explicit.

The connector host stores its own scoped authentication securely and reports heartbeat, connection mode, account status, last sync and capabilities. Backend send intents include recipient/account, body/attachment references, grant, deadline and idempotency/reconciliation identity. The bridge rereads current authority before dispatch; an expired Handoff cannot be revived by an old queued command.

The legacy Evolution bridge was built for a dedicated assistant number through which the owner talks to JARVIS. That is a different concern from reading and acting in the owner's unified personal conversations. Preserve reusable transport/outbox patterns; do not run both adapters as competing senders for the same conversation or assume Evolution's old group restrictions define the new Beeper UX.

## Dedicated WhatsApp Cloud owner conversation surface

The official Meta Cloud API bridge is now the narrow dedicated-assistant transport selected for
the first live JARVIS intake slice. It uses JARVIS's own Business Platform number only; neither the
owner's nor Zara's personal WhatsApp account is attached. Its route is deliberately narrower than
Beeper: direct inbound messages arrive at Meta, are signature-verified and durably retained by the
separate bridge, then reach JARVIS as one normalized event.

JARVIS validates the bridge credential and expected bridge instance, binds the event to the
server-configured canonical owner, replaces external IDs with opaque one-way references, records a
direct inbound message/conversation projection, and queues it. It does not receive raw Meta
payloads, raw-webhook links, display names, destination-phone metadata, or free-form bridge
metadata. A bridge retry may repeat raw evidence upstream but cannot make a second canonical
message or job.

For an explicit, stable owner enrollment only, the next narrow vertical slice uses the exact same
canonical conversation turn that JARVIS uses elsewhere. Its ordered path is: signed inbound
evidence → normalized bridge event → canonical inbound message/conversation persistence → bounded
context and normal Brain/prompt pipeline → persisted decision and response → durable outbound
intent → official Cloud API delivery. It does not have slash commands, a bot persona, an
alternative memory store, or a WhatsApp-only action system.

The bridge may receive only an opaque canonical delivery ID, lease the already-persisted response
from JARVIS, write bridge-side dispatch evidence before calling Graph, and report a classified
result. A Graph acceptance is `sent`, not proof of delivery, read state, a completed reminder, or
an executed external action. Unknown requests enter reconciliation rather than a blind retry.
Actions proposed during a turn still pass the normal deterministic validation, policy, approval,
and audit controls; the transport grants none.

Future proactive accountability uses that same canonical conversation, policy, response, and
delivery path after the canonical planner/reminder/commitment systems create a valid message. It
must be evidence-led and bounded by owner preferences: silence is never completion; a valid owner
override may close ordinary negotiation but must preserve the real open/changed state and explain
the consequence once. It is not random nagging and not a separate notification bot.

This does **not** authorize a reply for an unlinked participant, message read-state change, Groups
API use, third-party Agent API use, personal-chat ingestion, or any new tool/purchase/browser
authority. D07's Beeper work remains the intended path for unified personal messaging.

## Historical ingestion and personal search

Bootstrap with authorized exports and whatever history the connector actually exposes. Record per-account/chat date range, pagination cursor, missing attachments, message types and known gaps. A “full WhatsApp history” product goal does not prove Beeper can fetch every old message or import an iCloud backup. T02 tests completeness against a known conversation and alternative exports.

Normalize authors, participants, replies, edits, deletions, attachments and source timestamps. Preserve internal metadata for human-authored, JARVIS-drafted, owner-approved and JARVIS-sent messages. Deduplicate backfill against live events; message edits invalidate derived summaries. Treat attachments and saved originals according to conversation retention rules. Disappearing/deleted content needs an explicit retention policy rather than silent indefinite copying.

Index exact phrases, names, dates and semantic references, then connect relevant events/people/commitments. Search should distinguish the original message from a later summary. “What is she talking about?” may combine permitted visible screen context with earlier messages, but a private explanation to the owner is not automatically an outgoing reply.

## Modes and authority

| Mode                | Behavior                                                                                                                        | Sending authority                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Normal              | Owner receives and handles messages; JARVIS may classify, search, extract plans and surface context under read rules            | No inferred autonomous sending                                                 |
| Draft Mode          | JARVIS proposes a reply with relevant evidence and uncertainty                                                                  | Owner reviews/sends, or explicitly approves the concrete send                  |
| Temporary Handoff | Future eligible non-relationship conversations, topics and routine replies in a bounded window | Separate current recipient/task/account/time/use authority plus disclosure rules; no baseline relationship sending |
| Sleep Handoff | Future eligible non-relationship routine handling, escalation and return within an explicit sleep episode | Finite separately enrolled scope; no HIGH_IMPACT action or baseline relationship sending |
| Paused / escalation | Stop autonomous sending because of risk, uncertainty, user return, stale state or missing capability                            | Preserve draft and ask the owner through an allowed channel                    |

The assistant's “Proxy” terminology is a possible restricted form of Handoff, not a required extra UI mode. The user's approved behavior matters more than retaining every assistant label.

A grant defines recipient/account, allowed topic/action classes, start/end time, context scope, style constraints, escalation conditions, max turns/cost and takeover behavior. It does not authorize sharing every known fact, making new financial/relationship commitments or fabricating personal experiences. Keep a visible mode indicator and a one-action stop/takeover control.

## Handoff lifecycle

Configure grant → pending start → active → paused/escalated or ending → ended → briefing acknowledged. Every transition is durable and versioned. User return or explicit stop invalidates the current sending generation. Before every send, check latest incoming messages, owner activity/takeover, recipient, topic, end time, budget and permission.

Use a single active sender authority per conversation. If the owner starts composing/sending while JARVIS is working, cancel stale drafts and pause or end Handoff according to the configured rule. Do not infer that typing/presence events exist on every network; the UI's explicit takeover control is authoritative. A message already accepted by the provider cannot be recalled by merely ending the mode.

At expiry, stop. Do not drain a stale overnight outbox after connectivity returns. A pending close-out may be sent only if still within a valid fresh grant and context; otherwise include it in the briefing. An unresolved issue becomes a Case/follow-up, not an excuse to extend the window autonomously.

## Escalation and narrow disclosure

Escalate for important or repeated calls, emergencies, conflict beyond the granted scope, major commitments, money, uncertain identity, a request requiring the owner's personal answer, or a question that would require forbidden context. The precise topic thresholds are configurable owner rules, not a fixed assistant moral judgment about every conversation.

Route escalation through an ordinary alert first or the configured urgent JARVIS call when warranted. Use the same event ID to prevent duplicate alerts. Record delivery/answer status. If the owner does not respond, stay within the existing grant, preserve the unanswered issue and use a neutral permitted response only if explicitly covered. Do not invent an answer or continue indefinitely.

The owner explicitly wants business/private details withheld from unrelated personal conversations. Build the outgoing reply from a filtered packet designed for that recipient. Style adaptation cannot justify false claims that the owner personally watched a reel, saw a photo, made a decision or completed an action. Exact internal authorship and decision provenance remain available in the morning briefing regardless of outward presentation policy.

## Presence, read state and media

Track local unread state, provider read receipts, typing, online status and delivery receipts as separate capabilities. Reading through an API may have different effects from opening a network app; test it. Beeper's app-level Incognito feature is not proof of a programmable guarantee for JARVIS. Never promise that automated activity will appear offline or leave no read trace. Presence failure should degrade gracefully and be disclosed before enabling a mode that relies on it.

Photos, voice notes, reels and calls need a per-network capability matrix. Fetch/understand media only when authorized and within budget. Unsupported calls open the native app or escalate. Shared-reel analysis is an experimental future capability from S8-M0007, not an MVP promise to operate another person's account or simulate the owner's viewing experience.

## Calendar extraction and morning return

Extract candidate events with participants, source message, date/time/timezone, location, confidence and ownership. A partner's appointment belongs first in a people/context calendar layer, not automatically as the owner's confirmed obligation. Clearly expressed owner appointments may follow separately authorized standing calendar rules for eligible controlled writes; ambiguous “next Friday” or changed plans require clarification or a tentative record. Detect edits and cancellations.

After a delegated period, give a compact briefing: who contacted the owner; what JARVIS sent; what the owner actually authored; important context; new/changed plans; promises made within authority; unanswered questions; failed/uncertain sends; media awaiting review; and active follow-ups. Link to exact messages and allow correction. Do not provide only a transcript dump or forget what happened once the mode ends.

## Failure and acceptance tests

Test known historical coverage; live ingestion during Desktop restart; duplicates/edits/deletions; wrong-account prevention; attachment failures; read/presence effects; outgoing timeout after possible acceptance; grant revocation during generation; owner takeover during send; window expiry; sleep escalation with DND/locked phone; connector loss; and morning briefing accuracy.

Unknown sends enter reconciliation rather than blind retry. A disconnected host pauses autonomous behavior while retaining drafts and cached search. A test account/consenting recipient is sufficient for technical prototypes; activating future eligible non-relationship delegated conversations additionally requires settled disclosure rules, exact finite grants and independent authority/stop controls. Q03 and grants do not enable relationship/intimate sending in the V5 baseline. The documentation confirms the desired subsystem, not that this end-to-end path is already working.
