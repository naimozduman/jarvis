# Memory engine

## Structured classes

Memory remains typed: facts, preferences, people, relationships, projects, observations, hypotheses, open loops, and personality traits. The engine does not collapse them into a generic JSON blob. Candidate records remain separate from reviewed durable records.

Every candidate preserves owner, source authority, confidence, sensitivity, validity interval, review time, state, related entities, evidence references, and timestamps. Durable memory tables also retain evidence counters and review/supersession fields.

## Deterministic promotion

- Explicit owner statements are strongest evidence, but become candidates before durable use.
- Model inference is normalized to a hypothesis and always requires owner confirmation.
- Observed behavior remains an observation; it cannot become a fact or rewrite the constitution.
- Preferences need repeated evidence or explicit owner review. One frustrated message cannot set a permanent “zero reminders” preference.
- Untrusted external content cannot directly create durable memory.

`MemoryService` exposes type/entity/relevance retrieval, active facts, open loops, candidate creation/confirmation/rejection, supersession/deactivation, stale review, linking, and evidence recording. Confidence is a bounded evidence signal, never a claim of objective truth.

## Open loops and personality

Open loops carry follow-up/review time, uncertainty, related entity/commitment, and resolution state so unfinished ideas can resurface without becoming facts. Personality traits are bounded delivery preferences only. They track estimates, confidence, evidence counts, freezing, manual editing, reset, review, and learning opt-out; they cannot affect values or permissions.
