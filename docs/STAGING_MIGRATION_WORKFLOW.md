# Staging migration workflow: operator procedure

This document describes the proposed manual GitHub Actions workflow at
`.github/workflows/staging-migration-manual.yml`. It is release automation only. It does not
deploy Vercel or Convex, configure a model, or start a worker.

## Fixed release source

The automation revision and application revision are deliberately different:

- The workflow itself is checked out from the reviewed `main` commit selected at manual dispatch.
- The application is separately checked out at
  `940ab613d71ee349ab06341dd3684dff63e25c08`, whose tree is
  `5434d843f852be65af481ad297221ecd440d698f`.
- Before dependency installation, the runner verifies that commit, tree, the complete Drizzle
  journal through `0008`, and the SHA-256 values of the approved migrations:
  - `0007_nasty_spyke.sql`:
    `0187ecc1d4fa75cb36b08055fa7d8457b1452ebcb53a61e06281786b6f182d28`
  - `0008_striped_dreadnoughts.sql`:
    `6f130bc05ff27fe0844acb906359e4a0cc8ecdb16a4f1734c1a72ebb5902c0ff`

It installs the fixed source with `pnpm install --frozen-lockfile`, checks the Drizzle migration
package, runs credential-free safety tests, and only then exposes the migration credential to the
single migration step. That step invokes the existing guarded `pnpm db:migrate` path through the
release gate. It does not use schema push, raw replacement SQL, a Vercel runtime variable, or an
arbitrary source reference or database target input.

## Proposed secret and trust boundary

For the current private GitHub Free repository, the proposed storage is one temporary **repository
Actions secret** named `JARVIS_STAGING_MIGRATIONS_DATABASE_URL`. GitHub Free does not provide
environment secrets or deployment-protection rules for private repositories, so an environment
secret with required reviewers is not an available substitute on the current plan.

The secret must be a direct PostgreSQL connection for the already-approved staging target:

| Selection | Required value |
| --- | --- |
| Neon project | `jarvis-staging` (`jolly-truth-47196608`) |
| Neon branch | `main` (`br-jolly-scene-ayxtwkhr`) |
| Database | `neondb` |
| Role | `neondb_owner` |
| Host | `ep-dark-recipe-ay65lknc.c-5.us-east-2.aws.neon.tech` |
| Pooling | Direct connection only; pooling off |
| TLS | `sslmode=verify-full`, with no other query parameters |

The release gate rejects a pooled endpoint, `jarvis_runtime_staging`, another database or host,
missing credentials, non-TLS transport, and any connection parameter that could override the
selected host, user, database, or TLS policy. The role and database are also checked from the
actual PostgreSQL session after connection. The gate intentionally rejects `channel_binding`:
the pinned `pg` client does not enforce that URL option, so accepting it would overstate what the
workflow verifies. `sslmode=verify-full` uses the pinned client’s certificate and hostname
validation instead.

A repository secret has a broad trust scope. Repository collaborators who can edit workflow files
or otherwise cause a workflow to run with this secret must be trusted: they could change a later
workflow revision to disclose it. The two dispatch acknowledgements are deliberate operator
records; they are not a GitHub-enforced independent approval. The workflow restricts execution to
the named repository, its `main` branch, and the repository owner account, but that restriction
does not eliminate the need to trust workflow-editing authority.

Never put this value in a workflow input, command argument, repository file, artifact, log, or
environment file. Do not set `DATABASE_URL` in the workflow. The release script passes
`JARVIS_MIGRATIONS_DATABASE_URL` only to the guarded migration child process after source and
dependency checks; it uses an allowlisted child environment that omits `DATABASE_URL` and unrelated
runtime secrets. It captures a bounded amount of child output in memory only to classify an error,
then emits no raw stdout, stderr, exception object, or connection-bearing diagnostic. It reports
only an allowlisted category and the child migration exit result. GitHub masking is an additional
safeguard, not the primary control.

Delete the temporary repository secret after post-migration verification and the separately
authorized release work is complete. Removing the stored Actions secret does not revoke or rotate
the database password; a later credential rotation remains a separate Neon operation.

## Required live preflight before a later dispatch

The workflow is intentionally unable to prove the external release hold or recovery point from a
checkbox. Before the owner selects either acknowledgement, the release coordinator and Codex must
record a fresh, read-only preflight that establishes all of the following:

