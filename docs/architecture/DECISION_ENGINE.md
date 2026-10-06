---
title: "Decision Engine V5"
document_id: "docs::DECISION_ENGINE"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Goal

Turn current state into safe structured proposals by combining deterministic constraints with model reasoning.

## Stages

1. identify trigger,
2. determine affected domains,
3. load source state,
4. apply hard policy,
5. decide whether reasoning is required,
6. assemble bounded context,
7. request structured decision,
8. validate schema/evidence/freshness,
9. persist decision,
10. evaluate action policy,
11. execute or request approval,
12. schedule follow-up,
13. verify and audit.

## Hard policy before model

Use deterministic code for:
- owner identity,
- finance write prohibition,
- kill switches,
- tool/capability visibility,
- protected anchors,
- stale-data thresholds,
- duplicate operations,
- active authority leases,
- constitution edit restrictions.

## Decision types

Core types:
- answer,
- capture,
- clarify,
- remind,
- replan,
- negotiate,
- summarize,
- alert,
- propose_action,
- delegate_agent_job,
- no_message.

## Deterministic planning

Lock fixed anchors and hard constraints first. Generate valid windows/options in code. Let the model compare tradeoffs, not invent physically impossible time.

## Accountability

Challenge once only when the commitment matters, a realistic alternative exists, the reason is flexible, no hard override exists, and intervention remains appropriate.

## Memory and skill candidates

A model proposes candidates. Promotion is separate:
- owner-stated facts remain source-backed,
- inferred stable claims start as hypotheses/candidates,
- preferences require repeated evidence or confirmation,
- procedures require verified successful execution/evidence.

## Safe failure

On invalid structured output, missing source, stale critical data, or provider failure:
- no executor action,
- preserve state,
- bounded retry when safe,
- ask one material clarification or report degraded status.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Decision engine

## Purpose

The decision engine turns current state into safe, structured proposals. It combines deterministic policy with model reasoning. The model never receives unlimited authority.

## Processing stages

1. Identify the trigger.
2. Determine affected domains.
3. Load current source state.
4. Apply hard policy and permissions.
5. Decide whether a model call is needed.
6. Assemble relevant context.
7. Ask for a structured decision.
8. Validate evidence, freshness, and schema.
9. Apply permission policy.
10. Execute or request approval.
11. Schedule follow-up.
12. Update audit state.

## Hard policy before model

Hard policy handles:

- Finance write prohibition.
- External-message approval.
- Sender allowlist.
- Quiet hours and critical exceptions.
- Connector scope.
- Stale-data thresholds.
- Duplicate operation checks.
- Immovable event protection.
- Constitution edit restrictions.
- Kill switch.

## Context packet

A context packet is purpose-specific and capped. It contains:

```json
{
  "trigger": {},
  "now": {},
  "constitution": [],
  "active_commitments": [],
  "day_state": {},
  "relevant_people": [],
  "relevant_projects": [],
  "source_evidence": [],
  "observations": [],
  "hypotheses": [],
  "recent_messages": [],
  "permissions": {},
  "available_tools": []
}
```

Every source item includes ID, timestamp, confidence, and freshness.

## Decision types

- answer
- capture
- clarify
- remind
- replan
- negotiate
- summarize
- alert
- propose_action
- request_approval
- no_message

## Replanning algorithm

Deterministic planning first:

1. Lock fixed anchors.
2. Lock hard overrides.
3. Compute remaining windows.
4. Place high-consequence commitments.
5. Respect dependencies and travel.
6. Apply minimum acceptable durations.
7. Use current health and energy as modifiers.
8. Place optional work.
9. Compare with current plan.
10. Ask the model to choose among valid alternatives and explain the tradeoff.

The model should not invent a schedule outside the valid windows supplied by code.

## Negotiation policy

Challenge once when all are true:

- The commitment matters.
- A viable alternative exists.
- The user's reason appears flexible.
- The user has not issued a hard override.
- The challenge will not create a safety or relationship risk.

After a hard override, record the tradeoff and replan. Do not continue arguing.

## Memory write policy

The model proposes memory candidates. Code decides the destination and review requirement.

- Explicit “remember this” statements may create confirmed facts.
- Stable facts from trusted connectors require source and validity.
- Preferences require repeated evidence or user confirmation.
- Observations require multiple linked events.
- Hypotheses remain tentative.
- Constitution edits always require explicit user approval.

## Message scoring

Suggested score components:

```text
score = urgency
      + consequence
      + actionability
      + novelty
      + confidence
      - interruption_cost
      - recent_message_load
      - cooldown_penalty
```

Critical protected events bypass the threshold. Group candidates with the same near-term action window.

## Safe fallback

If structured reasoning fails:

- Do not execute tools.
- Preserve the event and commitment.
- Send a concise clarification or status message when needed.
- Retry through a bounded background job.
- Escalate repeated failures to the Activity screen.
