---
title: "Trusted GitHub Workflow Integration"
document_id: "integration::github::README"
status: "draft"
authority_class: "orientation"
owner_role: "release_operator"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
---

## Install only in J5-M01

The YAML example must enter an owner-approved trusted baseline together with reviewed tools, a registered owner public key and accepted policy. It is not an enabled workflow inside this extracted pack. Keep the existing application CI. Do not run the candidate checkout or install its dependencies in this privileged-trigger job.

The example handles same-repository feature branches. It uses a read-only token to fetch exact event SHAs, refuses a PR changed since the event, and extracts candidate blobs only as data. The trusted tools come from the base checkout.

## Detached evidence

A change-impact receipt binds to the exact final base/head. Keep it outside the commit it names. Add a PR comment beginning with the exact line JARVIS_CHANGE_IMPACT_V1 followed on the next line by the JSON object. The object must match templates/change-impact.json and include mapped areas, owning-doc changes or a reason, plus exact-head test run references. Comment authorship does not certify tests; independent CI still verifies them.

Protected changes additionally need an owner-signed receipt. Add a separate comment beginning JARVIS_GOVERNANCE_APPROVAL_V1 followed by the exact owner-signing JSON envelope. The gate verifies the signature against the accepted public key. Anyone copying a signature cannot change its repository, head, base, content or expiry.

Re-run the trusted workflow after adding receipts. A new head or changed base requires a new receipt and approval. No user-controlled string becomes a shell command. Receipts contain hashes and metadata, never signing keys or provider secrets.

## Settings outside this example

Require the exact trusted gate and existing application checks for promotion. Remove builder admin/bypass access. Restrict production secrets and deployment approval to the owner. Verify whether an untrusted workflow could spoof the same check identity. A status name alone is not sufficient isolation. Use an owner-controlled external GitHub App or independently required workflow where hosting features permit it.

The `main` metadata read during packaging reported protected=false. This pack did not change it. A workflow file is not proof of branch protection.

## Bootstrap and rollout limits

The example intentionally fails before public-key enrollment. Run and attack it in a disposable staging repository before enabling it on the real repository. Do not use pull_request_target to execute candidate tests. Run application tests in a separate unprivileged job. No live GitHub workflow run is certified by the local pack tests.
