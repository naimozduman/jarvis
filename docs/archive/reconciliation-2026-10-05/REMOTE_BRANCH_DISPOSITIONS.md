# Remote branch dispositions — reconciliation, 2026-10-05

The fresh candidate starts from verified main `8fffe34cf12f13b9dbbd8fe7f7f37b2d17937df7`.
Preserved R1 `e43ec080a2a4eeb0c6603e6570001540bcbace8b` has parent/common base
`cb2284b8a6854cb8ede29ea82aebe1b5846337f9`. R1 has one preservation commit absent from main;
main has 16 later commits absent from R1. File/subsystem decisions reconcile both histories.
No remote feature branch is merged just because it has unique commits.

Ancestry and blob inspection below used the pinned local remote refs imported from verified
product history. Live consistency and any final publication belong to the reconciliation report.
No branch is force-pushed, deleted or merged into main by this mission.

| Preserved remote ref | Tip | Main-only / branch-only commits | Disposition and evidence |
| --- | --- | --- | --- |
| `main` | `8fffe34cf12f13b9dbbd8fe7f7f37b2d17937df7` | 0 / 0 | KEEP_MAIN baseline. The final three commits after C7 add/adjust protected personal-system integrations and source-owned service origins; retain their code/tests/config and reconcile overlap with R1. |
| `codex/c7-staging-cloud-harness` | `481b262817095fdc070871c22c7897d21b4f3fcf` | 7 / 0 | Already an ancestor of main. C7 fixed lifecycle harness is represented on main; no separate merge required. Retain safeguards/tests and original operational provenance. |
| `codex/phase-3-6d3-single-gateway-attempt` | `6f1519795553a0c7f75d437c6914b1d9282a7faf` | 3 / 0 | Already an ancestor of main. Required invocation-local OIDC and one-request Gateway attempt behavior are preserved alongside R1 changes. C7 one-off recovery/history remains scoped. |
| `verify/phase-3-6c-postgres` | `940ab613d71ee349ab06341dd3684dff63e25c08` | 14 / 0 | Already an ancestor of main. Historical runtime/database-clock repair and fixed migration-source evidence retained; do not replay old release commands. |
| `verify/staging-migration-workflow` | `1e36fec929b22b52369baa56aee9dcc193b7ecd6` | 9 / 0 | Already an ancestor of main. Historical migration rehearsal/TLS/index corrections retained; fixed workflow scripts remain unexecuted. |
| `monthly-bills-hosting` | `0c8dbfeb3eedbbcbbd5ac1822f252197d4ced0e6` | 7 / 3 | KEEP_SEPARATE. Independent monthly-bills hosting proxy replaces the product tree on its branch; no canonical JARVIS requirement depends on importing its files. |
| `refs/pull/1/head` | `6f1519795553a0c7f75d437c6914b1d9282a7faf` | 3 / 0 | Same reviewed C7 tip, preserved as provenance; no distinct missing implementation. No PR modification performed. |

## Monthly-bills branch review

The common ancestor of main and monthly-bills-hosting is
`481b262817095fdc070871c22c7897d21b4f3fcf`. Its three unique commits are:

| Commit | Change | Disposition |
| --- | --- | --- |
| `2d8c16866b8f557d134f13a53d4433fce7b269bf` | Replaces JARVIS monorepo with `monthly-bills-proxy` package and `server.js`; 425 paths changed and 145,051 lines deleted. Proxies an independent existing monthly-bills service. | KEEP_SEPARATE; importing its deletion set or package replacement would destroy current product structure. |
| `1ebc199607dfafeb65423c1ee02cb0b794131ce8` | Adds standalone `api/index.js` Vercel proxy handler. | KEEP_SEPARATE; unrelated proxy deployment, no canonical owner-state integration. |
| `0c8dbfeb3eedbbcbbd5ac1822f252197d4ced0e6` | Adds root `vercel.json` rewrites for the monthly-bills proxy. | KEEP_SEPARATE; deployment routing belongs to that branch/application. |

The proxy source was read statically; its upstream was not contacted and no credentials or
runtime were used. Main's personal-system service integrations are a different scoped capability
and remain retained. A future monthly-bills integration requires a direct product requirement and
a narrow source-owned interface; branch uniqueness alone supplies neither.

## Separate non-product inputs

Jarvis Zero, V5, M00/M01 proposals, older R3/R4 copies and legacy standalone bridge archives remain
preserved external inputs. No controller development, V5 governance adoption, archive import or
AWS/production operation occurs in this reconciliation. All original/preserved refs remain intact.
