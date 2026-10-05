# Council and Boardroom

Responsibility: persistent multi-agent interaction, isolation, debate, meeting experience and follow-through. Council is a serious planned subsystem, not a collection of renamed prompts. S2-M0035/M0037 and the current request establish the direction. Rich Boardroom is a later phase using the same underlying agents. [R074–R080]

## One Council, several surfaces

Council Chat is an ongoing asynchronous environment the owner can join, leave and revisit. Agents may discuss useful news, football, links, photos, memes, projects and active decisions within their interests and budgets. They do not need to wait for a formal meeting, but they also should not generate endless activity to look alive.

Boardroom is a richer desktop meeting surface over the same Council memberships, history, evidence, Cases and decisions. One or two meetings per week was an example of desired cadence, not a mandatory scheduled expense. A meeting can also be requested for a specific decision. The phone remains a companion for access, alerts and continuity.

Native JARVIS Council chat is the reference implementation surface because it can represent agent identities, evidence and controls directly. WhatsApp is an optional transport window, not a selected requirement to create multiple real accounts. A single account can relay labeled agent contributions; it does not become several independent WhatsApp identities. External transport policies and account behavior require verification before use.

## Agent contract

| Field                  | Required distinction                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Identity               | Stable agent ID, display persona and role; not a claim of real-person participation          |
| Objective              | What this seat optimizes and what it considers a risk                                        |
| Prompt/policy          | Versioned role instructions and working style, subordinate to shared Guardian rules          |
| Context grant          | Allowed domains, people, documents, Cases and disclosure audiences                           |
| Tools                  | Specific permitted read/action capabilities, not the chairman's complete tool list           |
| Private working memory | Separate stored notes/hypotheses and continuity, under its scope and retention rules         |
| Shared contributions   | Deliberately published summaries, evidence and proposals visible to appropriate participants |
| Model/provider         | Configurable; different providers possible where useful, not mandatory for every seat        |
| Budget                 | Per-run/period allowance, turn/tool/timeout limits under the owner and meeting caps          |

Isolation should exist in storage queries, prompt construction, tools and execution authority. Giving agents the same full personal prompt with different names does not satisfy the requirement. Private working memory means scoped visible-to-system records, not a demand to collect hidden chain of thought. Revocation or source deletion affects agent memories and summaries as well as the shared index.

Persistent profile pictures/avatars and distinguishable voices can make those identities legible in the app and later Boardroom. They are presentation for real role/state differences, not substitutes for them. Separate WhatsApp profile pictures would require appropriate actual account support; native Council can represent identities without inventing network accounts.

JARVIS is chairman: frames the issue, selects participants, requests evidence, allocates turns/budget, exposes tradeoffs, records a synthesis and turns approved outcomes into work. Chairman status does not grant unlimited context or action authority. It can request permitted summaries from a restricted seat rather than seeing every private record.

## Seats and genuine disagreement

The user explicitly described conflicting finance/operator perspectives and interests including news and football. The table is a **starting design proposal**, not a finalized roster.

| Seat                | Objective and natural tension                       | Typical permitted context                                 |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Finance             | Preserve cash, understand costs and downside        | Approved financial summaries, budgets, relevant proposals |
| Operator            | Finish important work and remove bottlenecks        | Projects, deadlines, capacity, authorized execution tools |
| Risk / critic       | Challenge assumptions and look for failure modes    | Evidence packet and necessary risk context                |
| Research / strategy | Find external evidence and alternatives             | Bounded research tools and relevant project context       |
| News / football     | Useful conversation and updates in chosen interests | Selected public sources and owner interest preferences    |

Disagreement should emerge from objectives and evidence. For example, the operator may favor paying for a VM to simplify reliable work while finance challenges whether the demonstrated benefit justifies recurring cost. Neither should invent facts or oppose merely for theater. A seat may agree when the evidence is strong. A majority vote does not turn a claim into truth or authorize a purchase.

Avoid assigning every possible specialist permanently. Instantiate or wake a seat when its distinct perspective adds value, keep durable identity/history where desired, and archive inactive roles without losing their decision contributions.

