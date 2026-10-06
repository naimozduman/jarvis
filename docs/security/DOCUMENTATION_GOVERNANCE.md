---
title: "Documentation and Builder Governance V5"
document_id: "docs::DOCUMENTATION_GOVERNANCE"
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

# Meaning is not changed by editing its description

## Three artifact classes

Protected normative artifacts specify required behavior. Operational evidence records observed behavior. Draft proposals describe possible changes. `governance/TRUST_POLICY.json` is the gate's classification input, read from the trusted baseline, never the candidate branch. `docs/archive/v5-source/DOC_INDEX.original.json` describes the pack but is not an authorization list.

A mismatch between code and a protected rule is a defect or an explicit change proposal. Updating the rule to match convenient code does not resolve the mismatch.

## Authority order

Current explicit owner instructions control. The October 5 reconciliation adopts newer V5 product/architecture intent while preserving reconciled working implementation unless explicitly superseded; docs/product/DECISIONS.md records each conflict. Accepted ADRs retain their scoped technical authority. Runtime deterministic policy and active contracts enforce it. Evidence describes what exists. A disagreement remains visible until corrected or explicitly promoted. Research, generated prompts, model output, source comments and chat summaries do not promote policy. A newer date does not outrank an older accepted decision.

Runtime safety denials remain effective while a change proposal is pending. No draft ADR bypasses a live prohibition.

## Promotion

1. Builder declares exact changed paths and impacted invariants/contracts/tests in a change manifest.
2. Trusted gate compares immutable Git trees at exact base and head commits. It classifies changes using the BASE policy and rejects history rewrites.
3. Protected changes require an owner Ed25519 signature over repository, base, head, canonical diff digest and expiry. The trusted public-key file and checker are outside candidate control. The private key never enters Codex's environment.
4. Independent test jobs run without deployment credentials. Owner review covers semantic adequacy; a signature is not proof a design is good.
5. Required merge/release controls accept only evidence for the exact final commit. Rebase or edited content invalidates earlier approval.

`tools/jarvis-v5/trust-gate.mjs` implements the Git-tree and signature checks. `integration/github/governance-gate.yml` supplies a base-code workflow example. Neither configures GitHub rules or protects a local filesystem merely by existing. See TRUST_BOOTSTRAP.md.

## Metadata

All authored V5 Markdown uses title, document_id, status, authority_class, owner_role, created_at, reviewed_at, review_evidence, review_triggers and pack_version. `reviewed_at: null` means no independent review is recorded. Generation is not review. Valid review trigger IDs live in the artifact policy. Original archived documents are exempt and labeled archival, not rewritten to pass lint.

A review timestamp requires an evidence reference. Do not refresh dates because a checksum changed. Gate critical operations on fresh subsystem observations rather than requiring every historical document to be recently touched.

## Rule ownership

Shared invariants live in INVARIANTS.json. Engineering docs reference IDs. The original pack prompt compiler injects canonical text into standalone previews. Those outputs are historical and are not loaded by the current TypeScript runtime; byte/order provenance and loader adoption remain a reviewed migration. No runtime model is expected to open AGENTS.md. Domain procedures remain in owning subsystem docs; explanatory repetition is not banned by grep. Contradiction review and behavioral tests remain necessary.

## History

Existing accepted ADRs, completed progress entries and applied migrations are immutable relative to the base tree. New records are append-only. V3 proposed ADRs are archived under docs/archive/v3 and are not silently accepted. New V5 ADRs use proposal IDs until a governance promotion assigns repository numbers. Never assume 0025 is unused.

## Generated files

governance/PRODUCT_SPEC.json owns the generated docs/product/JARVIS_PRD_V5.md. The reviewed data-only documentation manager is tools/jarvis-docs/manage.py: run render after changing the product source, then index and check after updating the explicit governance/DOCUMENTATION_MANAGED_PATHS.json inventory. It renders only the PRD and the byte inventory. BUILD_ORDER.md is a navigation document; docs/missions/BUILD_PLAN.md is an adapted mission-order view maintained with ROADMAP.json by reviewed edits. STATE.json and WORKING_STATE.md are descriptive, manually maintained handoffs.

