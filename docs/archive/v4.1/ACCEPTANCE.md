---
title: "V4.1 Patch Acceptance and Boundaries"
document_id: "docs::V4_1_ACCEPTANCE"
status: "draft"
authority_class: "evidence"
owner_role: "release_operator"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "4.1.0"
---

# Finish the patch, then install its boundaries

V4.1 changes four enforcement paths. It does not rename the product architecture or restart the roadmap. Stable J4-M00 through J4-M19 IDs, existing runtime source, active schemas, finite-lease design, and disabled owner-policy proposals remain.

| Confirmed gap | Delivered correction | Adversarial proof in pack | Still requires installation |
| --- | --- | --- | --- |
| Unsigned changes outside policy modules | Policy v2 protects every path by default; only narrow base-owned inert operational exceptions remain | Unsigned API/database/config/executor/UI/new-path changes fail; a removed authorization call is blocked; executable operational JSON loses its exemption | Enrolled owner key, trusted validator, required-check origin and controlled promotion |
| Builder acts before a merge gate | Operator source exporter, offline rootless worker, scrubbed Codex config example and fixed isolation probe | Sensitive-path omission, immutable source digest, network/mount/privilege config denial and no host fallback tests | Credential-free reasoning host, real rootless image/daemon/probe and remote-tool review |
| Eval freshness only warns | Affected-area selection uses trusted map/catalog and requires signed fresh exact-head coverage review | Missing/null/stale review blocks; candidate map weakening fails; unrelated future eval does not block; new activation adds requirements | Actual application test inventory and independent reviewer enrollment |
| runRef accepted as evidence | Domain-separated signatures plus live GitHub workflow/run/attempt/jobs/artifact/report corroboration | Forged/tampered/old-attempt/wrong-workflow/wrong-head/skipped/expired evidence fails | Independently controlled verifier/recorder, read-only metadata token and final admission integration |

## Done for this archive

All supplied automated suites pass. Negative tests reproduce the original path gap and then demonstrate rejection under V4.1. Source files parse. Managed metadata, links, registries, prompt previews, all hashes and ZIP integrity validate. Existing archival reference bytes and draft runtime schema/prompt bodies remain unchanged. VALIDATION_REPORT.md records exact counts and limitations.

## Before starting M00

Establish a sanitized input and credential boundary. The owner may use the exporter and isolated worker after reviewing them. If that environment is unavailable, perform a document-only audit of owner-supplied sanitized files. Missing repository-key enrollment does not block this audit. No live provider or migration credentials enter the audit session.

## Before progressing past M01

Record successful real boundary probes and actual installed trusted promotion tests, not only the pack's fixtures. Fill the real application eval map; enroll owner/evidence keys and verifier profiles; preserve existing CI. Prove wrong heads, unsigned dispatch modifications, tampered validators, stale reviews, invented run refs and obsolete reruns fail at the actual required gate. Prove changes cannot merge or deploy around it. Re-check time-bound evidence at final admission.

No safety profile is auto-approved during bootstrap. The signatures for repository promotion, test provenance, eval review and runtime actions are different decisions. Source control approval is not permission to send messages, spend money or migrate a database.

## Later capability gates remain later

The first billable model expansion still needs owner-approved cost policy and atomic runtime accounting. The first external writer still needs trusted action approval, fresh authentication, bounded authority, idempotency, independent stop paths and a real drill. The V4.1 tests do not substitute for those gates.

## Not implemented by this patch

No turnkey networked Codex VM, inference proxy, hardware-backed key driver, production verifier deployment, signing-key enrollment, branch/ruleset edit, merge controller, migration, live provider smoke test, database budget reservation, or deployed kill switch is created. No actual repository was changed while packaging.

This is the boundary of the deliverable, not a reason to add another architecture generation. M00 establishes the real baseline; M01 installs these mechanisms; later missions implement their bounded capabilities.