## Council conversation and debate protocol

1. Establish the topic, desired decision/output, constraints, allowed context and budget.
2. Retrieve a compact evidence packet with source links, dates, uncertainty and unresolved conflicts.
3. Give each selected seat an appropriate private brief reflecting its objective and access; do not duplicate the entire personal archive.
4. Collect initial views before letting one confident response anchor every seat, when the task merits independent assessment.
5. Run bounded challenges: ask for evidence, identify assumptions, compare costs and consequences, and preserve minority concerns.
6. Chairman records agreements, disagreements, confidence, options and a recommended next step.
7. Obtain required owner decision/authority and create Cases/actions with owners, deadlines and evidence. Record unresolved matters instead of pretending consensus.

Agent contributions distinguish fact, inference, preference and proposal. Cite external evidence and internal source IDs. The owner can interrupt, redirect, remove a participant, request a stronger model, ask for a dissent or end the session. A request for a stronger model still respects the hard budget.

Asynchronous activity uses meaningful triggers: relevant source update, Case milestone, scheduled digest or owner message. Apply quiet hours, notification grouping, topic limits, deduplication and a maximum unattended turn count. “Ongoing” means persistent continuity, not constant paid inference or endless agents replying to each other.

## Boardroom experience, advanced phase

The richer concept may include rendered characters, voice, optional camera awareness, live interruption, shared documents, media, evidence and meeting packets. Render character scenes locally on the desktop where practical; do not assume continuous generated video is required. Voice generation/recognition is separately budgeted. Animation quality follows reliable text/voice meeting behavior.

Camera awareness is optional and session-scoped. It may support presence or a deliberate shared visual input, but does not establish accurate emotion, intent or psychological state. Expose camera/microphone controls and recording/retention state. Missing camera input must not prevent a meeting.

A pre-meeting packet contains the agenda, prior decisions, relevant Case changes, evidence and decisions required. During the meeting, preserve interruptions, revised proposals and actual approvals. The post-meeting record contains decisions, rejected options, dissent, assigned actions, deadlines and follow-up conditions. Actions go through the same executor/Guardian as any other JARVIS work; Boardroom is not a second workflow engine.

## Character boundary

Keep three categories explicit: original agents, fictional-character-inspired personas, and simulations inspired by public material about real living people. The conversations mention JARVIS/FRIDAY/EDITH/Alfred/Tom Hagen-style inspirations as well as real-person-inspired perspectives. These are reference ideas, not a final cast or a mandate to reproduce voices/likenesses.

A real-person-inspired simulation must be labeled as a simulation and must not claim that the real person participates, endorses the product or privately advised the owner. Its generated views are model outputs, not authentic quotes. Character presentation never supplies extra expertise, authority or context access. Licensing/likeness/voice choices for any eventual public release require separate review; public release is not the current goal.

The assistant's earlier preference for original-only characters was not an explicit user rejection of all other inspiration. Preserve the desired distinction without silently eliminating the user's broader concept.

## Costs, failure and acceptance

The meeting budget is a parent envelope over every seat, tool, summary, retry and voice segment. Reserve before each step and stop cleanly at the limit; see [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md). Expensive seats can be invited only for difficult questions while routine chat uses lighter routes. Do not schedule a full premium debate for every incoming message.

If an agent/provider fails, show which view is missing, retry only within policy or continue with reduced participation. Do not fabricate a failed seat's contribution. If a context permission changes, invalidate its pending packet. If the owner leaves, end or continue only under the stated unattended rules. Offline phone access can show cached Council history; a full cloud Council cannot be claimed to keep running on the phone.

Acceptance requires demonstrably separate prompts, objectives, memories and tool scopes; a test where finance/operator naturally disagree; a forbidden-context retrieval test; bounded unattended conversation; interruption and budget exhaustion handling; and a meeting decision that becomes a traceable Case/action and returns with an outcome. Text Council must pass these tests before rich character rendering becomes a development priority.
