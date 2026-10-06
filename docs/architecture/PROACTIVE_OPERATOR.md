---
title: "Proactive Work and Interruption Budget"
document_id: "docs::PROACTIVE_OPERATOR"
status: "active"
authority_class: "protected"
owner_role: "backend_implementer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Work and interruption are separate budgets

Run durable, source-backed scheduled/event work within policy and resource limits. Delivery requires an additional interruption decision. Lack of response does not complete a commitment.

## Proposed default

One normal interruption unit is one unsolicited owner notification group, not one sentence or item. Six normal units per owner-local calendar day, zero minimum, no rollover. A morning brief and shutdown report each count when sent. Owner-requested replies and scheduled reminders explicitly requested by the owner use their registered delivery policy, not a quota for spontaneous suggestions. The policy must show each class's accounting, not hide all alerts behind an exception.

Group related items. At ordinary exhaustion queue a digest; do not drop the underlying deadline. Critical bypass requires a registered urgency class, explicit consequence, deduplication, bounded cooldown and audit. Critical does not bypass spend, identity, approval or kill controls. No unbounded alert loops.

Use actual owner sleep/quiet windows with timezone and freshness. Midnight-to-6am is not inherently sleep for a night-shift owner. Stale sleep status narrows interruptions and authority.

## Metrics

Record units used, groups delivered, suppressions, bypass reasons, duplicate suppression, owner dismissals and useful follow-through. No mandatory six-ping floor. Do not treat a lower interruption count as proof of improved behavior.
