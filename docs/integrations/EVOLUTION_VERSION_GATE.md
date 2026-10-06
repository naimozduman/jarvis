---
title: "Evolution and WhatsApp Library Security Gate"
document_id: "docs::EVOLUTION_VERSION_GATE"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Status

Fail closed.

Previous repository research identified unsafe or unsuitable Evolution/Baileys combinations and reviewed one development-source contingency. That evidence is historical and must be rechecked before any live pairing because releases and advisories change.

## Required evidence

Before enabling Evolution:

1. choose an exact Evolution source/release,
2. record exact commit/tag,
3. inspect lockfile and exact WhatsApp-library version,
4. check current security advisories and release notes,
5. build or obtain an immutable image,
6. record image digest,
7. confirm adapter endpoints/auth against that exact source,
8. run provider-free and local integration tests,
9. enable only in non-production first,
10. pair only the dedicated JARVIS number.

## Gate inputs

Runtime configuration should bind:
- provider build ID,
- dependency version,
- immutable image digest,
- explicit enable flag,
- environment,
- provider integration opt-in.

Mismatch means disabled.

## No floating images

Never use `latest` or a floating development tag for a paired JARVIS session.

## Sensitive evidence

Keep session files, QR/pairing codes, and secrets outside Git and model context.

## Review rule

This file intentionally avoids declaring a September 2026 dependency safe forever. Re-run the evidence check at pairing time.

## Reconciled implementation detail and dated evidence

The following retained detail is implementation/history evidence from the reconciled baseline at `0b05116598a7bed142c294326e15471ed03e0b26`. Source, accepted ADRs and the current implementation map control present-tense claims. Historical deployment commands, budgets and activation instructions create no new authority. V5 requirements above control newer intent.

# Evolution / Baileys version-security gate

## Status at Phase 3 implementation

The standard Evolution release route is deliberately **closed**.

- Evolution API stable `2.3.7` is blocked. Its pinned source commit
  `cd800f2976e1e5b682fbf86a01ee4d85ae61f370` declares Baileys `7.0.0-rc.9`.
- Evolution `2.4.0-rc2` is also blocked: it is a release candidate and its reviewed dependency is
  Baileys `7.0.0-rc.9`.
- Baileys `7.0.0-rc.1` through `7.0.0-rc.11` are affected by
  [GHSA-qvv5-jq5g-4cgg](https://github.com/advisories/GHSA-qvv5-jq5g-4cgg) /
  CVE-2026-48063. They must not be paired, deployed, or configured for JARVIS.

The only reviewed contingency in this repository is the exact Evolution Foundation source commit
`e273b904d53f5726970fd6a244ed9caa61dfeb9a`. At review time its `package.json` and lockfile resolve
Baileys `7.0.0-rc13`, which is past the advisory's patched `rc12` threshold. This is an **untagged
development-source build**, not a stable production release. It may be used only for deliberately
approved development or staging validation after all steps below; the application hard-blocks it in
`APP_ENV=production`.

No image digest has been invented or committed. Consequently, production Evolution deployment and
real WhatsApp pairing remain intentionally unresolved at the end of Phase 3.

## Fail-closed application gate

`@jarvis/integrations-evolution` validates all of the following before it will make Evolution HTTP
requests or expose pairing controls:

1. an explicit provider build identifier;
2. a parseable Baileys version at least `7.0.0-rc12`;
3. an immutable `sha256:<64 lowercase hex>` image digest;
4. the reviewed commit `e273b904d53f5726970fd6a244ed9caa61dfeb9a`;
5. `EVOLUTION_ALLOW_UNSTABLE_SOURCE_BUILD=true`; and
6. a non-production environment.

`JARVIS_EVOLUTION_ENABLED` defaults to `false`. Enabling it also requires provider integration
opt-in, owner/instance configuration, internal base URL, API key, webhook signing material, and all
of the evidence above. A missing or mismatched field yields a configuration error/blocked transport;
there is no fallback to `latest`, stable `2.3.7`, or a floating branch.

## Required operator evidence before live pairing

Perform these steps in a controlled build environment. Do not perform them from the JARVIS API or
worker process, and do not put command output containing secrets or session state into Git.

1. Fetch the Evolution Foundation repository and detach at exactly
   `e273b904d53f5726970fd6a244ed9caa61dfeb9a`. Record the resulting `git rev-parse HEAD`.
2. Inspect both `package.json` and the lockfile. Confirm `baileys` resolves exactly to
   `7.0.0-rc13`, not a range resolved at build time. Run a clean, lockfile-respecting dependency
   install and record `npm ls baileys`.
3. Re-check the GitHub advisory and the Baileys release notes. Stop if the installed version is
   below `7.0.0-rc12`, the source does not match the reviewed commit, or a new advisory invalidates
   the conclusion.
4. Build an immutable image from that detached source with a revision OCI label. Do not use the
   upstream floating Docker tags. Capture the local/registry content digest from `docker inspect`
   or the registry after push.
5. Store the following evidence in the protected deployment change record, not the repository:

   | Evidence | Required value / form |
   | --- | --- |
   | Evolution source commit | `e273b904d53f5726970fd6a244ed9caa61dfeb9a` |
   | Baileys dependency | `7.0.0-rc13` (or a newly reviewed later patched release) |
   | Image reference | immutable `registry/path@sha256:...` |
   | Build date and operator | deployment audit record |
   | Lockfile/install proof | protected build artifact or attestation |

6. Configure the same commit, Baileys version, and digest as
   `EVOLUTION_PROVIDER_BUILD_ID`, `EVOLUTION_BAILEYS_VERSION`, and
   `EVOLUTION_IMAGE_DIGEST`. Start with outbound disabled and verify transport health reports
   `configured`, `version_verified`, and its actual connection state.
7. Only after the gate is green, complete the authenticated admin pairing procedure in
   [WHATSAPP_RECOVERY.md](WHATSAPP_RECOVERY.md). A QR is never logged, committed, or included in
   model context.

If any item cannot be proven, leave the transport disabled. This is a security gate, not a warning.

## Why a header is not version evidence

The reviewed Evolution source still identifies some webhook traffic with a historical `2.3.7`
User-Agent string. JARVIS never uses that header as a release proof. The detached source revision,
lockfile dependency, and immutable image digest are the authoritative evidence.

## Source links consulted

- [Evolution Foundation stable 2.3.7 package manifest](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/package.json)
- [Evolution Foundation current source package manifest at the reviewed commit](https://github.com/evolution-foundation/evolution-api/blob/e273b904d53f5726970fd6a244ed9caa61dfeb9a/package.json)
- [Baileys `7.0.0-rc13` release](https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc13)
- [GitHub advisory GHSA-qvv5-jq5g-4cgg](https://github.com/advisories/GHSA-qvv5-jq5g-4cgg)
