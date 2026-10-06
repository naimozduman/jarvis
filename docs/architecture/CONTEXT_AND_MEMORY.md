# Context and memory

Reconciled October 5, 2026. This document retains compatible detailed requirements from the R1 reconstruction. [Current decisions](../product/DECISIONS.md) and V5 subsystem owners control newer phasing and authority. Source citations remain historical evidence, not current provider/device verification.

Responsibility: the permanent personal index, retrieval, knowledge quality and retention. Collection mechanics belong to [PASSIVE_CONTEXT_ENGINE.md](../design/PASSIVE_CONTEXT_ENGINE.md); authorization and disclosure enforcement belong to [SECURITY_PRIVACY_AND_PERMISSIONS.md](../security/SECURITY.md).

**Product requirement:** JARVIS should answer meaningful questions across years of personal information, including messages, people, places and activity. This is not a vector-database requirement. S1-M0187 explicitly expands location beyond the assistant's temporary-context assumption; S2-M0031 and M0045 establish personal history search and contextual recall. The current request explicitly requires the complete indexed system. [R005, R014–R017, R028–R034]

## Information model

| Record family                 | Examples and relationships                                                                          | Important distinction                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Identity and preferences      | Owner, aliases, goals, routines, constraints, communication preferences, approved personality rules | Explicit preference outranks inferred habit                                           |
| People and relationships      | Friend, partner, collaborator, contact accounts, relationship context                               | Shared names/numbers do not prove identical people                                    |
| Conversations and messages    | Network, account, chat, participants, message revisions, replies, reactions and attachments         | Provider author, JARVIS drafter and actual sender are separate fields                 |
| Places and businesses         | Coordinates, uncertainty region, address, venue, branch, visit                                      | A shopping center visit does not identify a particular store or purchase              |
| Events and activity           | Calendar event, trip, visit, app session, notification, purchase evidence, workout                  | An observation, a tentative interpretation and an owner-confirmed event are different |
| Objects and saved information | Screenshot, photo, document, file, export archive, saved webpage, URL and extracted text            | OCR or summaries retain source reference and extraction quality                       |
| Work and intention            | Project, commitment, Case, condition, deadline, decision, action, dependency                        | A scheduled reminder is one mechanism attached to an intention                        |
| Derived knowledge             | Summary, recurring pattern, hypothesis, relationship edge, embedding, retrospective                 | Derived data is revisable and inherits privacy restrictions                           |

Every durable record needs an owner/scope, stable identity, provenance, timestamps, revision, sensitivity and retention class. Evidence-bearing records also need source completeness, extraction method/version and confidence where interpretation is involved. Store original source time and timezone/uncertainty separately from import time. An export without timezone must not be silently localized as a precise fact.

Use relational records and explicit edges for the initial entity graph. PostgreSQL full-text/exact indexes and an optional pgvector index are a coherent candidate with the existing SQL baseline. A separate graph or vector service needs a measured requirement, not enthusiasm. Binary originals live in private object storage with hashes, manifests and access controls; the database keeps references and extracted metadata.

## Six complementary retrieval paths

| Path                    | Best for                                                                | Contract                                                             |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Exact/structured search | Names, order IDs, amounts, phone numbers, phrases, source message IDs   | Preserve literal evidence, date filters and identity disambiguation  |
| Semantic search         | “The shoes I saved for that wedding” without exact wording              | Candidate discovery; embedding similarity is not truth or permission |
| Entity relationships    | Which business belongs to a person, which messages concern a project    | Return evidence-backed links with time validity                      |
| Chronological memory    | Where the owner was on a date; what preceded a decision                 | Resolve timezone, ordering, coverage gaps and overlapping events     |
| Recent context          | Current screen/app, active conversation, today's plans and current Case | Short-lived, timestamped, explicit freshness                         |
| Derived knowledge       | A project summary, recurring obstacle, approved preference              | Show its sources, generation time and whether it needs rebuilding    |

Apply the Context Firewall **before candidate retrieval**, then again to assembled evidence and output. Choose the minimum relevant sources, deduplicate, rank for relevance/recency/authority, and fit a bounded evidence packet. The packet includes the question, allowed purpose, evidence IDs, selected excerpts, relevant entity links, freshness, conflicts and missing coverage. A larger context window is not a reason to send the owner's entire archive.

Return answers with inspectable source links or record references. Separate “I found evidence that…” from “a possible explanation is…”. If retrieval is empty, state the searched scope and gap. The model cannot invent a memory to provide a fluent answer. Exact search must remain available without embeddings or a paid model.

## Facts, observations and hypotheses

An observation records what a source actually exposed. A fact can be explicit owner input or sufficiently direct evidence within its scope. A hypothesis interprets observations and remains revisable. “Bank notification says $24 at a merchant” is different from “you bought lunch” and from “you ate an unhealthy meal.” Repeated uncertain inferences must not become facts through repeated summarization.

Maintain supporting and contradicting evidence, confidence basis, validity interval and supersession. New direct owner correction overrides the old interpretation; preserve a minimal correction trail without continuing to retrieve the wrong fact as current. Source conflicts may reflect different clocks, duplicate devices or genuinely different events. Do not blend WHOOP and Apple Health workout records into a fabricated single result.

User goals and stated commitments govern assistance. Observation that the owner repeatedly stays up late does not authorize changing the goal to “stay up late.” Behavioral tactics, including identity practice/LARP-style strategies discussed in S1-M0003, are optional interventions tied to user goals. Treat their effectiveness as a hypothesis, not psychological diagnosis.

## Memory control and onboarding

