# Build plan

## Working method

Build one phase at a time. Every phase ends with a running path, tests, an updated ADR set, and a short `docs/progress/<phase>.md` report.

## Phase 0: Bootstrap

Deliverables:

- Private GitHub repository.
- pnpm workspace and Turborepo.
- `apps/web`, `apps/api`, and `apps/worker` skeletons.
- Shared configuration packages.
- CI for lint, typecheck, unit tests, build, and secret scan.
- Environment schema validation.
- Health endpoints.
- Neon development project and migration workflow.
- Railway staging services.
- Vercel web project.

Tests:

- All packages build.
- API and worker boot without provider credentials in test mode.
- Missing required production variables fail at startup.
- No secret-like fixture appears in Git history.

## Phase 1: WhatsApp vertical slice

Deliverables:

- Evolution staging deployment.
- Dedicated number QR connection.
- Evolution webhook receiver.
- Normalized inbound message contract.
- Sender allowlist.
- Message ledger.
- OpenAI response with strict schema.
- Outbound Evolution adapter.
- Proactive scheduled test message.
- Web chat mirror.
- Connection-health card.
- Telegram fallback spike.

Reliability tests:

- Duplicate webhook.
- Out-of-order status updates.
- Rapid multi-message burst.
- Voice note.
- Image with caption.
- LID sender identifier.
- Evolution restart.
- Worker restart during processing.
- Outbound timeout with unknown result.
- Reconnect after session loss.

Exit gate:

Seven-day staged soak with no unexplained missing inbound message in the test log.

## Phase 2: Core brain

Deliverables:

- Questionnaire and constitution editor.
- Facts, preferences, people, projects, commitments, open loops, observations, and hypotheses.
- Context retrieval.
- Decision hierarchy.
- Negotiation engine.
- Reminder rules and jobs.
- Day plan and replanning.
- Message scoring and daily budget.
- Approval engine.
- Brain, Today, Commitments, Approvals, and Activity screens.

Exit gate:

All core acceptance cases in `docs/EVALS_AND_ACCEPTANCE.md` pass.

## Phase 3: Google

Deliverables:

- Connector card and Google OAuth.
- Gmail recent sync.
- Gmail Pub/Sub notifications.
- Daily Gmail watch renewal.
- History reconciliation.
- Email triage and extraction.
- Calendar read/write.
- Calendar watch renewal.
- Incremental event sync.
- Source-linked calendar changes and undo.

Exit gate:

No duplicate calendar events across webhook replay, full resync, or retry.

## Phase 4: Finance and WHOOP

Deliverables:

- Plaid Link in the admin page.
- Provider and account allowlists.
- Transactions, balances, and liabilities.
- Transfer reconciliation.
- Read-only permission tests.
- WHOOP OAuth, v2 webhook, signatures, fetch, and reconciliation.
- Money and Health views.

Exit gate:

The codebase contains no finance write product or endpoint. Health and finance summaries cite freshness and source.

## Phase 5: Internal apps

Deliverables:

- Iron & Intervals service API.
- Chat workout logging.
- Training plan context.
- Nutrition connector contract.

## Phase 6: Native iOS

Deliverables:

- SwiftUI client.
- Same conversation and backend.
- HealthKit permission and sync.
- Background delivery.
- Push, share sheet, voice, location, and Apple Maps.

## Phase 7: Restricted executor

Deliverables:

- Isolated Hermes service or equivalent.
- Narrow task packet and result schema.
- Temporary credentials.
- Browser and terminal allowlists.
- Approval for side effects.
- Full activity trace.

## Pull request rule

Each PR should deliver one complete behavior. Avoid broad scaffolding PRs with no observable path. Include:

- Product requirement reference.
- Architecture impact.
- Security impact.
- Test evidence.
- Migration impact.
- Rollback plan.
