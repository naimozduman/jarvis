# Deployment

> **Historical status — partially abandoned / superseded by the zero-cost architecture.** The
> Railway target layout below is retained as architectural history. Phase 3.6 does not deploy it;
> the current planned runtime is a stateless Vercel API, opaque Convex orchestration, canonical
> Neon state, and a local-only WhatsApp bridge. See [VERCEL_RUNTIME.md](VERCEL_RUNTIME.md).

## Target layout

### Vercel

Project: `jarvis-web`

Root directory: `apps/web`

Responsibilities:

- Next.js control center.
- PWA assets.
- Authenticated API client.
- Chat stream and live status.
- Connector setup pages.
- Approvals and audit.

### Railway

Project: `jarvis-core`

Environments:

- staging
- production

Services:

- `jarvis-api`
- `jarvis-worker`
- `evolution-api`
- `evolution-postgres`
- optional `evolution-redis`
- optional `hermes-executor`

Private service access uses Railway internal DNS. Avoid public domains for internal databases and Evolution management traffic.

### Neon

Projects or branches:

- production database `jarvis-prod`
- staging branch
- migration-test branches
- local or CI branches where useful

Use pooled application connections. Use direct connections for migrations when required by tooling.

## Environment groups

### Application

- `APP_ENV`
- `APP_URL`
- `API_URL`
- `USER_TIMEZONE`
- `ALLOWED_USER_EMAIL`
- `ENCRYPTION_KEY_CURRENT`
- `ENCRYPTION_KEY_VERSION`

### Database and jobs

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `PG_BOSS_SCHEMA`

### OpenAI

- `OPENAI_API_KEY`
- `OPENAI_MODEL_PLANNER`
- `OPENAI_MODEL_ROUTINE`
- `OPENAI_MODEL_EXTRACTOR`
- `OPENAI_TRANSCRIPTION_MODEL`
- `OPENAI_MONTHLY_BUDGET_USD`

### Evolution

- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `EVOLUTION_WEBHOOK_SECRET`
- `EVOLUTION_ALLOWED_SENDER_IDS`
- `EVOLUTION_IMAGE_TAG`
- `EVOLUTION_REDIS_ENABLED`

### Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_PUBSUB_TOPIC`
- `GOOGLE_PUBSUB_AUDIENCE`

### Plaid

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`
- `PLAID_WEBHOOK_URL`

### WHOOP

- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_REDIRECT_URI`
- `WHOOP_WEBHOOK_SECRET`

### Telegram

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ALLOWED_CHAT_ID`

## Deployment order

1. Create Neon project and run base migrations.
2. Deploy API with provider features disabled.
3. Deploy worker and confirm queue health.
4. Deploy web and complete passkey bootstrap.
5. Deploy Evolution Postgres and volume.
6. Deploy pinned Evolution image.
7. Connect dedicated WhatsApp number.
8. Configure webhook to API.
9. Run vertical-slice tests.
10. Enable one connector at a time.

## Health endpoints

### API `/health/live`

Process is running.

### API `/health/ready`

Database connection, required config, and queue enqueue path work.

### Worker health

Heartbeat row updated, queue consumption current, and no stale lease.

### Connector health

Per-provider status includes authorization, last webhook, last sync, next renewal, error, and data freshness.

## Migrations

- Generate Drizzle migrations.
- Review SQL.
- Run in staging.
- Run integration tests.
- Back up production.
- Run production pre-deploy migration.
- Verify schema version before application start.
- Add rollback or forward-fix notes.

## Evolution upgrades

Never enable automatic image updates.

Upgrade process:

1. Read release and migration notes.
2. Pin the new tag and digest in staging.
3. Back up Evolution database and volume.
4. Apply required migrations.
5. Reconnect a noncritical test number if needed.
6. Run inbound, outbound, voice, media, LID, duplicate, restart, and webhook soak tests.
7. Promote manually.
8. Keep previous image and database backup for rollback.

## Backups

- Neon restore window according to the selected plan.
- Nightly logical export of critical JARVIS tables to encrypted object storage.
- Railway backups for Evolution Postgres and volume.
- Quarterly restoration test.
- Export of prompt versions, schemas, and configuration already lives in Git.

## Cost controls

- Monthly OpenAI budget and alerts.
- Railway service resource limits.
- Object-storage retention.
- Provider usage dashboard links in Connectors.
- Plaid product allowlist.
- No unnecessary Redis until justified.
- Daily token and message metrics.
