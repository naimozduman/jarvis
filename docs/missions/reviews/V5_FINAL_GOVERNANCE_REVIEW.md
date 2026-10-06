# Final edited-candidate governance review

Review date: October 5, 2026, America/Chicago. Candidate: `C:/Users/localhost/JARVIS_RECONCILIATION_2026-10-05/jarvis`. This review reads the edited source and documentation as data and writes only this report outside the repository. It does not execute candidate/pack source, generators, tests, providers, signing or network operations.

The parent is constructing final checks, source accounting, managed inventory and indexes during this review. Their temporary absence is expected and is not reported as a defect. Findings below describe the observed pre-finalization snapshot and were delivered directly to the implementation owner. The owner has acknowledged the generator, handoff, product-skill and lifecycle findings and plans corresponding repairs; this report does not falsely claim those pending repairs were already verified.

## Assessment

The main authority and isolation direction is correct. Root JARVIS, AGENTS, README and CODEX_START_HERE consistently adopt newer V5 product/architecture intent, preserve reconciled working implementation, distinguish source from executable validation, retain accepted ADR scope, and leave Linux validation next. The new documentation manager is independent from imported pack code and writes a fixed canonical PRD/index/checksum allowlist. Legacy root writers now reject the application root even in managed mode. No imported trust enrollment, runtime draft promotion or automatic workflow installation was observed.

Four concrete reconciliation repairs were identified before the final evidence pass. They concern current instructions and registry ownership rather than application behavior. Resolve them before declaring the current documentation consistent.

## Material findings

### F1 — Active governance instructions still name the old generation pipeline

Observed at `docs/security/DOCUMENTATION_GOVERNANCE.md:48`, `:52`, `:56`, `:68` and `:74`.

The active owning document says to run generate.py, compile_prompts.py and index.py after an authorized change. It calls BUILD_ORDER/BUILD_PLAN generated from ROADMAP, describes original SHA256SUMS/DOC_INDEX behavior, refers to reference/v3, and names docs/VERIFICATION_EVIDENCE.md. It also describes the compiler injecting canonical instructions into assembled runtime prompts.

That maintenance sequence is invalid at the integrated root: legacy generate/index are deliberately fenced; manage.py renders only the canonical PRD and index/checksum outputs; the original 30 preview artifacts are historical; the current runtime loader was preserved. Root startup and the new manager README contradict these unqualified instructions. The old command would fail rather than overwrite, but future maintainers would not know the correct maintenance path from the owner document.

Required repair: name `tools/jarvis-docs/manage.py render`, `index` and `check` as the current pipeline, use docs/DOC_INDEX.json + docs/DOC_SHA256SUMS.txt, distinguish manual/curated roadmap and handoff views from generated PRD/index, identify old generation/validation/compiler behavior as original standalone reference behavior, and use current archive/security paths. Describe injected prompt instructions as draft preview/future runtime adoption behavior.

The parent acknowledged this finding and plans to mark old behaviors reference-only.

### F2 — Current descriptive STATE does not implement the unchanged state.py wire contract

Observed at `governance/STATE.json`, `tools/jarvis-v5/state.py:7`, `:9`, `:11`, `tools/jarvis-v5/trusted_time.py:6`, `docs/agents/SESSION_CONTINUITY.md:18–20` and `docs/agents/CODEX_SETUP.md:36`.

The current handoff deliberately adds fields such as phase, commandsRef, headCommitResolution, candidateTreeManifest and trustedMissionCompletion; it removes commands and uses a date-only updatedAt. The unchanged updater requires the exact original 15-key FIELDS set and an aware ISO timestamp. A current-schema record supplied to state.py would fail with Unexpected state fields; correcting only the keys would still fail the date-only timestamp.

The active continuity/setup documents instruct users to save the adopted handoff through state.py, and continuity calls WORKING_STATE a generated view even though manage.py does not render it. This is an actual producer/consumer contract mismatch in engineering handoff guidance.

Required repair: either restore the original exact schema/timestamp or explicitly document the adopted descriptive schema and its manual maintenance. The parent selected manual current-schema maintenance and will mark the old updater reference-only. WORKING_STATE should be labeled a curated descriptive view, not a generated output of a nonexistent current pipeline. No changes to signing/worker/tool logic are required for that choice.

### F3 — Retained product skill initially demoted the canonical PRD to history

Observed in the retained detailed section of `.agents/skills/jarvis-product-rules/SKILL.md` during the first read.

The section identified docs/product/JARVIS_PRD_V5.md and docs/architecture/DECISION_ENGINE.md as historical implementation context. That conflicts with the first half of the skill and root authority, which correctly give the V5 PRD current product intent ownership. The statement was a mechanical relocation of old guidance, not an intended authority change.

