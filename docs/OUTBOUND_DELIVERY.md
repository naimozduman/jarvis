# Durable outbound delivery

## Lifecycle

```text
Brain final response or generic reminder intent
  -> canonical response/reminder persistence
  -> deterministic owner-only delivery policy
  -> outbound_message_deliveries + jobs + pg-boss + audit transaction
  -> lease-protected transport worker
  -> MessagingTransport send
  -> provider receipt/status webhook + audit
```

The Brain never calls Evolution. The webhook request never waits for a model or provider send.

## States and idempotency

Outbound deliveries use `pending`, `leased`, `sent`, `delivered`, `read`, `failed_retryable`, and `failed_terminal`. An owner-scoped unique operation key makes intent projection idempotent. A worker must acquire the database lease before calling a provider. A duplicate pg-boss delivery cannot obtain another lease and therefore cannot send a duplicate WhatsApp message.

A provider message reference, when returned, is recorded only as an opaque reference. Delivery updates are monotonic (`sent` → `delivered` → `read`) and cannot rewind a known state.

The response-message identifier and operation key are deterministic. If a worker retries after the
Brain response committed but before outbox projection, the duplicate Brain request rehydrates the
already-persisted response and projects the same outbox key. It never makes a second model call,
re-applies a plan action, or creates a second message.

## Retry and reconciliation

Disconnected transport causes a retryable/waiting delivery state; even a disconnect at reminder
eligibility persists a durable intent rather than silently suppressing it. It does not delete the
response, reminder, commitment, plan, or Brain state. A rate/network failure is bounded by the
durable job retry policy. A timeout after dispatch is special: it is marked
`requires_reconciliation` and is not blindly resent, because the provider may have accepted it
before the response was lost.

Terminal policy, schema, owner-target, or credential failures are not retried as a different action. They remain auditable and require an operator or explicit future policy decision.

## Proactive messages

The reminder engine emits `ProactiveDeliveryIntent`, a provider-neutral intent. The worker selects the configured transport and follows the same delivery path. Quiet mode suppresses noncritical delivery without deleting the reminder or commitment; critical bypass remains explicit and audited.
