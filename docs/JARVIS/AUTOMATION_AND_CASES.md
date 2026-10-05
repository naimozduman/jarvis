# Automation and Cases

Responsibility: persistent intentions, Cases, proactive interventions, learned work, action history and recovery. Scheduler implementation contracts are in [ARCHITECTURE.md](ARCHITECTURE.md); authority is in [SECURITY_PRIVACY_AND_PERMISSIONS.md](SECURITY_PRIVACY_AND_PERMISSIONS.md).

## Durable work model

**Product requirements:** follow through across days/weeks/months, detect unfinished intentions, learn repeated work, explain failures through Reality Debugging, and retain visible action history. Early S1-M0003 establishes persistent follow-up and flexible accountability; S8-M0003 approves long-running work and Action Ledger; S2-M0004 proposes several named mechanisms adopted explicitly in the current request. [R006, R010, R040, R064, R066–R073]

An intention records an outcome the owner wants, possibly before a date or plan exists. A Case is the durable container for investigating and achieving a meaningful outcome: goal, owner, evidence, current state, dependencies, next condition/action, deadlines, relevant people/projects, grants, budget, decision history and closure evidence. A job is one execution attempt or scheduled step within that work.

| State                          | Meaning                                                 | Exit evidence                                      |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------------- |
| Captured / needs clarification | A possible intention or problem exists                  | Owner confirmation or sufficient explicit evidence |
| Ready / active                 | Next step is known and currently possible               | Action outcome or changed conditions               |
| Waiting for condition          | Time, location, reply, resource or prerequisite missing | Observed condition with freshness/confidence       |
| Waiting for owner              | A real decision/permission/input is needed              | Specific answer or grant                           |
| Monitoring                     | Awaiting a meaningful external change                   | Changed event, deadline or failure                 |
| Blocked / failed step          | A dependency or attempt failed                          | Recovery, alternate plan or owner decision         |
| Resolved / canceled            | Outcome achieved or deliberately stopped                | Completion evidence or explicit cancellation       |

Case state persists when a chat closes. Reminder dismissal/expiry is not completion. A failed attempt does not automatically close the goal. Conversely, a Case must not continue forever after the owner cancels it. Preserve a concise closure reason and recovery context under retention policy.

## Unresolved intentions

Capture statements such as “when things calm down, help me sort this out” without inventing an appointment. Store the intended outcome, uncertainty, possible enabling conditions and an appropriate review interval. Revisit when conditions actually change or during an agreed review. Avoid repeatedly asking a question the files/memory already answer.

Recurring missed intentions may indicate a missing prerequisite or a poorly chosen plan. JARVIS should propose reducing scope, changing timing or removing the obstacle, rather than optimizing the reminder wording indefinitely. This implements the owner's “remove the reason for the workaround” principle. A long-dormant intention should be surfaced for keep/revise/cancel, not silently erased or made urgent without evidence.

## Proactivity and attention

Choose among act, draft, ask, wait, brief or escalate using importance, urgency, confidence, reversibility, authority, current attention, interruption cost and recent interventions. Explicit owner goals and hard constraints outrank inferred preferences. Be supportive and direct; challenge an excuse with context, but preserve deliberate override. Do not learn that an undesirable repeated behavior is the owner's desired goal.

Group routine updates into useful briefings. The early “six to nine” messages and Sunday 17:00 review were cadence examples, not quotas. Quiet monitoring sends no repeated unchanged-status messages. Important changes can interrupt within configured rules. If reminders are repeatedly ignored, reassess the obstacle and escalation policy; do not merely increase volume.

The Notification Listener can observe and perform supported actions after notifications exist. It cannot guarantee suppression before every OEM notification is displayed. Attention management combines JARVIS's own delivery policy with supported Android/DND/app settings and optional stronger device policy. It is not a claim that JARVIS owns the entire system notification pipeline.

## Workflows

**Practice departure.** Read the event, preparation routine, current location and allowed route/traffic source. Include planned stops and dwell time, such as going home for 20 minutes. Recommend a departure time and update when relevant evidence changes. If traffic is unavailable, show the estimate's age and uncertainty. Call-like escalation is possible only under the tested voice path and owner rules.

**Late shipment versus sleep.** Compare real shipping deadlines, necessary work and the owner's sleep goal. Propose a concrete tradeoff or smaller finishable step. If the owner deliberately overrides, record the temporary choice and replan; do not silently rewrite the long-term sleep goal. [S1-M0003]

**Bills and subscriptions.** Extract due dates and recurring charges from permitted finance/email evidence. Detect possible duplicates and approaching insufficient balance. A duplicate alert is a hypothesis until confirmed. Read intelligence does not authorize payment, cancellation or contacting a company. Future scoped broker/email work can become steps in a Case after authority is configured.

**A multi-day external task.** Gather evidence, draft correspondence, wait for a reply, check a deadline, and continue from durable state. Use the same Case across phone and desktop. Later browser/computer execution can handle supported steps, but unavailable desktop sessions do not become fake successful work. Escalate only the concrete missing decision, credential connection or unsupported action.

**Travel research and form work.** S8-M0003 describes browsing booking sites, entering travel constraints, comparing prices and possibly buying a small useful travel resource under authority. Preserve this as a future Case workflow with sourced quotes, baggage/date/airport constraints and a bounded research/purchase budget. Regional/VPN price comparisons are an experiment, not a guarantee of cheaper fares or authorization to bypass service rules. A research result is not a booked ticket. [R095]

