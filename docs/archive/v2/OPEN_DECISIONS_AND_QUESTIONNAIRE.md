# PRD V2 Open Decisions and Owner Questionnaire

Historical V2 proposal/source document, retained during the October 5, 2026 reconciliation. The current product-intent hierarchy is `docs/JARVIS/`, reached through `CODEX_START_HERE.md`. Proposed imports, ADR numbers, commands and authority claims here remain historical and do not adopt V5 or authorize a new implementation.

These questions do not block preserving the product direction. They should be answered before the relevant implementation phase.

## A. Life Ledger and historical recall

1. How long should exact location points be retained?
2. Should compressed place visits remain forever?
3. Should location history be cloud stored, local only, or hybrid?
4. Should app-usage history retain app names, categories, or only distraction summaries?
5. What level of gallery access is acceptable?
6. Should selected photos receive permanent descriptions?
7. Should JARVIS create daily summaries automatically or only on request?
8. Should monthly/yearly summaries be owner-confirmed before becoming searchable?
9. What data should be excluded from historical recall by default?
10. Should the owner be able to mark periods as private or sealed?

## B. Journal

1. Daily prompt time and frequency?
2. Voice versus text preference?
3. Should JARVIS suggest moods or only ask open questions?
4. Should Journal entries be editable without preserving prior versions?
5. Should relationship Journal entries use a separate vault?
6. Should Journal summaries be model-generated automatically?

## C. Voice

1. Preferred wake phrase?
2. Preferred voice and formality?
3. How often may JARVIS escalate into call-style UI?
4. Should voice sessions be stored as transcripts, summaries, or not retained?
5. How should background noise and low-confidence transcripts be handled?
6. Should JARVIS speak longer answers or default to a short answer plus offer details?

## D. Android and device context

1. Which data should be local-only?
2. Exact location versus place categories?
3. Notification metadata only or selected contents?
4. Which apps may JARVIS monitor for usage?
5. Which apps may it temporarily block?
6. What override delay is acceptable?
7. Should a dedicated managed phone be considered later?
8. Should device rules continue offline?

## E. Accountability and commitment devices

1. Preferred escalation ladder?
2. Which commitments deserve stronger enforcement?
3. Should JARVIS notify an accountability person?
4. Should app/site blocking ever occur automatically?
5. How long should blocks last?
6. Should JARVIS require an override reason?
7. Are bounded financial commitment devices ever acceptable?
8. If yes, what hard cap, grace period, and cancellation rule?
9. Which tone is acceptable during a lapse?
10. When should sympathy override strictness?

## F. Relationship Vault

1. Which communication sources may be imported?
2. Raw messages, summaries, or both?
3. Should intimate conversations remain local-only?
4. Can JARVIS identify unresolved conflicts?
5. When may it surface a relationship reminder?
6. Should it ever draft or send a message to a partner?
7. What explicit approval is required?
8. How should the other person's privacy be handled?

## G. Calls and recordings

1. Should JARVIS support call transcription?
2. Only calls where all participants consent?
3. Raw audio retention period?
4. Local-only versus encrypted cloud archive?
5. Automatic extraction of commitments?
6. Owner review before summaries enter the ledger?

## H. First-party apps

Rank priority:

- Journal;
- Food;
- Training;
- Calendar;
- Movies;
- Calculator;
- Relationship Vault;
- media/music;
- reading/research;
- finance dashboard.

For each app, decide whether JARVIS Core or the app owns the detailed domain record.

## I. Web control center

1. Which pages are needed for the first usable release?
2. Passkey-only or backup login method?
3. Should the chat UI be part of the first release?
4. Which Brain records may be edited directly?
5. How much raw audit detail should be visible by default?
6. Should historical map views exist?
7. Should private sources require reauthentication?

## J. Capabilities and authority

1. Which actions may be always allowed?
2. Which are allowed once or for a time window?
3. Which require biometric approval?
4. Which are permanently prohibited?
5. What purchase limits are acceptable?
6. Should JARVIS ever message other people autonomously?
7. Which SSH actions are acceptable?
8. How should emergency kill switches work?

## K. Modes

1. Do the names JARVIS, FRIDAY, KAREN, and EDITH feel right?
2. Should modes be selected manually, automatically, or both?
3. Which capabilities are exclusive to EDITH?
4. What tone should each mode use?
5. Should the name/voice change while the canonical identity stays the same?

## L. Cost and infrastructure

1. At what usage point is paying for a better model acceptable?
2. Preferred monthly model budget once paid usage begins?
3. Should expensive historical analysis ask for confirmation?
4. What data merits paid photo/audio analysis?
5. Which infrastructure services may move to paid tiers first?
