---
title: "V5 enforcement status"
document_id: "v5-enforcement-status"
status: "generated"
authority_class: "generated"
owner_role: "security_reviewer"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Enforcement status

`implemented_pack` means delivered tooling with local tests. `reference_only` means a synthetic model or draft contract. `specified_not_implemented` means a requirement. None means deployed automatically.

| Control | Status | Delivered artifact | Remaining installation or implementation | Before |
| --- | --- | --- | --- | --- |
| GOV-01 | implemented_pack | `tools/jarvis-v5/trust-gate.mjs` | Owner key custody/enrollment, trusted runner, required check origin and current-head final promotion | J5-M01 |
| GOV-02 | implemented_pack | `tools/jarvis-v5/validate.py` | Actual-repository managed-file adoption and semantic review | J5-M01 |
| GOV-03 | implemented_pack | `tools/jarvis-v5/promotion_evidence.py` | Independently installed verifier/recorder, enrolled signer/workflow profiles and live GitHub smoke test | J5-M01 |
| GOV-04 | implemented_pack | `tools/jarvis-v5/mission_gate.mjs` | Trusted runner integration, enrolled verifier and authentic application completion evidence | J5-M02 |
| AUTH-01 | reference_only | `tools/jarvis-v5/reference_controls.py` | Real trusted UI, auth verifier, transaction binding and persistent executor guard | J5-M18 |
| AUTH-02 | reference_only | `schemas/drafts/authority-lease.schema.json` | Atomic use counts, revocation, concurrent authorization and actual runtime integration | J5-M18 |
| COST-01 | reference_only | `tools/jarvis-v5/reference_controls.py` | Atomic PostgreSQL reservation transactions, all billable adapters, owner profile | J5-M05 |
| PROMPT-01 | implemented_pack | `tools/jarvis-v5/compile_prompts.py` | Real loader adoption, model tokenizer accounting and behavioral evals | J5-M05 |
| SCHEMA-01 | implemented_pack | `governance/SCHEMA_REGISTRY.json` | Producer-consumer migration, generated types and active import mapping | J5-M13 |
| KILL-01 | specified_not_implemented | `docs/security/KILL_SWITCH_DRILLS.md` | Real cloud/local stop paths, stale epoch guards and deployed drills | J5-M18 |
| EVAL-01 | implemented_pack | `tools/jarvis-v5/promotion_evidence.py` | Real application suite mapping and independent review records; runtime activation and semantic adequacy | J5-M01 |
| OBS-01 | implemented_pack | `tools/jarvis-v5/review_evidence.py` | Authorized live provider reads tied to deployment and source SHA | J5-M00 |
| IDENTITY-01 | specified_not_implemented | `docs/security/AUTHENTICATION_BOUNDARY.md` | Owner-authenticated device binding, passkeys and recovery enrollment | J5-M07 |
| APPROVAL-UX | specified_not_implemented | `docs/security/APPROVAL_MODEL.md` | Trusted canonical renderer and real traffic instrumentation | J5-M18 |
| BUILD-01 | implemented_pack | `tools/jarvis-v5/isolated_worker.py` | Credential-free networked Codex host, reviewed image/rootless daemon, actual negative probe and remote-tool permission inventory | J5-M01 |
| KEY-01 | implemented_pack | `tools/jarvis-v5/key_lifecycle.mjs` | Real custody, external monotonic state CAS, platform recovery and owner ceremony | J5-M01 |
| CTX-01 | implemented_pack | `tools/jarvis-v5/context.py` | Actual source selection and promoted-context use | J5-M00 |
| STATE-01 | reference_only | `tools/jarvis-v5/state.py` | Original version-1 pack updater; current version-2 handoff uses reviewed edits; future updater needs schema/lock validation | J5-M02 |
| TIME-01 | reference_only | `tools/jarvis-v5/trusted_time.py` | Database-after-lock integration and real clock-health monitoring | J5-M18 |
| DR-01 | specified_not_implemented | `docs/security/DISASTER_RECOVERY.md` | Actual synthetic then authorized restore drills and source deletion reconciliation | J5-M06 |

Current test evidence is in `docs/archive/v5-validation/VALIDATION_REPORT.md`. Source observations are in `governance/RECONCILIATION.json`. Pack tests do not certify actual database transactions, local Docker isolation, privileged provider calls or branch protection.

## Current documentation maintenance

The implemented_pack labels above describe supplied reference tools and original pack tests, not installed application enforcement. Current documentation uses tools/jarvis-docs/manage.py for the PRD and explicit byte index; the roadmap/adapted plan and version-2 handoff remain reviewed manual views. Original generated prompt previews and validation logs are immutable historical evidence under docs/archive/v5-validation/.
