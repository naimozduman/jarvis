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
