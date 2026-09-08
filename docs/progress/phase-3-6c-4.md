# Phase 3.6C.4: real PostgreSQL verification and reproducible toolchain

## Scope and stop boundary

This repository-only verification follow-up preserves the uncommitted Phase 3.6C.3 canonical-job
repair and earlier Fastify/Vercel runtime work. It does not apply a migration, access Neon,
deploy Vercel or Convex, change provider configuration, configure or call a model, start Evolution,
or pair WhatsApp. All test data and attempted PostgreSQL state are disposable and local.

## Source preservation and reproducibility

Before any dependency-layout change, the expected base commit
`cb2284b8a6854cb8ede29ea82aebe1b5846337f9` and the complete dirty source were preserved outside
the repository and OneDrive as a binary-capable tracked patch plus a separately archived allowlist
of the ten intentional untracked source files. The recovery package verified its archive contents,
patch hash, untracked-file hashes, lockfile hash, and `git diff --check` result.

An isolated local verification workspace was checked out at that same base commit and reconstructed
from the recovery package. Its reconstructed tracked patch hash, each intentional untracked file
hash, working-tree status, and lockfile hash match the preserved source. The original workspace
was never reset, cleaned, restored, stashed, or used for a dependency repair.

The package manager declaration is `pnpm@11.23.0`; the original installed fallback was
`11.19.0`. A process-local `pnpm@11.23.0` executable was downloaded from the official npm registry
into the external verification tools directory. The clean workspace installed with
`pnpm install --frozen-lockfile` using Node `v24.19.0` and pnpm `11.23.0`. The lockfile remained
`E0A6B9D17372CC1E7619E676A4F628E4031E1905D1AE15D150A84E8490FE3D77`; all 47 declared workspace
links resolved across 16 workspace packages.

The exact pnpm executable correctly resolves at the repository root, but a child workspace command
in the original dependency tree still stops before mutation with
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. That guard was not bypassed. The clean verification
workspace is the sole dependency installation used for this report.

## Clean-install toolchain repair

The fresh frozen install exposed that `pnpm typecheck` could run before internal workspace packages
had generated their `dist` declarations. Public workspace packages export `dist` types, while the
old Turbo `typecheck` task depended only on dependency `typecheck` tasks. A clean API typecheck
therefore could not resolve internal package imports.

`turbo.json` now makes `typecheck` depend on both `^build` and `^typecheck`. This produces only
designated ignored `dist` outputs before a dependent package is typechecked; it does not generate
JavaScript or declarations under any `packages/*/src` directory. A fresh workspace-wide typecheck
then completed all 26 required build/typecheck tasks successfully, and the literal `pnpm run ci`
aggregate passed on the final source.

## Dedicated database harness

`pnpm test:db` is now a dedicated verification command: it fails unless both
`JARVIS_TEST_DATABASE_URL` and `JARVIS_TEST_DATABASE_SECONDARY_URL` are present. The ordinary
provider-free `pnpm test` command still leaves the database-gated file optional when no explicit
test database is configured. Neither path reads or falls back to `DATABASE_URL`.

After each full migration, the harness grants the distinct secondary role only `USAGE` on the
`jarvis` schema plus `SELECT`, `INSERT`, and `UPDATE` on `jarvis.jobs`,
`jarvis.job_executions`, and `jarvis.audit_events`. Schema reset and migration remain primary-only.
This preserves separate database connections for the race tests without giving the secondary role
database ownership or DDL authority.

The checked-in real PostgreSQL suite contains these nine named cases:

1. fresh installation through the full migration chain;
2. upgrade from schema through `0006` with representative existing rows;
3. exactly one matching-generation lease across separate connections;
4. held old callback rejection after canonical rescheduling;
5. replacement generation versus normal retry behavior;
6. cancellation/lease race and stale completion fencing;
7. rescheduling/lease race and stale state-write prevention;
8. deadline behavior before, at, and after the latest-start boundary, including an expired prior lease;
9. durable non-expiring work and expired reminder commitment preservation.

