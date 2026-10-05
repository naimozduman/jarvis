# J5-M09 / Phase 3.8 daily-use tuning — 2026-10-02

The bounded correction/accountability slice is implemented and deployed to the existing production
alias as `dpl_7uPWDmWWxZcBDqTc84QFkXdaBus4` (READY). This begins real-use tuning; it does not
complete Phase 3.8 or establish a 30-day evidence window. See the
[content-free release evidence](daily-use-evidence-20261002.json).

## Reused and repaired

The existing Brain turn service, versioned prompt modules, canonical conversation/decision records,
memory candidates/evidence/preferences, personality review safeguards, constitution drafts,
accountability engine, hard overrides, intervention registry/cooldowns, quiet-mode state and audit
ledger already existed. The production composition did not connect them into a bounded owner-turn
correction loop, and accountability had no bounded production projection of current commitments,
constraints and challenge history. No new table or migration was added.

Verified owner corrections in Telegram/WhatsApp now enter the existing canonical candidate/evidence
path. They link to the most recent completed, provider-accepted response in the same conversation
within 24 hours; a failed or unsent response cannot take that link. If the target is unknowable the
evidence is explicitly unbound. Receipts are deterministic and provider-free. Replay cannot alter the
original evidence or create another receipt, preference or action; a failure after saving evidence
can recover without a model call.

- `too long`, `be shorter`, tone/challenge/meaning corrections and positive feedback remain one-turn
  evidence. One emotional statement does not activate a permanent trait.
- Three distinct linked completed turns within 30 days can supply provisional preference evidence
  to later context; this does not activate a personality rule. Repeating feedback on one turn does
  not satisfy that condition.
- Explicit ongoing presentation preferences such as `from now on be shorter` use existing reviewed
  preference records, with audited supersession. `default mode`, `friday mode` and `mentor mode` use
  the same path and change presentation only.
- Constitution proposals remain drafts for separate owner review. EDITH cannot be activated by a
  presentation command.

Bounded canonical context now includes active owner-reviewed preferences/traits, current active
constitution items, up to six open commitments, known deadlines/dependencies/windows, scoped
overrides, quiet mode and challenge history. Historical message context identifies Owner/JARVIS.
Grounded avoidance invokes the existing deterministic accountability engine. Unknown constraints
stay unknown. A current explicit English/Turkish minute constraint can shorten the usable window;
an alternate window must already exist canonically, and "today" uses the owner's local date.
An explicit conversational hard override is commitment-scoped and expires after 24 hours; it does
not complete/delete the commitment or bypass security policy. Prepared reply, challenge marker,
override and request completion finalize atomically, with idempotent recovery.

## Proven defects and regressions

| Finding                                                                                                              | Repair and regression evidence                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain greetings inherited unrelated global material uncertainty                                                      | Whole-turn trusted greeting allowlist; unsafe/conflicting/high-consequence routing still retains medium. `casual-chat-routing.test.ts` and `phase-two-evals.test.ts`.                                                         |
| Intervention registry could use an older non-cooling history row; suppressed tactics could still appear in the reply | All matching history participates in cooldown; suppression applies to the actual response; accepted overrides do not consume an unseen tactic. `accountability-intervention.test.ts` and `phase-two-evals.test.ts`.           |
| A minimum action could exceed the remaining deadline or an explicit current time constraint                          | Bound viability by both deadline and current available time; English/Turkish five-minute and owner-local midnight cases. `accountability-intervention.test.ts`, `daily-use.test.ts`, `owner-feedback.db.integration.test.ts`. |
| Challenge history could be missing after a failed final audit write                                                  | Atomic reply/audit/override completion and provider-free replay recovery; controlled database failure rolls back the reply. `phase-two-evals.test.ts` and `owner-feedback.db.integration.test.ts`.                            |
| Model completion evidence could refer to a prior, planned, negated, reported or unknown completion                   | Exact current canonical owner message, affirmative completion statement and one visible owned target are required. Silence and reminder delivery cannot complete work. `completion-evidence.test.ts`.                         |
| Feedback could be duplicated, bound to an unsent response, or stranded between evidence and reply staging            | Canonical ownership/target validation, immutable idempotent capture and staging-failure recovery. `owner-feedback.db.integration.test.ts` and `phase-two-evals.test.ts`.                                                      |
| Reminder acknowledgement was awkward                                                                                 | Presentation changed to `Reminder set.` after existing verification; reminder lifecycle and transport are unchanged. Existing reminder response assertions pass.                                                              |

The communication prompt now asks for a useful answer first, ordinary brevity, concrete opinions,
natural English/Turkish/mixed language, necessary clarification only and bounded challenge. These
prompt instructions are deployed; their qualitative effectiveness remains an owner-review question.
The final language regression also reproduced and repaired a Turkish hard-override trigger mismatch:
`Kesin kararım: atla Workout bugün.` now reaches the same bounded override decision as its English
equivalent. No commitment mutation or security permission comes from that command.

## Evaluation and actual dates

The [16-case daily-life set](../../packages/brain/test/evals/daily-use-cases.ts) covers casual chat,
opinion/advice, low energy, avoidance, missed commitments, replan, requested/ignored reminders,
ambiguous references, meaning/style/positive corrections, hard override, explicit preference and mode
transition in English, Turkish and mixed language. Review dimensions are grounding, usefulness,
brevity, natural tone, challenge strength, necessary clarification, commitment preservation, truthful
action claims and repetition/noise. Deterministic checks cover the relevant boundaries; synthetic
fixtures do not prove provider prose quality. There is no numeric personality score.

Read-only canonical inspection found completed primary-owner transport turns on September 29
(WhatsApp 28), September 30 (WhatsApp 3), October 1 (Telegram 12) and October 2 (Telegram 1), in
America/Chicago. These include prior authorized production verification, not a scored longitudinal
study. The new canonical feedback-evidence baseline is zero. No owner corrections or successful
daily-use outcomes were invented or backfilled. Historical medium greeting count is 15; the
controlled regression establishes the narrower routing defect, not that every historical turn was
misrouted.

## Validation and limits

Full `pnpm run ci` passes: format, lint, strict typecheck, 583 tests, build, bundle and secret scan.
Its 47 database cases skip by default and were explicitly exercised separately: 36 focused reminder/
correction cases, the 10-case disposable migration/job gate and one isolated synthetic reliability
case, all passing with zero skips. The focused Brain set passes 284 tests. Synthetic test fixtures
made no paid model calls or transport sends. Production readiness is HTTP 200, Telegram webhook is
configured with zero pending updates, required runtime grants pass, and the new read-only projection
loads all three current open commitments. Their current execution windows are unknown.

Remaining coverage gaps: owner-rated tone/usefulness, bilingual challenge wording, broader natural
correction paraphrases, energy/availability constraints beyond the bounded phrases, and actual
daily commitment/replan/override episodes. Automatic plan moves continue to require existing valid
plan state and validation; this release does not establish a new executor. A correction receipt
captures the intended meaning but does not silently redo a prior action. Real owner corrections
should be reviewed and turned into scrubbed regressions as concrete defects appear.

Telegram and WhatsApp configuration, reminder lifecycle, policy/authority, finance-write prohibition,
proactive gates, group/non-owner restrictions and EDITH remain unchanged. No canary, live reminder,
new provider comparison or additional authority was used. No Gmail/Calendar, Android, voice,
control-center or executor work was started. A partial evidence window does not authorize unattended
authority expansion; it also does not impose a 30-day block on future read-only work. Work stops at
this bounded release, pending natural owner use.
