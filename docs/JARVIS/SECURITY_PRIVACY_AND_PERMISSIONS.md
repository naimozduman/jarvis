# Security, privacy and permissions

Responsibility: authority, disclosure, secrets, sensitive storage and execution boundaries. Android API evidence is in [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md); retention mechanics in [CONTEXT_AND_MEMORY.md](CONTEXT_AND_MEMORY.md).

**Confirmed product direction:** broad authorized personal context with narrow disclosure, standing permissions that avoid repeated approval for harmless work, and a Guardian that agents cannot rewrite. S1-M0187, S8-M0003 and S2-M0045 are decisive. The detailed control design below is architecture synthesis. No operational grant, account access or device enrollment is created by this documentation. [R009, R026, R034, R045, R062–R065]

## Separate the control functions

| Control                      | Question answered                                                                           | Enforcement                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Guardian / authority service | May this actor take this action on this resource now?                                       | Deterministic, versioned policies and scoped grants checked outside the model                        |
| Context Firewall             | Which information may this actor retrieve, combine and disclose for this purpose/recipient? | Query filtering, projected evidence packets, tool-result filtering and output/channel checks         |
| Credential Vault and brokers | How can a permitted tool authenticate without exposing secrets to a model?                  | Encrypted secrets, narrow service identities and credential injection at execution boundary          |
| Cost Governor                | Can this run reserve enough money, time and steps under every applicable cap?               | Atomic accounting and admission control; see [AI_ROUTER_AND_COSTS.md](AI_ROUTER_AND_COSTS.md)        |
| Action Ledger                | What was authorized, attempted and actually happened?                                       | Appendable outcome evidence and explicit corrections; no invented success or hidden chain of thought |

These controls can share a codebase but must not collapse into a system prompt. A Council agent, chairman, imported skill or model-generated plan cannot edit its own policy, budget, identity or context labels. Human owner policy changes are authenticated and auditable; “unmodifiable by the agent” does not mean the owner can never change JARVIS.

## Three different permissions

1. **OS/provider capability:** Android permission, default role, OAuth scope, connector token or management enrollment makes an operation technically possible.
2. **JARVIS authority:** a standing rule or task grant determines whether this agent may use that capability for this purpose.
3. **Disclosure scope:** information allowed into a particular model, agent, conversation, notification or external recipient.

Granting Notification Listener access does not authorize sending messages. Granting email OAuth does not authorize every reply. Giving JARVIS business context does not expose it to the partner conversation, a football agent or a remote model by default.

## Grant design

A scoped grant identifies owner, actor, tool/action class, resources/accounts, recipients, purpose, data categories, spending/action bounds, time window, revocation version and relevant preconditions. Bind one-time approvals to the concrete action payload or hash so a materially changed recipient, amount or message needs reauthorization. Use standing permissions for recurring low-risk work, with visible management and expiry where appropriate.

| Action class                                                              | Intended handling                                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Search permitted personal records; summarize an allowed Case              | Standing read scope; no repeated confirmation for each lookup                                                                               |
| Create a private note, draft or internal reminder                         | Low-risk scope, reversible and logged                                                                                                       |
| Add/replan clear owner calendar items                                     | Standing calendar rules can authorize; ambiguous participants/dates or consequential changes escalate                                       |
| Send a routine message in an active approved Handoff                      | Recipient/topic/time/budget grant; recheck immediately before send                                                                          |
| Operational email correspondence for a persistent task                    | Later task-scoped capability; MVP remains read/draft until grants are configured                                                            |
| Purchase, transfer, subscription change or destructive external action    | Concrete authority and limits; high-impact/ambiguous changes require explicit approval unless an equally concrete standing rule covers them |
| Change security policy, reveal secrets, expand agents or increase budgets | Owner-controlled policy change; never inferred from agent plans                                                                             |

The early S1-M0003 email “no sending” position was expanded by S8-M0003–M0005's endorsement of operational email work. Preserve both chronology and scope: later capability approval is not a current blanket mailbox grant. Likewise, approval of future payment brokering does not authorize a purchase today. The rejected transfer-to-a-friend punishment remains rejected regardless of payment infrastructure.

## Context Firewall

Label records by owner, sensitivity, domain, source, people involved, retention class and allowed purposes. Use field-level projections where an agent needs only a small part of a record. Derivations inherit the most restrictive applicable source rules; summarization does not automatically declassify information.

At retrieval time, determine the actor and intended audience before running exact/semantic queries. Restrict the search itself, then project selected evidence. Repeat checks on tool results, private agent memory, shared Council posts, outgoing messages, voice output, lock-screen notifications and export files. Cache keys include scope/policy version so a privileged response cannot be reused in a lower-trust context.

Examples:

- The owner asks privately about a partner's reference: relationship history may be retrieved. A reply to the partner receives only the permitted relationship/task context, not unrelated business data.
- A finance Council seat can see approved cash-flow summaries; a football seat receives football/news context. The chairman mediates disagreement through allowed summaries, not by copying all private workspaces into a group prompt.
- A locked phone displays “JARVIS needs your attention” rather than sensitive message/financial details unless the owner explicitly permits previews.
- A cloud model can receive a redacted calendar constraint while detailed relationship notes remain local or in a restricted vault.