The missing-configuration behavior was exercised directly: `pnpm test:db` exited one with the
required-URLs diagnostic. That is a successful guard test, not real database coverage.

## PostgreSQL 18 local attempt and blocker

No Docker, Podman, or nerdctl runtime was available. The local attempt used PostgreSQL `18.6` from
the Windows x86-64 binary archive linked by the official
[PostgreSQL Windows downloads page](https://www.postgresql.org/download/windows/) through the
[EDB binary archive page](https://www.enterprisedb.com/download-postgresql-binaries). The archive
SHA-256 was `59F8CE701C63C2ED623C665A5E51B3EF6F2E37CCF837B68FFEED0742D0AE6ABD`.

The extracted `initdb (PostgreSQL) 18.6` distribution was kept outside OneDrive and the repository.
It was configured only for an ephemeral loopback data directory, a random local port, and
`scram-sha-256` authentication; no Windows service, global PATH entry, firewall change, or
administrator access was used. During `initdb` post-bootstrap initialization, Windows returned:

```text
could not create restricted token: error code 87
could not re-execute with restricted token: error code 3
```

The temporary child never opened its loopback listener (`127.0.0.1:5432 - no response`) and the
initializer remained stalled. Only the two processes tied to the disposable data directory were
stopped. No test role/database was created, no credential artifact remained, and no real PostgreSQL
test case started. The real database result is therefore **unexecuted**, not passed or skipped.

## Expiry representation

The repository has one durable representation for an execution deadline expiry:

- persisted job status: `terminal_failed`;
- persisted error category: `expired`;
- audit event: `job.expired`;
- HTTP callback disposition: `expired`;
- Convex opaque coordinator state: `expired`, with no automatic retry.

There is no separate persisted `expired` job status. The terminology in ADR 0015 and the Phase
3.6C.3 report now reflects this distinction.

## Manual GitHub Actions fallback prepared for review

`.github/workflows/database-integration-manual.yml` is an unpushed, manual-dispatch-only fallback.
It requires an explicit Actions-spending acknowledgement, uses an ephemeral PostgreSQL 18.6 service,
generates primary/secondary test credentials only at workflow runtime, runs `pnpm test:db`, and
contains no Vercel action, token, push trigger, or deployment step. It has not been run.

## Final source verification

On the final isolated source, the following passed with Node `v24.19.0` and pnpm `11.23.0`:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm bundle:validate`, `pnpm secrets:check`, and `pnpm run ci`;
- `pnpm brain:evals` (49 tests), `pnpm transport:evals` (9),
  `pnpm orchestration:evals` (24), and `pnpm bridge:evals` (16);
- `pnpm audit --prod` with no known vulnerabilities;
- `pnpm db:check` through the documented process-local identity workaround after the literal
  sandboxed command hit `uv_os_get_passwd ... ENOMEM`; the workaround used no database URL and
  reported `Everything's fine`;
- Convex TypeScript checking with `tsc -p convex/tsconfig.json --noEmit`;
- `git diff --check` and the full secret scan.

The provider-free test run reported 171 passed and 10 expected database-gated skips. The only
remaining verification blocker is the real PostgreSQL suite, which must run successfully on a
working disposable PostgreSQL 18 environment before the repository repair can be called fully
database-verified.

## Required later procedure

1. Review the uncommitted source and the manual-only workflow; verify Actions spending limits
   before dispatching it from a verification branch.
2. Run the real database suite with explicit primary and secondary local/service URLs and confirm
   all nine named cases execute without skips.
3. Review the resulting migration and code change together. Only then apply migrations `0007` and
   `0008` to the approved Neon target in journal order with the separate migrations credential.
4. Deploy the revision-aware API/producers, Convex functions, and worker in the ADR 0015 order;
   reconcile pending canonical rows; then rerun authenticated cloud callback and privacy scenarios.

The cloud release gate remains incomplete. No cloud migration, deployment, secret change, model
request, or transport action occurred in this phase.
