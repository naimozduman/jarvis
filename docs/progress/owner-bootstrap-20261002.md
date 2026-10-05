# Owner Bootstrap / Personal Baseline — 2026-10-02

The bounded path is implemented and deployed as `dpl_emHn9CaBPVSBuBrfKxmJ3SxE6W6m` (READY)
at the existing `jarvis-api-staging.vercel.app` production alias. All pre-deployment gates pass. The production release and
read-only checks are recorded in [content-free evidence](owner-bootstrap-evidence-20261002.json).
The [implementation decision](../ADR/0023-owner-authored-baseline-review.md) records the approval,
privacy and replay boundaries. This slice prepares deliberate owner-authored baseline capture;
it does not complete J5-M09 or claim an owner baseline already exists.

## Existing systems and the missing connection

The repository already had onboarding questionnaires/answers, memory candidates/evidence and
promotion rules, typed facts/preferences/people/relationships/projects/open loops, versioned
constitution drafts/items, commitments, canonical conversation records, context manifests,
prompt modules, policy/action audit and the accepted daily-use correction/accountability path.
Production metadata inspection found zero bootstrap questionnaires, zero bootstrap memory roots
and zero active constitution items for the primary owner. Existing commitments remain intact.

What was missing was a verified private conversation path to extract a small proposed baseline,
show a current review, apply explicit owner corrections and promote approved records atomically.
Approved project/person/open-loop roots also lacked a bounded production context projection.
No table or migration was added. The existing memory promotion policy is shared through contracts
so the database finalizer and Brain retain the same policy.

## Implemented behavior

- Deliberate natural-language baseline input in private verified Telegram or WhatsApp uses the
  existing conversation Brain call with a narrow versioned extraction module. Only the current
  owner message may supply evidence; history, external sources and model action intents cannot
  supply baseline authority.
- The server renders a numbered review. All extracted records remain candidates until approval.
  Goals, durable rules, prohibitions, recurring obligations and standing promises are constitution
  drafts. Facts, preferences, projects, people, relationships, open loops and near-term commitments
  use their existing canonical concepts. Ambiguous or uncertain input remains a hypothesis.
- `yes, save those` confirms only the current revision of a review already accepted by the
  provider before that confirming input arrived. Local persistence, an older review, `yes`,
  composite consent or later delivery cannot activate the current draft.
- `not that one 2`, `change 2 to …`, `temporary 2 until YYYY-MM-DD` and `not a goal 2`
  reuse item identities and preserve evidence/version history. Ambiguous corrections ask for the
  item number. Temporary scope without an expiry stays pending. Expiry uses the canonical owner
  timezone. Approved state stays unchanged until a fresh review is confirmed.
- Approval and numbered controls are deterministic and provider-free. Atomic finalization and
  replay recover after a staged decision without a second model call or duplicate entity/action.
  A wording correction does not silently broaden previously private context.
- Approved near-term commitments enter the existing internal commitment action, policy and audit
  path. Their supplied date wording is retained; this bootstrap does not create calendar events,
  deadlines, reminders, plan blocks or timed executions. Removing a baseline item does not cancel
  an existing commitment. Silence never completes work.
- Private personal summaries require the deliberately supplied name in the current owner request.
  This scope survives hypothesis/constitution/commitment classification and correction. Restricted
  details are redacted and excluded from accountability guidance. Raw source/review messages and
  later turns consuming scoped records cannot reintroduce those details through general history.

## Proof and controlled failures

The disposable test invokes the production ConversationTurnService, DrizzleBrainRepository,
canonical action/policy path and ContextAssembler with a fake gateway. It stages and confirms an
owner-authored baseline, then processes a later Brain request that selects constitution,
preference, project and commitment records within the existing 32-record / 12-recent-message /
6,000-approximate-token limits. No context budget was enlarged. Model-generated finance intent
and false success wording are ignored by bootstrap.

Regressions cover current-source grounding, uncertainty, private scope, exact consent, ambiguous
and numbered corrections, expiry, revision freshness, JSON-key-order stability, late provider
acceptance, approved entity/version supersession, duplicate/concurrent approval, conflicting
batch aliases, revoked enrollment, non-owner/group exclusion, rollback and replay recovery.
Additional production-service regressions prove that a private commitment and a named-person
answer cannot leak through a subsequent generic prompt. Both private transports use the same
canonical workflow.

Validation passed on October 2:

- `pnpm run ci`: formatting, lint, typecheck, 621 tests, build, bundle validation and secret scan;
  65 database cases are intentionally disabled in this default run.
- Focused baseline/correction/reminder verification: 92 passing tests, comprising 38 Brain unit
  cases and 54 explicitly enabled disposable database cases, zero skips.
- `pnpm run test:db`: 10 passing migration/job cases on the disposable two-role database.
- Isolated synthetic reliability database: one passing case, zero skips. Together the explicit
  database suites cover all 65 default-skipped cases.

Verification made no paid model call, external send or production baseline write. Production
runtime grants, readiness and existing transport enablement are checked read-only. Synthetic
provider acceptance is not a live device-delivery or owner-approval claim.

## Owner's first deliberate baseline

Replace the brackets below with your own information, omit irrelevant sections and send one
small message to JARVIS in the existing private Telegram chat:

```text
My baseline:
Goals for the next 12 months:
- [One important outcome and why it matters.]
Non-negotiables / standing rules:
- [A rule or boundary I actually want to keep.]
Active projects:
- [Project name, its purpose, and what I am doing now.]
Communication/accountability preferences:
- I prefer short direct answers unless I ask for detail.
- [How I want you to challenge me when I avoid an important commitment.]
Near-term commitments:
- I commit to [specific task] by [date].
Open loops / current priorities:
- I need to decide [question] before [date].
Important people, only what I deliberately want remembered:
- [Name] is important to me because [small useful summary].
```

Inspect the returned numbered draft. Correct by item number before sending `yes, save those`.
Use `review my baseline` later to inspect it. A follow-up such as “Given my goal and current
project, what should I focus on this week?” exercises approved context; name a person explicitly
when asking about deliberately private personal context.

The owner has not yet supplied this baseline. Natural-use coverage and provider prose quality
remain pending; no historical biography, owner correction or 30-day record is invented. Existing
authority, finance restrictions, proactive policy, reminders, routing, transports and disabled
groups/non-owner messaging/EDITH remain unchanged. No external archive, Gmail/Calendar, web
control center, Android, voice or executor work was started. Stop after this release and let the
owner supply the first baseline.
