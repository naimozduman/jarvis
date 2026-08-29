# ADR 0011: Fail closed on Evolution/Baileys evidence and owner-only transport

Status: Accepted

Date: 2026-08-29

## Context

Evolution stable `2.3.7` and reviewed `2.4.0-rc2` resolve Baileys `7.0.0-rc.9`. The Baileys
advisory GHSA-qvv5-jq5g-4cgg / CVE-2026-48063 covers release candidates `rc1` through `rc11` and
allows protocol-message spoofing/history-context corruption. A WhatsApp transport also exposes a
high-value session credential and untrusted sender input.

## Decision

- WhatsApp remains a replaceable `MessagingTransport`; Evolution types do not escape its adapter.
- Stable `2.3.7`, `2.4.0-rc2`, `latest`, unpinned branches, and all Baileys releases below `rc12`
  are blocked.
- The only reviewed contingency is detached Evolution source commit
  `e273b904d53f5726970fd6a244ed9caa61dfeb9a` with Baileys `7.0.0-rc13`, an explicit
  non-production-only source build pending a stable patched release review.
- A transport request requires matching build ID, Baileys version, immutable image digest, explicit
  unstable-build consent, and a non-production environment. Absence/mismatch fails closed.
- Server configuration resolves the sole V1 owner. Unknown, group, broadcast, status, history,
  protocol, resend, malformed, and self-echo messages never enter the Brain.
- Outbound delivery is an owner-bound, deterministic-policy-checked durable job. Brain and models
  never call Evolution directly.

## Consequences

The system does not claim a production Evolution deployment is ready today. Real pairing waits for
an operator to provide immutable build evidence and complete the documented secure workflow. A
future stable patched release may supersede this contingency only through a new evidence review and
ADR update; semver or a webhook User-Agent alone is not sufficient.