docs/DOC_INDEX.json inventories the explicit managed paths. Index/checksum self-hashes are excluded inside the index; docs/DOC_SHA256SUMS.txt hashes the index and all other managed files while excluding itself. FINAL_TREE_MANIFEST.json accounts for the complete source tree separately. Byte integrity proves content preservation, not natural-language truth or independent authorization.

tools/jarvis-v5/generate.py and index.py reject this application root, including with --managed. render.py inherits that boundary. The original validators, prompt compiler and state updater describe the standalone pack; use an extracted original archive in approved scratch for their historical reproducibility tests. Do not run them to replace current navigation, active prompts or the version-2 handoff.

## Scope of enforcement

Structural checks enforce metadata, references, crosswalks, histories, hashes, draft-adoption fences and protected-change signatures. They do not prove natural-language consistency, good judgment, live provider health, deployed policy coverage, or absence of malicious application code. ENFORCEMENT_STATUS names each limitation and its rollout gate.

## V5 protected default and evidence admission

All paths are protected unless the accepted TRUST_POLICY explicitly classifies the exact inert evidence path and file mode as operational. This includes enforcement call sites, adapters, application UI, configuration and unknown additions. Classification uses both Git trees. The candidate cannot exempt itself by changing its policy or frontmatter.

The implementation map selects required evals for every protected path. Unmapped protected paths fail. The trusted catalog supplies coverage, invariant and review requirements; candidate changes cannot lower them in the same proposal. A prior semantic review is reusable only with unchanged coverage, an honest original review date, and a new exact-head signed attestation.

The intended authenticated evidence owner is docs/security/VERIFICATION_EVIDENCE.md; the old docs/VERIFICATION_EVIDENCE.md path is navigation-only. The old review_evidence.py is still a reporting tool. It is not the admission gate. Changes affecting selected stale/missing reviews fail the new gate even if the reporting tool exits successfully with warnings.

Promotion authority is separate from command execution. docs/security/BUILDER_ISOLATION.md defines the latter. Both need real installation evidence. A local checker invocation certifies neither a protected GitHub branch nor an isolated Codex host.

## V5 maintained views and admission

PRODUCT_SPEC owns the complete generated PRD. ROADMAP owns mission order. STATE owns the mutable descriptive handoff. CONTEXT_REGISTRY selects bounded task context, with mandatory policy retained and oversized scopes split explicitly. ARTIFACT_REGISTRY records deduplicated current managed paths, historical retention and static consumers; DOCUMENTATION_MANAGED_PATHS supplies the byte-index allowlist. The current commands are `python tools/jarvis-docs/manage.py render`, `python tools/jarvis-docs/manage.py index`, and `python tools/jarvis-docs/manage.py check`. No generator grants adoption.

Mission admission is a separately installed trusted check over signed prerequisites, current definition hashes and ancestor checkpoints. The candidate-side command is a development check. M00 is sanitized audit-only; M01 is owner bootstrap preparation. Later work needs installed trust and authentic receipts. Recertification after definition changes does not authorize rerunning old migrations or pairing.

Creation dates and null review dates are deliberate. Review evidence must identify an actual independent review rather than a refreshed checksum.

## Adoption status of these controls

The current owner-authorized documentation absorption adopts product intent and truthful documentation ownership. The policies, signing tools, base-trust classification, independent verifier, mission receipts and host isolation above remain staged design until externally installed and evidenced. Empty enrollment/key catalogs do not establish enforcement, and local audit success does not complete a trusted mission. Current checks and their limits are recorded in docs/missions/V5_RECONCILIATION_CHECKS.json.