1. A usable Neon recovery point for `jarvis-staging`, including its actual retention window and
   the time it was checked.
2. A supported pause/resume procedure for the existing Convex development deployment
   `determined-retriever-869`, with authentication and schedules preserved.
3. The pause is active; job-producing clients are idle; no old callback, executor, or in-flight
   request remains; and active Neon leases have been inspected and accounted for. Pending canonical
   jobs remain intact and have a documented reconciliation path.
4. The database journal is exactly through `0006`; the only pending reviewed migrations are `0007`
   and `0008`, in that order. The database release gate repeats this journal check and refuses a
   current lease.
5. GitHub Actions included usage and no-payment/spending controls have been checked immediately
   before dispatch. The proposed job is one Ubuntu runner with a 20-minute timeout, no matrix,
   no artifacts, and no automatic retry. A missing payment method blocks paid overage, but this
   check must still be current before any hosted run.

If an operator becomes unavailable after the hold begins, retain or re-establish the supported
hold, do not dispatch the workflow, and resume only after the fresh preflight is repeated. Do not
cancel real commitments to clear the queue.

## Result handling

On success, the release gate verifies the full Drizzle journal through `0008`, the new generation
and deadline columns, constraints, indexes, and preservation of pre-existing job, execution-history,
and audit counts. It also checks that existing jobs retained generation `1` and a null execution
deadline, and that existing execution history retained generation `1`. This is a schema-and-journal
verification, not proof that the later Vercel/Convex deployment or cloud callback matrix has passed.

On any failure, nonzero exit, or uncertain result, do not dispatch a retry. Retain the safe release
hold and inspect the actual journal and schema through the approved read-only path before deciding
what repair is needed. The workflow intentionally preserves no raw database output or credential-
bearing diagnostics in logs or artifacts.

## Registration and disposable rehearsal

A new manual workflow is not normally dispatchable until this reviewed automation is committed and
present on the repository default branch. That later registration must be reviewed separately from
the fixed application revision; registering it does not change which application commit the workflow
checks out.

`.github/workflows/staging-migration-rehearsal.yml` is the one-time verification workflow for that
review. It starts only when `verify/staging-migration-workflow` is pushed. It has no manual
dispatch trigger, real secret, environment, deployment action, or OIDC permission. It checks out
the automation revision that triggered it and the fixed application source separately, then
records their commits, source tree, migration hashes, and automation script hashes.

The rehearsal creates an official PostgreSQL `18.6` container pinned to
`sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280`. Its port is bound
only to `127.0.0.1:55432`; the fixture creates a short-lived local CA, a server certificate valid
only for `localhost`, synthetic passwords, and a limited migration-role database. It requires
`hostssl` SCRAM authentication and keeps the CA only in the runner temporary directory. Neither
the preflight client nor the nested guarded `pnpm db:migrate` child can connect unless it presents
the test CA through `sslmode=verify-full`.

The reusable migration orchestration has a fixed live policy and cannot accept a target override.
Only the checked-in rehearsal script supplies a separate, fixed local policy. The rehearsal begins
from a real schema through `0006` with synthetic job, execution, and audit rows, then runs
preflight, the existing guarded Drizzle migration command, and postflight. It proves the expected
rejections for a wrong target/role, wrong journal, active lease, untrusted CA, certificate hostname
mismatch, nonzero child result, uncertain child result, and an already-applied journal. Each
rejected preflight checks that no unintended database mutation occurred. A successful run verifies
that only `0007` and `0008` were added and that existing history, safe generation defaults,
nullable deadlines, and the generation-aware execution-history uniqueness index are present.

This workflow is a disposable test only. It does not contact Neon, use a repository secret, or make
the live manual workflow runnable. Do not point the disposable integration-test harness or
rehearsal at Neon.

## Later owner action

After a separate release authorization and review of this automation, the owner should first make
the reviewed workflow available on `main`, recheck Actions usage and spending controls, and then
coordinate the live recovery-point and release-hold preflight with Codex. Only after that hold is
confirmed should the owner add the temporary repository Actions secret and manually dispatch this
workflow from `main` with both acknowledgements selected. No password is requested or stored during
this preparation phase.
