# Phase 3: WhatsApp vertical slice through Evolution API

Use `$evolution-whatsapp`, `$connector-integration`, `$security-and-privacy`, and `$agent-evals`.

Before code, verify the current stable Evolution release, Docker variables, webhook event names,
authentication method, storage paths, LID behavior, and upgrade notes. Record the chosen image
digest in an ADR amendment. Do not deploy a release candidate.

Implement the provider adapter, webhook verification/normalization, replaceable inbound/outbound
transport, durable acknowledgement, reconciliation, connection health, and synthetic fixtures using
the Phase 1 event pipeline and Phase 2 reasoning boundary. Prove duplicate suppression, restart
persistence, reconnect detection, and failed-send recovery without making Evolution canonical state.