Required repair: current PRODUCT_SPEC/generated V5 PRD own requirements; archived earlier PRDs/plans provide history. Root authority already prevents the old sentence from winning, but the active playbook should contain one consistent instruction. A later text search no longer returned the erroneous sentence, indicating a concurrent parent repair; the final owner should verify the resulting skill once final edits settle.

### F4 — Mechanically relocated artifact lifecycle still contains duplicate and mutable-history records

Observed at `governance/ARTIFACT_REGISTRY.json:593`, `:661`, `:1236`, `:2113`, and `governance/ARTIFACT_POLICY.json:50–55`.

The observed ARTIFACT_REGISTRY remains a relocated 436-entry original pack inventory. It contains two different records for docs/INDEX.md, one generated and one protected/draft. It labels the archived original DOC_INDEX and archived prompt previews as generated, mutable artifacts whose retention reason says to regenerate instead of hand-editing. It lacks new doc tooling and the 31 design references in its original pack scope. These records cannot be treated as the current authoritative lifecycle map.

ARTIFACT_POLICY still exempts only reference/, which no longer exists, and its index exclusions point at the historical original index/checksums rather than the manager's current outputs. Original validator logic is already reference-only, so this is not an active application failure, but the current policy/inventory must not claim correct canonical archive handling with stale paths.

