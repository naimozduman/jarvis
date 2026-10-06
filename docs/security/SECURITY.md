---
title: "Security and Builder Threat Model"
document_id: "docs::SECURITY"
status: "active"
authority_class: "protected"
owner_role: "security_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Runtime and development are separate trust boundaries

## Threats

External prompt injection, stolen tokens, forged identity/approval, stale or duplicated callbacks, corrupted memory, provider uncertainty, excessive collection and runaway spend remain threats. The engineering threat model includes builder-origin changes to policy, tests, validators, instructions, dependency/install hooks and deployment credentials. A coherent document/code pair is not evidence of correctness if one actor changed both.

## Runtime requirements

Enforce owner binding, deterministic deny by default, exact approval, purpose-bound context, typed capability scopes, bounded resources and source provenance. Sensitive reads also require privacy and egress checks. Use encrypted secret storage, rotated directional service credentials, safe logs and no raw credentials in model context. Data deletion invalidates derived memory/index records through provenance.

A browser page, email, tool result, saved skill or research document is data. It cannot change policy, grant capability, resolve approval or redefine owner identity. Learned procedures remain candidates until reviewed/tested. Do not permit skill output to install new tools automatically.

## Builder requirements

Trusted baseline policy, verifier, baseline tests, owner public keys, required checks and deployment approvals must be outside the builder's unilateral promotion authority. Read TRUST_BOOTSTRAP. Codex workspace-write itself does not provide arbitrary per-file read-only guarantees. OS/container ACLs or separate identity/checkouts are needed when physically isolating paths. A branch gate blocks promotion, not an attempted local file edit.

## Authentication and authorization

Read AUTHENTICATION_BOUNDARY, APPROVAL_MODEL and CAPABILITY_AND_AUTHORITY. A recently unlocked chat session is not high-impact approval. Do not add multi-user behavior by loosening sender parsers. A future guest/delegation model is a separate protected design.

## Stop and recovery

Read KILL_SWITCH_DRILLS for independent paths and required evidence. Every enabled executor must recheck stop epoch. No attempt to make a stop path depend on the model that it stops. Preserve outcome observations after cancel/stop.

## Supply chain

Pin reviewed dependencies and actions, preserve the application lockfile, review install scripts and avoid privileged execution of candidate code. Do not call a changed CI script trustworthy because it passed its own tests. Runtime prompt source and schema imports have explicit promotion gates.

## Release gate

Identity/enrollment, owner separation, exact snapshot, replay, revocation, policy denial, no-secret logs, budget reservation, provider uncertainty, kill drill, backup/restore and data export/delete require actual-path evidence before the related feature is enabled. Pack tests do not replace it.

## V5 build-time boundary

The repository gate protects promotion, not actions already executed by a credentialed shell. The builder must operate in the credential-free context and offline worker boundary specified in BUILDER_ISOLATION. Privileged provider reads, live operations, verification collection and owner signing are separate. The accepted gate now protects every code path by default, not only named policy files. Neither candidate code nor its tests execute with the evidence collector's or signer's token. Actual negative boundary probes remain installation evidence, not a property of this Markdown file.
