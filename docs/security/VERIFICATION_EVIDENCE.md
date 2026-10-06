---
title: "Authenticated Verification Evidence"
document_id: "docs::VERIFICATION_EVIDENCE"
status: "active"
authority_class: "protected"
owner_role: "governance_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# A run reference is not a test result

V4.1 adds `promotion_evidence.py` and `evidence-signing.mjs`. They run from a trusted baseline or external verifier, read candidate content as data, and never execute candidate tests. This document owns evidence formats and installation requirements. Runtime action approvals remain governed by APPROVAL_MODEL, not this signing protocol.

## Two separate signatures

The existing governance signature authorizes an exact repository/base/head/diff digest. It does not assert tests passed. New evidence envelopes independently authenticate:

- `test-verification`: a trusted recorder vouches for a specific result artifact from an enrolled GitHub workflow/run/attempt.
- `eval-review`: an owner or enrolled reviewer attests semantic review of specified suites and invariant wording for the exact proposed change.

Both bind the repository and full base/head commits. The bytes signed are a domain-separated canonical JSON payload, with the prefix `JARVIS-V4.1-EVIDENCE` followed by a NUL byte. Reusing a repository-promotion signature as test evidence fails. Both expire. Builder-created `reviewed_at` fields, labels, comments and runRef strings provide no authority.

`governance/EVIDENCE_POLICY.json` deliberately ships `enabled: false`, with no signers or workflows. No owner or verifier key is supplied. Promotion fails until the owner installs the trust roots. M00 planning and local tests remain available.

## Requirements come from the accepted baseline

1. Obtain changed paths and mode-aware operational exceptions from immutable Git trees using the trusted JS classifier.
2. Use BASE `IMPLEMENTATION_MAP.json` to select `requiredEvalIds`. Unmapped protected paths fail. The candidate cannot lower requirements by editing its map in the same change.
3. Use BASE `EVAL_CATALOG.json` to identify exact test entrypoints, coverage patterns, invariant IDs and review intervals.
4. Hash candidate suite files and canonical invariant wording into a coverage digest. Missing required entrypoints fail. Empty or planned coverage is not production evidence.
5. Additional activation requirements come from BASE evidence policy when a control is declared runtime-active or a draft contract begins migration/adoption.
6. Require authenticated passing tests and fresh signed semantic review for each selected eval.

Unrelated planned future evals do not block foundation work. Newly enabled power does. `E-APP-REGRESSION` intentionally has no invented path: M00 must inventory the real repository tests, and M01 must enroll that map before application changes are promoted. Existing tests reached through normal CI remain valid after their discovery is verified.

A coverage-only map expansion is a separate owner-reviewed bootstrap operation before the new implementation. It must not simultaneously introduce an untested execution path. Future activation claims also need real deployment gates; this static catalog does not discover every possible feature flag automatically.

## Enroll a verifier, not an arbitrary successful workflow

Each enabled workflow profile requires these fields:

| Field | Meaning |
| --- | --- |
| id | Stable verifier name |
| repository / repositoryId | Exact verifier repository and numeric GitHub ID |
| workflowId / workflowPath / workflowSha256 | Numeric workflow identity, exact source path and reviewed file digest |
| trustedHeadShas / allowedBranches / event | Reviewed immutable verifier revisions, branch allowlist and allowed trigger |
| receiptKeyIds | Enrolled signers permitted to attest this verifier |
| maxAgeSeconds | Maximum run age at admission |
| artifactName | Exact artifact name |
| requiredJobs | Explicit job names, each with a nonempty list of required successful step names |

The verifier repository should be independently controlled. Its reviewed workflow runs candidate application tests only inside an unprivileged disposable worker. A trusted supervisor observes exit status/output, validates the fixed result format and publishes the bounded report. Candidate code never shares the signer, migration credentials, provider tokens or privileged collector process. Copying a candidate-generated JSON saying `passed: true` into an artifact is not trustworthy recording.

The signed result proves who vouched for the report. GitHub corroborates where the bytes came from. Neither detects a lying trusted recorder or makes poor tests meaningful. Owner review of the recorder and suite remains part of bootstrap.

## Test receipt payload

The envelope has `format: "jarvis-evidence-v1"`, `payload`, and Base64 `signature`. The payload contains exactly:

```json
{
  "purpose": "test-verification",
  "repository": "owner/application",
  "base": "FULL_BASE_COMMIT",
  "head": "FULL_HEAD_COMMIT",
  "keyId": "ENROLLED_KEY_ID",
  "issuedAt": "UTC_TIMESTAMP",
  "expiresAt": "UTC_TIMESTAMP",
  "verification": {
    "verifierId": "ENROLLED_VERIFIER_ID",
    "runId": 123,
    "runAttempt": 1,
    "artifactId": 456,
    "artifactSha256": "ARTIFACT_ZIP_SHA256",
    "reportSha256": "REPORT_FILE_SHA256"
  }
}
```