October 2 implemented checkpoint: deliberate owner-authored baseline input now uses existing
onboarding answers, memory candidate/evidence/promotion and versioned constitution review.
The verified private owner receives a numbered draft and must explicitly confirm its current
provider-accepted revision before activation. Corrections preserve item identities and evidence;
uncertainty remains a hypothesis. Approved projects/preferences/commitments/constitution items
enter the existing bounded assembler, while private people/relationship material retains named
request scope through canonical projections and subsequent conversation history. No external
history import or context-budget increase is included. See the [bounded implementation and proof](../progress/owner-bootstrap-20261002.md)
and [ADR 0023](../ADR/0023-owner-authored-baseline-review.md). The production owner still needs
to deliberately supply and review the first baseline; synthetic tests do not supply one.

Onboarding should prefill a questionnaire from supplied information, mark inferred answers and let the owner correct them. The resulting profile is versioned and inspectable. Show what JARVIS knows, why it believes it, which sources it uses and what an agent is allowed to see. Provide correction, forgetting, exclusion, export and pause controls.

The user explicitly requested an inspectable “brain.” Personality freeze/reset controls were an assistant implementation design in S1-M0024; retain them as a useful design option, not a historical requirement to erase all memory. Freezing adaptation must not freeze factual corrections or security updates. Resetting conversational style should not silently delete commitments. Deleting a source must trigger removal or recomputation of dependent summaries, embeddings and caches according to policy.

## Personal archive bootstrap

Imports supplement live connectors. S5 explored company data exports; it did not establish that companies export every internal record or that every suggested connector is required. Start with supplied chat/message/file archives that solve an actual retrieval need.

For each import, retain an encrypted original if authorized, a content hash, acquisition time, export format/version, account identity, date coverage and known omissions. Parse into a staging area, validate speaker identities and timestamps, detect duplicates, and show a coverage summary before treating it as complete. Reimport must be idempotent. A newer export may contain edits, deletions or a different date range; it is not simply appended as new history.

Potential later sources include Google/Meta/Apple/Amazon/Microsoft/ChatGPT exports, saved web data, music, wearable and transport histories. Each needs its own format and permission verification. Searchable personal history can remain useful when a provider no longer offers the source through its live API, subject to retention and deletion rules.

## Retention that supports years without storing all noise

The categories below are architecture defaults in principle; exact durations and sensitive-cloud choices remain Q02. “Permanent index” means durable, portable, meaningfully searchable memory under owner control, not an irrevocable record of everything.

| Class                                 | Treatment                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw ambient signals                   | Short local buffers, off unless needed, exclude sensitive apps/fields, discard after useful event extraction                                                    |
| Meaningful events                     | Durable with evidence, confidence and retention category; location visits/timeline may be retained for years by owner choice                                    |
| Intentionally saved screenshots/files | Retain original plus extracted index when authorized; distinguish deliberate save from automatic capture                                                        |
| Messages and exports                  | Retain selected history with source completeness, conversation sensitivity and deletion policy; disappearing/private-message behavior requires an explicit rule |
| Active Cases and commitments          | Persist until resolved, canceled or deliberately forgotten; then retain an appropriate decision/action record                                                   |
| Summaries and embeddings              | Derived, rebuildable, privacy-labeled; remove or rebuild when source permission or truth changes                                                                |
| Security/action audit                 | Minimal evidence necessary for accountability; redact content/secrets and separate retention from the personal narrative                                        |

For sensitive records, a local-only option must prevent derived text, embeddings, filenames, thumbnails and logs from leaking to cloud services. A backend cannot search raw local-only data it does not possess. Support device-local retrieval or an explicitly approved narrow summary; show reduced coverage elsewhere.

Backups complicate deletion. Tombstone live records, invalidate caches and derived indexes, and document when encrypted backups age out. Restore must replay deletions and permission changes before reconnecting devices. Do not promise immediate physical erasure from every provider or immutable backup.

## Concrete retrieval examples

**“What is she talking about?”** The owner invokes JARVIS over a conversation. With screen-context permission, identify the current chat/visible reference, resolve the person, retrieve relevant messages and events, and answer privately to the owner with evidence. Business details do not flow into an outgoing relationship reply merely because they were visible to JARVIS. [S2-M0045]

**“Where was I on May 26, 2027?”** The date was a future illustrative query in S1-M0187, not a historical trip to invent. When that date exists in collected data, combine visits, calendar and message evidence. Give uncertainty and uncovered periods; do not return a precise itinerary from an approximate location sample.

**“Find that shoe design screenshot.”** Search OCR, visual description, save date and project/person links. A saved shoe is an interest signal, not proof of purchase. Attach it to a project or Case only when the relation is supported. [S2-M0031]

**Summer journal.** Later, assemble photos, music, location and activity into a reviewable retrospective with evidence. Ask about ambiguous identity/event links; process selectively to control cost. Apple Music remains the known service from the discussion; Spotify is a conditional future alternative if needed data access is verified. [S1-M0189]

**Relationship memory.** Keep detailed private context in a restricted relationship collection; expose approved summaries to suitable agents. The finance seat does not need intimate conversation history, and a partner-facing reply does not need business revenue or client details. The detailed enforcement model lives in the security document.

## Acceptance checks

Verify exact retrieval of a known message, semantic recovery of a deliberately paraphrased saved item, date/entity filtering, explicit coverage gaps, ambiguous-person separation, source correction propagation and deletion across embeddings/caches. Test that forbidden evidence never enters an agent packet even when it is the highest semantic match. Prove years-scale indexing with representative volume before buying specialized infrastructure. Offline search must state that it covers the cached subset only.