**Be prepared.** The owner explicitly liked this proposal in S8-M0005. Before an event or task, gather relevant documents, prior decisions, route information and unresolved questions into a useful packet within standing read/draft scope. Preparation should reduce last-minute manual work; it does not silently send documents, buy materials or create new external commitments. For a late wake-up, use the revised schedule to prepare an appropriate late-arrival message for approval and report the actual delay evidence. [R096]

**Values-based focus.** The owner can define contextual distraction rules, bedtime commitments and Islamic/self-discipline routines. Use supported app/network controls, explain the trigger and provide a deliberate override. Sensitive inference boundaries remain in the Passive Context Engine. No punishment transfer to a friend is allowed: the owner rejected that idea in S1-M0187.

## Action Ledger and reversibility

Record intent, originating user/Case/agent, evidence references, permission/grant version, concrete action parameters or redacted hash, cost reservation, target, timestamps, execution state, provider receipt, confirmed outcome and available recovery. Store concise reasons, not hidden chain of thought. “Requested,” “accepted,” “confirmed” and “unknown” are separate states.

The assistant's “Digital Black Box” proposal in S2-M0004/M0054 maps to the retained observation/event timeline plus this Action Ledger and Reality Debugging. It is a useful explanation/history concept, not a separate duplicate database or approval to record every screen, sound and raw signal indefinitely.

| Effect                                | Recovery model                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Private draft/note or unexecuted plan | Delete/revise, retaining appropriate audit                                                       |
| Calendar edit                         | Restore prior values only if current provider state still permits it; detect intervening changes |
| Scheduled future action               | Cancel/fence pending work and confirm it did not already start                                   |
| Sent message/email                    | Cannot guarantee unread/unsent; a correction or supported deletion is a new external action      |
| Purchase/cancellation                 | Provider-specific refund/reversal/compensation, with fresh authority and conditions              |
| Information disclosed externally      | Cannot guarantee recall; report what happened and limit further exposure                         |

Grouped undo is a later UX over these individual recovery contracts, not time travel. Preview what can and cannot be reversed. Never retry an unknown external effect just to make the ledger look complete. Reconcile the provider and preserve uncertainty when evidence is unavailable.

## Reality Debugging

This subsystem answers questions such as “Why did I miss practice?” or “Why did this task stall?” Reconstruct the time-ordered evidence: plan, observed app/location activity, notifications, changed commitments, actions taken and missing signals. Identify plausible bottlenecks and competing explanations, with confidence.

Separate direct sequence from causal interpretation. “The reminder was delivered after departure time” may be directly evidenced; “you avoided practice because you felt anxious” is an unsupported psychological conclusion unless the owner supplied that explanation. Give a reviewable chain, missing evidence and one practical adjustment. Feed an approved correction into the Case or routine; do not autonomously rewrite goals or personality.

## Learning repeated work

With explicit observation scope, detect a repeated sequence, identify its intended outcome and propose a reusable workflow. Record inputs, preconditions, allowed sites/apps, secrets needed through brokers, steps, success checks, failure stops and rollback. Test on controlled examples before enabling unattended execution. The owner can approve a bounded routine without approving all future variants.

Changed UI, unexpected recipients, payment steps or missing evidence invalidate the learned assumptions and stop/escalate. A generated skill cannot install itself with broader tools or modify Guardian policy. “Build the missing system automatically” and predictive scenario simulation remain experimental assistant-origin possibilities, not authority to deploy production systems. See [ROADMAP.md](ROADMAP.md).

## Failure and acceptance

Test reopening a Case after chat closure and device restart; waiting weeks without losing the intention; deadline expiry without false completion; duplicate callbacks; owner cancellation during execution; contradictory new evidence; blocked dependency recovery; and escalation when the owner remains unavailable. Verify useful quiet behavior during unchanged monitoring and a clear next step when intervention is warranted.

A successful automation has evidence of the desired outcome, honors scope/cost, avoids duplicate effects and leaves the owner able to understand and correct it. Counting reminders, tool calls or agent messages is not a success metric.

## 2026-09-29 planning contract clarification

Canonical fixed/hard anchors are implicitly preserved by the deterministic server. A replan is a mutation delta, never a replacement schedule. Protected identity ambiguity or changed protected fields reject the proposal; omission cannot delete an anchor. Existing authority checks and deterministic conversational truth remain controlling. See [ADR 0017](../ADR/0017-implicit-anchor-preservation-and-model-output-bounds.md).

## 2026-09-29 flexible-only model mutation boundary

Ordinary model replans now expose only movable block types. Fixed/hard anchors remain visible canonical constraints and are implicitly preserved. Current-phase protected modification/removal structures are unavailable. New server-stamped flexible_delta_v2 proposals use no title/time normalization. The prior normalization adapter is retained only for reading/revalidating already-persisted legacy proposals. Applied deltas are recorded separately from immutable original proposal bodies. See [ADR 0018](../ADR/0018-flexible-only-model-replan-contract.md).

## 2026-09-29 — Versioned planning operations

Explicit owner instruction authorizes [ADR 0019](../ADR/0019-operation-oriented-planning-interface.md): a new changes-only prompt module for flexible_delta_v2, ID/time scheduling of canonical commitments with server-resolved metadata, and separately authorized new flexible creation. Anchor/overlap validation, protected-mutation denial, truth reconciliation and replay remain authoritative. The synthetic comparison runs both Luna and Muse once with the same interface regardless of Luna outcome. Deployment and owner WhatsApp replies remain disabled; routing, reasoning and budgets are unchanged.
