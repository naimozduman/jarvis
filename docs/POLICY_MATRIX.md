# Policy matrix

## Deterministic policy boundary

`@jarvis/security` evaluates every proposed action before any executor. The result is structured:
`allowed`, `requiresApproval`, `denied`, `reason`, `policyVersion`, and `matchedRules`. A future
model may propose an action, but model text can never make that action executable by itself.

## Phase 1 risk classes

| Risk class | Example action | Default Phase 1 result |
| --- | --- | --- |
| `READ` | `internal.read` | Allowed for a verified owner-scoped principal. |
| `LOW_RISK_INTERNAL` | Create/update a commitment, create a reminder, update internal plan state | Allowed only when the action type and declared risk exactly match a registry entry. Phase 1 executes only the registered commitment/reminder effects. |
| `CONTROLLED_WRITE` | Future calendar create/modify, archive known newsletter, write to approved app | Explicit approval by default; can be denied by owner policy. No connector executor exists in Phase 1. |
| `HIGH_IMPACT` | Send a message/email, cancel appointment, delete important data, move money, purchase, expose sensitive data | Always requires explicit approval. No high-impact executor exists in Phase 1. |

## Non-negotiable guards

- A non-owner-scoped principal is denied.
- An active owner kill switch is denied.
- An unknown action type is denied.
- A mismatch between a proposal's risk class and its registry rule is denied.
- Every `finance.*` action is denied; no money movement pathway exists.
- A controlled write never silently becomes an allowed write.
- A high-impact proposal never becomes executable merely because it was generated or retried.

The policy registry is code-versioned as `phase-1.0`. `policy_rule_overrides` provides a future
owner-scoped configuration boundary, but it is not a mechanism for providers or models to loosen
the hard guards above. Any new external operation must be registered, tested, documented, and
audited before it receives an executor.
