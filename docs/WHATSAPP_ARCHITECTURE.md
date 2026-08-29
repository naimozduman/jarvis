# WhatsApp transport architecture

## Boundary

WhatsApp is a transport, never the Brain. Evolution is one replaceable implementation of the
provider-neutral `MessagingTransport` contract in `@jarvis/contracts`.

```text
WhatsApp
  -> Evolution API (session and infrastructure state only)
  -> @jarvis/integrations-evolution
  -> canonical ingress / idempotency transaction
  -> jarvis.event.process
  -> ConversationTurnService / Brain
  -> persisted response + deterministic delivery policy
  -> durable outbound delivery + pg-boss job
  -> @jarvis/integrations-evolution
  -> WhatsApp
```

The Brain imports neither Evolution HTTP types nor a provider client. It emits a canonical response
or a generic reminder intent. The transport worker is the only layer that receives a
`MessagingTransport` implementation, and it does so only after the response/reminder and delivery
intent are durable.

## Contracts and packages

| Layer | Responsibility | Cannot do |
| --- | --- | --- |
| `@jarvis/contracts/messaging` | Canonical messages/events, transport port, state and outbox schemas | Expose JIDs, QR values, keys, or provider payloads |
| `@jarvis/integrations-evolution` | Verified Evolution HTTP, webhook parsing, identity resolution, mapping, health, pairing control | Read/write canonical DB, call the Brain, choose an owner |
| `apps/api` | Fast webhook verify/parse/normalize/ingress/acknowledge | Call a model, download media, or send a reply synchronously |
| `apps/worker` | Process canonical events, invoke Brain for eligible owner text, apply delivery policy, dispatch jobs | Trust provider ownership, reconstruct a raw JID, bypass durable work |
| `@jarvis/database` | Canonical message/connection/rejection/outbox/media-metadata records and transactional job projection | Store Evolution sessions/auth files or call Evolution |

The V1 transport kind is `evolution_whatsapp`; a later Telegram, web push, or iOS adapter
implements the same transport contract without changing Brain or reminder logic.

## Canonical state vs. Evolution state

Neon/JARVIS PostgreSQL owns conversations, normalized messages, plans, reminders, commitments,
memory, model decisions, audits, connection records, delivery intents, and delivery results.

Evolution owns only its own infrastructure database/cache and Baileys authentication/session files.
Destroying Evolution can require re-pairing but must not delete or mutate canonical JARVIS state.

## Connection/readiness semantics

Connection states are explicit: `disconnected`, `connecting`, `qr_required`, `connected`,
`degraded`, `reconnecting`, `logged_out`, `blocked`, `unknown`, plus disabled/unconfigured and
version-gate states. Core API/worker readiness remains separate from transport health. A healthy
core never claims WhatsApp is connected merely because the process is alive.
