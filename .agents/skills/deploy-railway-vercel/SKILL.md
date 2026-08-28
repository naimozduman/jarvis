---
name: deploy-railway-vercel
description: Use for JARVIS deployment, environment configuration, Railway services and private networking, Vercel web deployment, health checks, migrations, backups, rollback, or production incident work.
---

# Deployment workflow

## Before mutation

- Read `docs/DEPLOYMENT.md` and the relevant ADR.
- Confirm the target project, environment, service, and branch.
- Review the diff and migration plan.
- Verify required secrets by name only.
- Check provider sandbox or production mode.

## Railway

Deploy `jarvis-api`, `jarvis-worker`, `evolution-api`, `evolution-postgres`, and optional Redis as separate services. Use Railway private networking for internal traffic. Mount the Evolution session volume. Keep one Evolution replica. Add `/health`, `/ready`, and worker heartbeat checks.

## Vercel

Deploy only the Next.js web application. Keep secret server variables out of `NEXT_PUBLIC_*`. Verify preview and production environments separately.

## Database

Run migrations as an explicit release step. Block application promotion when migrations fail. Confirm backup freshness before destructive changes.

## Verification

- API health and readiness.
- Worker heartbeat and queue drain.
- Database connectivity.
- Web login and connector status.
- Inbound and outbound test message in staging.
- Audit record for a test action.
- No secrets in logs.

## Rollback

Keep the previous application deployment and Evolution image digest. Roll back code before attempting risky data reversal. For database failures, follow the tested restore or forward-fix procedure.
