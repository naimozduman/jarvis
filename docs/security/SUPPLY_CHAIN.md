---
title: "Supply-chain and privileged build boundaries"
document_id: "DOCS_SUPPLY_CHAIN"
status: "active"
authority_class: "protected"
owner_role: "security_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Supply-chain and privileged build boundaries

## Protected inputs

Protect package manifests, lockfiles, CI definitions, compiler/test configuration, dependency installer policies, generated-code scripts, container build contexts and artifact verification code as executable behavior. The default-protected gate already covers new unknown paths. A filename ending in JSON is not evidence that it is harmless.

## Dependency changes

Retain the repository's reviewed pinned toolchain. A dependency update records old/new version and source, transitive changes, installer execution, known advisories and compatibility tests. Recheck current official package/vendor sources. Do not derive safety from a version number, star count or an old research summary.

Install and test candidate dependencies only inside the credential-free disposable worker. Network-enabled fetch and offline execution are separate operations with cache provenance. A stale cache is not permission to enable unrestricted network access. Container images use reviewed immutable digests. The pack does not select a digest it has not built or verified.

## CI and provenance

A trusted validator runs from a pinned baseline or independently maintained source, not from the candidate being judged. Candidate tests run without repository administration, promotion keys, provider tokens or migration credentials. Credential-bearing live verification runs narrow reviewed harness code over approved artifacts. Do not move arbitrary candidate tests into a secret-bearing job and call that separation.

Pinned action SHAs, signed artifacts and an SBOM are useful evidence, not proof of semantic correctness. Record builder identity, source commit, dependency graph, workflow revision, artifact hash and allowed environment for every privileged deployment.

## Compromise response

On a suspected malicious installer or dependency, preserve evidence, stop affected jobs, determine credential reach, revoke exposed sessions/tokens, review outputs since exposure and rebuild from a trusted baseline. A patched package alone does not undo exfiltration or already-issued credentials.

Primary sources: GitHub secure-use guidance and current Codex environment/sandbox documentation in the source registry. Actual platform restrictions require verification during installation.
