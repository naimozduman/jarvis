---
title: "WhatsApp Owner Identity"
document_id: "docs::WHATSAPP_IDENTITY"
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

# Trusted ownership

Server-side configuration and authenticated enrollment bind the canonical owner to the dedicated JARVIS WhatsApp identity.

Never trust a provider-supplied owner ID.

## V1 accepted traffic

Owner-only direct messages.

Phone-style identifiers are normalized inside the provider adapter and compared to enrolled owner identity. LID-style identifiers require separate authenticated enrollment.

## Rejected

- groups,
- broadcasts/newsletters,
- status traffic,
- unresolved aliases,
- malformed identities,
- non-owner senders,
- provider history/protocol events as live commands.

## Privacy

Raw JIDs/phone identifiers stay inside the narrow adapter/local boundary where possible. Canonical records use opaque references/hashes.

## Future contacts/groups

Supporting other people requires a new contact/privacy model and accepted policy. Do not enable it by merely relaxing parser rules.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# WhatsApp owner identity resolution

## Trusted source of ownership

Server configuration supplies the canonical JARVIS owner and configured owner phone. The webhook payload never supplies an owner ID that JARVIS trusts. `EvolutionOwnerIdentityResolver` is provider-specific authentication logic; the Brain never decides whether a sender is the owner.

## Supported V1 direct-message shapes

| Provider identity shape | V1 result |
| --- | --- |
| Phone JID such as `number@s.whatsapp.net`, `number@c.us`, or `number@whatsapp.net` | Normalize digits and compare to configured owner |
| LID JID | Accept only when its exact LID was separately enrolled by authenticated owner/admin control and supplied as `JARVIS_OWNER_WHATSAPP_LID` |
| Alternate/device phone identity such as `number@c.us` | Normalize its direct phone portion and compare to configured owner |
| Any nonmatching/malformed identity | Redacted rejection; no Brain execution |

Provider-supplied `remoteJidAlt`, `participant`, and `participantAlt` are descriptive only: they can never turn an unknown sender or LID into the owner. This prevents a spoofed provider payload from self-asserting an alternate owner phone. The resolver uses opaque hashes outside the adapter. It does not persist a raw JID in canonical messages, telemetry, audit, or Brain context.

## Explicit exclusions

Group JIDs (`@g.us`), broadcast/newsletter JIDs, status traffic, unresolved LIDs, and malformed senders are rejected. V1 does not support group Brain interaction. Any future group/contact support requires an approved-contact decision, explicit scope, new deterministic policy, privacy review, and tests; it must not be enabled by an adapter parsing change.

## Test coverage

Provider-free transport evaluations cover normal phone JID, enrolled LID, alternate direct phone ID, mismatched and spoofed alternate identity, malformed identity, group, broadcast/newsletter, status, quoted reply, and spoofed protocol/history fixtures.
