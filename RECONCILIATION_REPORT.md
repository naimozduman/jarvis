# JARVIS reconciliation candidate — 2026-10-05

A fresh candidate repository combines the current preserved owner-facing R1 product development
with GitHub main's later committed personal-system integration and accepted C7 safeguards.
The branch is `reconciliation/2026-10-05`, based on verified main
`8fffe34cf12f13b9dbbd8fe7f7f37b2d17937df7`. It is a reviewable source candidate for isolated
Ubuntu Linux validation; executable correctness and release readiness are not asserted.

The fresh checkout is `C:/Users/localhost/JARVIS_RECONCILIATION_2026-10-05/jarvis`. It was created
without reusing an original dirty checkout or filesystem hardlinks. Source inputs were read-only:
preserved R1 `e43ec080a2a4eeb0c6603e6570001540bcbace8b`, its exact parent/common base
`cb2284b8a6854cb8ede29ea82aebe1b5846337f9`, pinned main and C7
`6f1519795553a0c7f75d437c6914b1d9282a7faf`. Main has 16 commits absent from the R1 checkpoint.
The imported `refs/inputs/r1` remains pinned; source selection did not copy R1 over main wholesale.

## Reconciled product state

R1 contributes Telegram, dedicated WhatsApp Cloud, requested reminders/final-send revalidation,
daily-use accountability/feedback, owner-authored baseline review and scoped context, full model
request admission/accounting, bounded planning/action/prompt modules and their synthetic tests.
Main retains protected personal-system routes, source-owned service clients/origins, read-token
rotation and admission/audit, plus C7 harness/recovery/fixture safeguards and operational history.

The stateless API has one deployment entrypoint (`apps/api/server.ts`) and the shared HTTP
composition library. Request-local OIDC stays at the API boundary; runtime composition ignores
ambient identity and never changes process environment. Missing invocation identity selects the
unconfigured gateway. R1's Gateway admission/Responses behavior retains main's SDK and request
`maxRetries: 0` safeguards and corresponding quota/network/provider-error tests. Non-model health
readiness remains distinct from model readiness, consistent with existing tests.

Two concrete coherence repairs accompany source reconciliation. Staging smoke authentication
now precedes any fixture preparation, with a meaningful regression for missing/wrong credentials.
Original Telegram migration `0011` remains immutable; additive `0012` supplies the ID default
already declared by the shared schema. Missing `0011`/`0012` metadata snapshots were reconciled
statically, retaining the prior 77 tables and accurate SQL FK names. Disposable generator/catalog
verification is mandatory. The dedicated DB gate now covers all 64 local disposable cases across
five suites, preserving original exact-case/no-skip checks; the hosted reliability case remains
separately quarantined from local execution.

## Reconciliation accounting

| Requested measure | Result and definition |
| --- | --- |
| R1 files adopted | 183 materially divergent R1 files contribute accepted content; 151 match R1 byte-for-byte, while the rest include deliberate unions or stated identity/documentation repairs. Shared identical improvements are already retained on main. |
| GitHub-main-only changes preserved | 28 changed paths outside the R1 delta: 23 files absent from R1 and five main-only modifications. Additional main contributions inside overlapping paths were reconciled separately. |
| C7 items restored | 17 items absent from R1 retained/restored to the combined candidate; 0 copies from files missing on the main baseline. See RESTORED_C7_ITEMS.md for each item's operational/required scope. |
| True manual merges | 15 paths combining distinct source contributions, explicitly enumerated in the matrix. Automatic unions, pure take-R1 conflict resolutions, annotations and standalone repairs do not inflate this count. |
| Files retired | 2 R1-only artifacts excluded: stale documentation-reconciliation.patch and unused empty root drizzle/meta/_journal.json. Two obsolete API entrypoints were already deleted by both inputs and remain absent. No test or accepted ADR retired. |
| Unresolved source conflicts | None. Deferred verification and existing product questions are recorded in UNRESOLVED_CONFLICTS.md. |
| Canonical documentation | One explicit reading order in CANONICAL_DOCUMENTATION_MAP.md and current startup files; docs/JARVIS owns product intent, scoped ADRs own technical decisions and source/tests/migrations remain implementation evidence. |

The matrix covers all 256 paths changed by either source since the shared base, including all
216 tip divergences, with exact immutable input blob identities and reasons. Additional authority
annotations and new migration metadata are also recorded. It was initially produced before source
edits and completed before any reconciliation commit. All 24 original numbered ADR bodies and
filenames match their source bytes, including both distinct ADR 0016 slugs; only navigation/status
labels were reconciled. Historical PRDs, build prompts and deployment procedures remain explicitly
historical. V5 remains a separate candidate pack and has no canonical authority here.

## Safe validation and integrity

Standalone parsers checked TypeScript/JavaScript grammar, local/named workspace imports/exports,
production workspace dependency declarations, JSON/JSONC/YAML, lock importer/specifier alignment
and migration journal/SQL presence. Source whitespace checks, input ancestry/blob provenance,
ADR integrity, canonical local links, forbidden-file checks and secret scanning also passed.
These checks do not substitute for strict compilation, installation, runtime or test execution.
The full baseline-to-candidate whitespace check reports four preserved two-space Markdown hard
line breaks in the historical V2 PRD/handoff. These are intentional Markdown formatting retained
from R1, not code whitespace defects; a check allowing Markdown hard breaks passes.

Original integrity matched the Phase 2 baseline: 1,922 selected source files, 3,360 recorded Git
metadata entries, 849 auxiliary files, seven archives and eight audit inputs. All nine original
HEAD/branch/status records match. All 3,162 sealed preservation artifacts still exist and match
their hashes. Read-only Git checks disabled optional locks and used per-command ownership context,
without changing original config/index/refs. This is the recorded preservation scope; excluded
runtime/cache/private operational data was not read or copied.

No dependency installation, repository code/test/build execution, migration, provider call,
production access, AWS access/transfer, deployment, Jarvis Zero development or V5 integration
occurred. The complete Ubuntu validation requirements are in DEFERRED_VALIDATION.md.

## Commits and publication boundary

Commits are separated into core behavior/schema, stateless API/provider composition, documentation
authority/provenance and final validation/tree evidence. Main ancestry is preserved. R1 input
provenance remains the pinned preservation commit and per-path blob matrix rather than a blind
merge of its entire tree. `FINAL_TREE_MANIFEST.json` records exact candidate file hashes; its own
hash is deliberately excluded to avoid self-reference. Final HEAD is authoritative in Git and
the final phase completion report; it cannot be embedded in a file within that same commit.

The live GitHub repository was confirmed private, writable and still at all six audited branch
tips, with main exactly `8fffe34`. Publication is performed only after the final evidence commit,
secret adjudication and a fresh ref comparison, using one explicit non-force refspec for
`reconciliation/2026-10-05`. This committed report necessarily precedes that conditional push;
the final completion record/user report records the observed push and final clean HEAD. Main,
other branches and tags are not updated or deleted. No PR, merge or workflow dispatch is part of
this phase.

After the final commit, repeat clean status, manifest/provenance, original integrity and preserved
artifact checks. A successful branch/ref verification makes this candidate ready to move to
Lightsail for isolated Linux validation in the next phase. It does not authorize a transfer or
deployment in this mission.
