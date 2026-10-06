# Production readiness checklist

## Product behavior

- [ ] Constitution rules are reviewed and versioned.
- [ ] Five missed behaviors do not rewrite a goal.
- [ ] Hard overrides work and create an audit entry.
- [ ] Quiet mode preserves critical reminders.
- [ ] No response does not mark completion.
- [ ] Important decisions display source evidence.

## Security

- [ ] Passkey or equivalent strong login is enabled.
- [ ] Only the approved user identity may sign in.
- [ ] OAuth state and PKCE tests pass where supported.
- [ ] Connector tokens are encrypted.
- [ ] Webhook signatures and replay checks pass.
- [ ] Prompt injection tests pass.
- [ ] External messaging requires approval.
- [ ] Money movement is absent from all tools.
- [ ] Logs redact secrets and sensitive payloads.
- [ ] Export and deletion tests pass.

## Reliability

- [ ] Duplicate events create one state change.
- [ ] Queue retry and dead-letter recovery work.
- [ ] Gmail and Calendar reconciliation recover missed notifications.
- [ ] WHOOP reconciliation recovers webhook gaps.
- [ ] Evolution restart preserves the session.
- [ ] QR re-pair and fallback channel procedures are tested.
- [ ] Backups are current and a restore drill has passed.
- [ ] Previous deploy and Evolution image digest are recorded.

## Operations

- [ ] API health and readiness checks pass.
- [ ] Worker heartbeat and queue lag are monitored.
- [ ] Connector freshness and errors are visible.
- [ ] Model cost and latency budgets have alerts.
- [ ] Staging and production secrets are separate.
- [ ] Provider sandbox and production modes are clearly labeled.
- [ ] On-call recovery notes exist even for a one-person product.
