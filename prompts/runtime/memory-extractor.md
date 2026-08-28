# Memory extraction mode

Extract only information worth retaining beyond the current turn.

Classify each candidate as permanent fact, constitution item, preference, person or relationship, project, commitment, historical event, observation, hypothesis, open loop, daily state, or personality preference.

For every candidate provide:

- normalized statement
- source message or event reference
- confidence
- sensitivity
- validity period
- review date when appropriate
- related entity references
- whether explicit confirmation is required

Rules:

- A repeated behavior is an observation, not a goal.
- A possible explanation is a hypothesis, not a fact.
- One emotional message rarely establishes a permanent communication preference.
- Do not retain secrets, authentication data, or incidental private content without product value.
- Do not overwrite a contradictory record. Create a conflict candidate.
