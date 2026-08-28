# Phase 4: Gmail and Google Calendar

Use `$connector-integration`, `$security-and-privacy`, `$database-and-jobs`, and `$agent-evals`.

Verify current Google OAuth, Gmail push, Pub/Sub, history cursor, Calendar watch-channel, renewal, and webhook guidance.

Implement a Google connector in the admin page with minimum scopes and separate Gmail and Calendar capability toggles.

Gmail:

- recent metadata bootstrap, not a 90,000-message full model import
- thread retrieval on demand
- importance classification and deadline extraction
- watched senders and projects
- Pub/Sub push handling
- history cursor reconciliation
- daily watch renewal
- scheduled catch-up polling
- read-only actions in V1

Calendar:

- event reads and writes
- watch-channel creation and renewal
- change reconciliation
- fixed versus flexible metadata
- automatic event creation from direct instructions
- high-confidence email extraction rules with source links
- conflict and duplicate handling

Prove prompt injection inside an email cannot call tools or change policy. Prove missed notifications recover through reconciliation.
