# Phase 3.5 progress: staging infrastructure bring-up

## Current status

Phase 3.5A completes repository-side staging runtime readiness. It does not deploy, create Railway
resources, apply Neon migrations, make a real OpenAI request, enable Evolution, or pair WhatsApp.

The designated Neon project is `jarvis-staging` (`jolly-truth-47196608`). The available connector
metadata query returned `INVALID_ARGUMENT`, so this reference is recorded from the supplied staging
context rather than asserted as a newly verified connector result. No database secret was read.

Railway project creation remains blocked by the workspace free-plan resource limit. No Railway
resource was created or modified in this phase.

## Repository changes

- Added `APP_ENV=staging` as a first-class server environment. It requires `DATABASE_URL`; it does
  not inherit development's provider-free persistence behavior or production's source-build ban.
- Kept production's Evolution contingency rejection intact while permitting the separately gated
  reviewed source-build contingency only in non-production environments.
- Added explicit API and worker runtime containers that compose validated config, PostgreSQL,
  pg-boss, repositories, policy/approval persistence, the ModelGateway boundary, Brain services,
  and optional Evolution components without global hidden singletons.
- Added non-mutating startup schema compatibility checks and truthful readiness probes. A later
  database outage changes readiness without exposing raw driver details.
- Added a staging-only, bearer-protected synthetic ingress route. It creates canonical events/jobs
  and uses the normal worker/Brain/policy path; it is absent without trusted configuration and
  outside staging.
- Added explicit `build:api`, `build:worker`, `start:api`, and `start:worker` commands. Both
  processes honor `PORT`.
- Added provider-free unit coverage for staging parsing, readiness, model `not_configured`, runtime
  composition, pg-boss worker registration, malformed job rejection, idempotency ingress, dynamic
  database failure, port handling, and idempotent shutdown.

## Still blocked or deliberately deferred

- Apply all JARVIS migrations to Neon only after an approved secure connection path is available.
- Resume Railway service provisioning only after the resource/billing limit is resolved.
- Configure a real OpenAI key only as a platform secret and only after deployment authorization.
- Keep `JARVIS_EVOLUTION_ENABLED=false` until the Phase 3 immutable-image/digest gate has evidence.
- Do not pair a WhatsApp number, create a QR, or provision Evolution infrastructure in this phase.
