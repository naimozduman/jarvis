# Evolution integration boundary

## Current reviewed source behavior

The adapter was built only against the reviewed Evolution Foundation source at
`e273b904d53f5726970fd6a244ed9caa61dfeb9a`; see the hard gate in
[EVOLUTION_VERSION_GATE.md](EVOLUTION_VERSION_GATE.md). It uses native `fetch` plus strict Zod
parsing, not an unreviewed provider SDK. No Baileys package is installed in JARVIS.

Reviewed routes used by the adapter are:

| Purpose | Route |
| --- | --- |
| Create dedicated instance | `POST /instance/create` |
| Request QR / connection state | `GET /instance/connect/:instance` and `GET /instance/connectionState/:instance` |
| Reconnect/logout/delete | `POST /instance/restart/:instance`, `DELETE /instance/logout/:instance`, `DELETE /instance/delete/:instance` |
| Register per-instance webhook | `POST /webhook/set/:instance` |
| Send text/media/audio | `POST /message/sendText/:instance`, `POST /message/sendMedia/:instance`, `POST /message/sendWhatsAppAudio/:instance` |
| Mark read | `POST /chat/markMessageAsRead/:instance` |

Routes, response fields, and webhook behavior must be re-reviewed if a new Evolution build is
proposed. The adapter fails closed on unexpected response structure.

## Webhook authentication

The reviewed source does not provide a generic raw-body HMAC for normal outgoing webhooks. Its
supported per-instance setting is `headers.jwt_key`: Evolution turns that setting into an HS256
JWT `Authorization: Bearer` header with `app=evolution`, `action=webhook`, and a short expiration.

JARVIS verifies the signature with constant-time comparison, requires exactly HS256, validates
claims/issue/expiry tolerance, requires JSON, limits request bytes, and validates a strict allowed
event schema. The body `apikey`, sender, destination, server URL, and any body-selected owner are
never used for JARVIS authentication or persistence. Do not put the control-plane `apikey` in a
webhook body or an application log.

The initial registration allowlist is intentionally small: `MESSAGES_UPSERT` and
`CONNECTION_UPDATE`. The parser can normalize message mutations/delivery updates only after they
arrive through the verified boundary; it does not accept arbitrary protocol traffic.

## Dedicated account configuration

The configuration boundary has placeholders only:

- `JARVIS_WHATSAPP_INSTANCE`
- `JARVIS_OWNER_PHONE`
- `JARVIS_OWNER_WHATSAPP_LID` (optional, pre-enrolled authenticated owner alias only)
- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_WEBHOOK_SECRET`
- `EVOLUTION_PROVIDER_BUILD_ID`
- `EVOLUTION_BAILEYS_VERSION`
- `EVOLUTION_IMAGE_DIGEST`

`JARVIS_OWNER_ID` is server configuration and is the owner bound to accepted ingress. The webhook
payload cannot select it. V1 is for the dedicated JARVIS number—not automation of the owner’s
primary personal WhatsApp account.
