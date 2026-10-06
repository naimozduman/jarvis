---
title: "JARVIS V5 local validation results"
document_id: "VALIDATION_REPORT"
status: "draft"
authority_class: "evidence"
owner_role: "test_evals"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
---

# Executed V5 results

513 automated tests passed, with 0 failures and 0 skips in the final run.

| Suite | Passed | Scope |
| --- | --- | --- |
| Python tools and reference controls | 189 | Pack metadata, evidence provenance, isolated-worker configuration, context selection, state updates, source planning, retirement and trusted-time examples |
| Node governance, mission and key tools | 107 | Temporary Git trees, exact signed changes, negative promotion paths, purpose-separated receipts, prerequisite admission and dummy-key lifecycle |
| JSON Schema fixtures | 217 | All 15 draft metaschemas, positive and negative fixtures, and required-field removal checks |

The run completed on 2026-09-26T22:16:22.481635+00:00. Environment: Python 3.13.5, Node v22.16.0, Linux, jsonschema 4.26.0. Exact commands, exit codes, tool/source hashes and raw logs are in `validation/report.json` and `validation/results/`.

## Additional checks

All 40 Python and Node source/test files passed syntax parsing. All 24 mission context packets compiled under their declared byte limits. The largest packet measured 59,966 UTF-8 bytes, below the 70,000-byte default. No mission packet automatically included the full PRD. Byte bounds are not a model-tokenizer guarantee.

All 93 product requirements map to at least one implementation mission. The 17 specialist agents and 22 skills have validated exact-name wiring. Fifteen draft prompt previews compile from 26 registered source modules, with content hashes and invariant injection. 32 original source/archive records were checked against their recorded hashes or original V4.1 bytes.

The final structural validator checks managed-file coverage, metadata, links, registries, generated views, prompt previews and checksums. The final packaging record is outside the ZIP so it does not create a recursive self-hash claim.

## A failure found and repaired

The first new Node suite found a signing-input incompatibility: the generic signer expected PEM but the tests also supplied a valid private KeyObject. The implementation was corrected. The original failed log remains in `validation/iterations/signing-input-first-run.log`. It is not counted as a passing release run.

## What this does not prove

No actual application build, database concurrency test, live provider call, code migration, deployment, key enrollment, branch protection, local dirty-work inspection or independent verifier installation was performed. The source review covered six pinned code/workflow files plus repository metadata, not the whole private repository.

Docker was unavailable, so the real rootless isolation probe did not run. Tests cover the launcher's configuration/denial behavior and synthetic fixtures, not isolation on the owner's machine. The networked reasoning host remains a separate boundary.

Mission admission prepares eligible task context but does not restrict an uncontrolled shell. Key transition verification produces proposed public state but does not atomically install an external trust root. Reference cost, lease, cancellation and time tests do not certify deployed PostgreSQL or executors.

Budget and authority profiles remain disabled proposals. Owner and verifier keys remain unenrolled. Pack creation grants no runtime capability or deployment permission.

## Reproduction

Run the commands in START_HERE and tools/jarvis-v5/README. Use the isolated schema requirements for the full contract suite. After an authorized source change, regenerate views and prompt previews, then refresh the managed index and run structural validation. Application reconciliation and live proof belong to the appropriate V5 mission.