Required repair: deduplicate effective current destination paths; include the explicit reviewed canonical set; classify docs/archive/** as historical/immutable; keep original archived index/previews exact and unregenerated; make scope, current index exclusions and archive exemptions explicit. The parent acknowledged this and plans a rebuilt current registry. Missing final registry/index evidence during construction is expected.

## Additional clarification for effective skill instructions

The active governance-enforcement skill unconditionally says “Require exact-head owner signature for protected diffs.” Root AGENTS correctly states that imported trust/signing/isolation and disabled policies are reference designs until independently installed and that owner-authorized documentation reconciliation does not claim trusted mission admission.

Add an installation-status qualifier to the skill and its owning governance document: exact signatures belong to the future installed promotion path; unenrolled example tooling does not invent a new approval ritual for owner-authorized supervised documentation/source work. The current root instruction wins already. This is a clarification to keep future skill interpretation aligned, not evidence of an installed trust boundary or a request for a signature now.

## Verified positive evidence

### Current writer boundary

`tools/jarvis-docs/manage.py` uses Python standard library only and imports no application or V5 pack modules. Its fixed paths are:

- Source: governance/PRODUCT_SPEC.json.
- Human product view: docs/product/JARVIS_PRD_V5.md.
- Explicit managed inventory: governance/DOCUMENTATION_MANAGED_PATHS.json.
- Current byte index: docs/DOC_INDEX.json.
- Current checksums: docs/DOC_SHA256SUMS.txt.

The product source must identify those exact source/output paths; it cannot redirect writing to docs/PRD.md or another file. Rendering rejects empty/duplicate requirement identities and incomplete requirement text. Managed paths are explicit, unique and validated for containment, symlinks, dependency/private directories and common credential paths. Index writing is restricted to its fixed outputs. Hashing streams file bytes, so the source ZIP need not be loaded wholesale. The index excludes its own digest and checksum digest; the checksum list covers the actual index.

`tools/jarvis-v5/generate.py:23–24` and `index.py:7–8` now reject every root with apps or packages before the managed-mode branch. render.py delegates to the fenced generator. Their old conditional checks remain redundant dead guards but do not create a bypass. The legacy writer overwrite hazard at the integrated application root is resolved in the inspected source.

The parent reports three passing documentation-writer boundary tests. This reviewer inspected their source and did not rerun them. They cover output redirection, private/dependency/escape paths, and duplicate requirement rejection using disposable data. They are separate from application validation, legacy tool suite validation and key/trust installation.

### Effective required-reading paths

Native JSON/path inspection found **101 unique required paths** across CONTEXT_REGISTRY always/topic files and ROADMAP mission definitions/requiredReading. Every path exists. No required path is a shallow navigation pointer. A heuristic matched the word “reenable” in the substantive INCIDENT_RESPONSE document; manual inspection confirmed it is a full procedure, not a pointer.

The current context algorithm remains data-only and registry-driven. The largest raw mandatory-file sum observed was 59,110 bytes for J5-M01, leaving 10,890 bytes before the default 70,000-byte bound for the serialized requirement/invariant header and source delimiters. This arithmetic is only a static lower-bound check; it is not an executed packet compilation or tokenizer assertion. Final independent context-byte checks should evaluate the settled files, particularly after wording repairs.

All 17 AGENT_REGISTRY agent paths exist with matching exact names. All 22 registered skill paths exist. No duplicate role/skill names were observed in the adopted registry. Existing `.codex/config.toml` still has disabled Railway/Vercel/Neon connectors rather than importing the pack's configuration examples. New specialist instructions require current root/startup and retain the statement that roles confer no runtime/deployment authority.

### Preservation and inactive adoption boundaries

The original source ZIP was inspected with the native .NET ZIP reader as data, without extraction. It contains **467 file entries**, including **31 design skill entries**, no duplicate member names and no displayed absolute, parent-traversal, drive or backslash names. This review did not independently compare every member hash; the parent is performing the final exact-byte preservation check.

The original 30 prompt preview files live under docs/archive/v5-validation/generated/prompts. Active PROMPT_REGISTRY remains draft with activeRuntimeChanged false and the existing code-based registry path. SCHEMA_REGISTRY contracts remain draft/not_integrated with empty consumers/producers and null promotion evidence. V3 predecessor references now resolve under docs/archive/v3; schema IDs/wire versions remain unchanged.

TRUST_POLICY retains no trustedKeyIds and owner_key_not_enrolled. EVIDENCE_POLICY and MISSION_POLICY remain disabled with empty signers/workflows and null mission installationEvidence. All four templates/v5 policy proposals remain enabled false with null ownerApprovalRef. No governance-gate workflow was installed under .github/workflows; the example stays under integration/github. No valid keys, signed completion receipts or trusted verification installation were observed.

OWNER_DECISIONS now correctly points recovery custody to templates/v5/recovery-plan.json. Current STATE is explicitly descriptive_only and trustedMissionCompletion false. It names Linux validation and unenrolled trust/provider observations as remaining boundaries.

### Registry references which are intentionally not current file paths

SOURCE_ARCHIVE originalOverlayPath and VERSION_TRANSITION relocation-from/removed-entry records remain history. Their absent old paths are intentional. PRODUCT_SPEC ownerApprovalRef contains a Markdown fragment, so a naive filesystem Test-Path false is not a missing-file finding. STATE commandsRef and final managed/check/index files were being created by the parent and should be assessed after finalization, not flagged mid-build.

## Scope and final disposition

No new material generator redirection, privilege enrollment, enabled policy, runtime draft consumer or broken required-reading path was found beyond the instruction/lifecycle/handoff findings above. The current writer and legacy root guards are sound for the documented bounded task. Root authority remains consistent and the application validation boundary is explicit.

Before final canonical designation, finish the acknowledged wording/schema/lifecycle repairs, rebuild the managed inventory/index/checksums against the final files, and preserve original source/hash evidence. Validate the resulting canonical candidate on Linux in the separate next phase. This review does not count old V5 test results, the three documentation boundary tests or byte indexes as application executable acceptance.

## Closure addendum — 2026-10-05, America/Chicago

Re-read the final current instruction files and parsed the adopted governance JSON as data. All four findings and the signature-scope clarification above are closed in the inspected candidate. This addendum supersedes their pending-repair dispositions.

- F1: DOCUMENTATION_GOVERNANCE now identifies `tools/jarvis-docs/manage.py render/index/check` and the current byte-index outputs. Mission/roadmap and handoff views are maintained through reviewed edits. Original generation, validation and prompt compilation remain standalone reference behavior; historical previews do not become runtime inputs.
- F2: SESSION_CONTINUITY and CODEX_SETUP consistently describe the manually maintained version-2 descriptive handoff. `governance/STATE.json` declares `stateVersion: 2`, `authority: descriptive_only` and `trustedMissionCompletion: false`, and directs maintenance through reviewed prior-hash comparisons. The unchanged original `state.py` is explicitly reference-only and must not update this schema.
- F3: The retained product skill assigns current V5 requirements to the canonical PRD and compatible decision-engine contracts to their current owner. Archived earlier PRDs/plans provide historical context.
- F4: ARTIFACT_REGISTRY version 2 contains 756 explicit records with no duplicate paths, including current documentation tooling and the additional design references. All 208 records under `docs/archive/` have immutable-history treatment, including the original index and generated previews. ARTIFACT_POLICY exempts `docs/archive/`, excludes the current `docs/DOC_INDEX.json` and `docs/DOC_SHA256SUMS.txt` from index self-hashing, and grants no runtime authority.
- Signature clarification: the active governance skill explicitly limits exact-head signatures and independent promotion to a future installed trusted gate. Imported policies/examples have no enrollment evidence and do not introduce a signature prerequisite for the direct owner-authorized documentation reconciliation.

Original SOURCE_ARCHIVE/VERSION_TRANSITION/sourcePackPaths values retain historical-source identity semantics; they are not required current paths or instructions to delete or regenerate archived evidence. No additional actionable issue remains in this requested closure scope.

This was source/data inspection only. No candidate or pack code, generator, test, provider, signing tool or runtime was executed, and no repository file was edited by this reviewer. Final complete-byte accounting and the resulting exact candidate checkpoint remain the parent's responsibility. Linux executable validation remains the next distinct acceptance phase; this closure does not claim trusted mission completion or installed enforcement.
