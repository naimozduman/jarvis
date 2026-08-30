# Neon staging database plan

## Designated project

The designated canonical staging project is `jarvis-staging` with non-secret project ID
`jolly-truth-47196608`.

No connection string is recorded here. The current connector metadata lookup returned
`INVALID_ARGUMENT`, so Phase 3.5A does not claim a fresh connector-side verification or migration
history inspection. The project reference must be rechecked in the authorized Neon account before
the next deployment task applies migrations.

## Ownership boundary

Neon `jarvis-staging` is for JARVIS canonical state only:

- identity and owner-scoped conversations;
- canonical events and durable pg-boss job lifecycle;
- Brain requests, decisions, memory, commitments, plans, reminders, approvals, and audit; and
- JARVIS transport intents/delivery state.

It must not contain Evolution's infrastructure database, Baileys authentication state, QR material,
or Evolution session volume data.

## Safe migration path

1. Confirm the selected Neon database belongs to `jarvis-staging`.
2. Provide its migration-capable connection as the ephemeral secret
   `JARVIS_MIGRATIONS_DATABASE_URL` to the migration process only.
3. Run `pnpm db:migrate` from the repository root.
4. Run `pnpm db:check` and inspect the migration journal/schema through approved database tooling.
5. Configure the pooled application `DATABASE_URL` separately for `jarvis-api` and `jarvis-worker`.

The application containers perform a non-mutating startup compatibility check for `jarvis.events`
and `jarvis.jobs`. A missing schema prevents server readiness; no in-memory fallback is allowed in
staging.

Phase 3.5A does not apply migrations because no secure migration connection path was supplied to
this task.