Values above are explanatory placeholders, not usable evidence. Real commit hashes are 40 lowercase hex characters and SHA-256 values are 64. IDs are positive integers, not booleans or strings.

The artifact ZIP contains exactly one ordinary file, `verification-report.json`:

```json
{
  "schemaVersion": 1,
  "subject": {"repository": "owner/application", "base": "FULL_BASE_COMMIT", "head": "FULL_HEAD_COMMIT"},
  "verifier": {"id": "ENROLLED_VERIFIER_ID", "runId": 123, "runAttempt": 1, "sourceSha": "PINNED_VERIFIER_COMMIT"},
  "startedAt": "UTC_TIMESTAMP",
  "finishedAt": "UTC_TIMESTAMP",
  "suites": [{
    "evalId": "E-STRUCTURE",
    "coverageDigest": "DIGEST_FROM_TRUSTED_REQUIREMENTS",
    "testPaths": ["tools/jarvis-v5/tests/test_pack_tools.py"],
    "outcome": "passed", "passed": 1, "failed": 0, "skipped": 0
  }]
}
```

The real `testPaths` array is the entire sorted coverage set emitted by the trusted planner, not a manually chosen representative. Required suites must contain actual passing tests with zero failed/skipped cases. A suite change requires a new coverage digest and review.

## What the online gate verifies

After signature validation, the read-only collector requests live metadata from the enrolled GitHub repository. It verifies repository IDs, workflow ID, trigger, reviewed source commit, branch, workflow path and source bytes, successful run and latest run attempt, successful required jobs/steps, artifact name/ID/run binding, expiry, platform digest, downloaded ZIP digest and report digest. The report binds the candidate subject and verifier attempt, with timestamps inside the run.

A later rerun invalidates an earlier attempt's receipt. An artifact without platform digest, an incomplete paginated job list, missing access, mismatched head, failed step, stale result or unknown workflow fails closed. Archive paths, duplicates and symlinks are rejected. API and artifact reads are size bounded. Redirected artifact downloads strip the GitHub authorization header and accept only approved HTTPS storage hosts. There is no offline-trust flag.

## Semantic review receipt

An `eval-review` payload has the common subject/key/timestamps and `reviews` instead of `verification`. Each review row contains exactly `evalId`, `coverageDigest`, `reviewedAt`, `evidenceRef`, and `semanticReview: true`.

The gate requires a real timestamp no later than signing, within the BASE catalog's review interval, and matching coverage. A prior semantic review with unchanged coverage may be re-attested for a new head without falsifying its original review date. The new signature binds that decision to the new change. Do not refresh review dates merely to suppress a warning. Evidence references identify the review record; they are not provider URLs to execute.

## Commands and detached transport

```sh
python tools/jarvis-v5/promotion_evidence.py \
  --trusted-root /trusted/base --candidate-root /scratch/candidate-data \
  --repo /trusted/object-repository --base FULL_BASE_SHA --head FULL_HEAD_SHA \
  --evidence /scratch/evidence.json --plan-only
```

The plan names required evals and coverage digests. It reports `promotionAllowed: false`. For actual admission, omit `--plan-only`; supply a least-privilege GitHub read token only to this trusted process, never the candidate worker. The signatures and metadata must then pass.

The owner/recorder signs a prepared payload using the separate signing tool:

```sh
node tools/jarvis-v5/evidence-signing.mjs sign \
  --policy /trusted/EVIDENCE_POLICY.json --record /reviewed/payload.json \
  --private-key /owner-only/evidence-private.pem --output /reviewed/receipt.json \
  --i-verified-the-evidence
```

This tool supports software Ed25519 PEM keys. No hardware-token adapter is claimed. Protect keys outside builder reach. Never sign merely because a candidate produced a plausible payload.

The example collector accepts PR comments prefixed by `JARVIS_GOVERNANCE_APPROVAL_V1`, `JARVIS_CHANGE_IMPACT_V1`, or `JARVIS_EVIDENCE_V1`, followed by JSON. Comment authorship is not trusted; exact signatures and subjects are. The collector caps pagination and rejects an incomplete view. The impact record describes affected areas; it is not an authenticated run result.

## Final admission and installation limits

A successful GitHub status does not expire itself. The owner-controlled merge/release controller must re-run the exact-head gate immediately before promotion, verify current base/head and evidence age, and prevent other identities from bypassing it. Any base/head change requires new receipts. Final promotion must use conditional expected-head/base admission rather than a blind merge after an earlier read. Never auto-merge solely because an old status remains green.

The integration YAML is an example, not a configured required-check service. The pack delivers signature verification, API corroboration and fail-closed evidence selection. It does not install the separate verifier workflow, recorder, signer, protected check origin or final merge controller. These are explicit M01 acceptance requirements. Until installed, implementation remains supervised.

## Official sources consulted

- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/actions/workflow-jobs
- https://docs.github.com/en/rest/actions/artifacts
- https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target

The client uses GitHub REST API version `2026-03-10`. API access and the configured verifier must be smoke-tested during installation. Local provenance tests use fixtures, not a live GitHub account.