The Firewall reduces exposure through deterministic data boundaries. A final LLM instruction or content classifier is not a proof of perfect non-disclosure. Test with adversarial retrieval, malicious source text, mixed-sensitivity summaries, indirect references and stale caches. If the intended answer needs forbidden context, ask for an appropriate scope change or answer within the allowed boundary.

## Android permission posture

Request permissions at the relevant feature, explain concrete benefit and loss on denial, and keep a capability dashboard. HOME and optional assistant roles, notifications, usage access, Accessibility, location, microphone, selected media/files, calendar and optional VPN are separate. Private APK installation does not remove Android runtime restrictions. Restricted-settings flows, OEM battery behavior and target SDK rules need testing.

Device Owner is an optional managed-device tier, not root and not a default requirement. It can enable stronger supported policy controls but changes provisioning and ownership constraints. Test on a spare/fresh device first. No factory reset is authorized. Do not assume a personal phone with accounts/work profiles can be enrolled in place. Define backup, unenrollment, emergency access and recovery before any enrollment decision.

Knox is an optional Samsung extension whose individual APIs may require appropriate management mode, entitlement and licensing. Do not assume all SDK calls work on a retail T-Mobile handset or that an ADB Device Owner setup supplies every Knox prerequisite. Eligibility is T06; owner enrollment is Q05. Keeping Wallet/banking usable remains a product constraint, not an untested promise under every management configuration.

## Credentials, identity and network boundaries

Use owner authentication independent of Google/Samsung phone identity, plus explicit OAuth for each connected account. A private signed APK and authenticated private backend are the current distribution direction; no public launch is required. Passkey/device-bound authentication is a suitable design candidate, with a tested owner recovery path before it becomes the sole access method.

Store phone keys with platform-backed protection where available; encrypt local databases and selected files with application key management. Backend keys belong in a secret manager or encrypted service configuration, not source control, chat history or model prompts. Restrict database runtime, migration, connector and executor roles separately. The model receives a tool handle and result, never an unrestricted credential bundle.

Prefer outbound authenticated connector connections. A Beeper bridge should expose only approved operations through JARVIS; do not publish its full desktop API or token on the internet. Use TLS, short-lived/revocable device credentials, replay protection and schema validation. Browser/desktop workers use isolated profiles and limited mounts; their network access is restricted to the task where practical.

Treat messages, websites, PDFs, tool output, imported memories and third-party skills as untrusted data. Instructions inside them cannot change policies, run shell commands or request secrets. Installation of a new tool or skill requires provenance review and a bounded capability manifest. Observation-based workflow learning produces a proposed skill for testing; it does not silently deploy new authority.

## Storage, logs and recovery

Separate raw sensitive evidence, derived summaries and minimal operational audit. Logs record correlation IDs, policy decisions, statuses, latency and cost without dumping prompts, tokens, QR codes, credentials or private message bodies. Retain selected input/output evidence only under the personal-data policy. Do not store hidden model reasoning as an audit mechanism.

Back up canonical SQL, object manifests and encryption/recovery material through separate controlled paths. Test restoration with consistent object references, tombstones, grants and action/job generations before reconnecting executors. A restored backup must not resend old messages or resurrect revoked permissions. Encrypt backups and record retention/deletion limits. Historical reported recovery windows are not proof of present recoverability.

Provide an owner-accessible stop control that pauses autonomous sends/executors while keeping the phone, memory inspection and essential local functions accessible. Revocation should cancel pending work and fence stale jobs; already-started external actions may still complete and must be reconciled. Offline devices use only limited cached low-risk grants; consequential operations wait for current authority.

## Threat model and acceptance

| Threat                                 | Required mitigation / test                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Lost phone or exposed notification     | Device lock, encrypted cache, minimal lock-screen content, credential revocation and recovery test                          |
| Malicious chat/web content             | Treat as evidence, separate instructions, restrict tools and test prompt injection                                          |
| Compromised Council seat or executor   | Scoped context/tools/budget, no database master key, no lateral private-memory access                                       |
| Cloud provider exposure                | Minimum permitted evidence, provider-specific retention settings verified before use, local-only option for restricted data |
| Duplicate/replayed action              | Idempotency, live grant/generation checks, outcome reconciliation                                                           |
| Wrong person/account/recipient         | Stable IDs, ambiguity handling and action preview/preconditions                                                             |
| Runaway cost or agent loop             | Independent budget/step/time enforcement and kill switch                                                                    |
| Backup rollback or stale device        | Tombstone/revocation replay, version fencing and no automatic stale sends                                                   |
| Sensitive inference presented as truth | Evidence/confidence separation, correction propagation and narrow retention                                                 |

Acceptance requires proving both allowed useful work and denied boundary-crossing work. Avoid a design that is safe only because it asks the owner about every harmless read; avoid one that is convenient only because every agent has unrestricted access.
