# V5 tooling and governance review

Review date: October 5, 2026, America/Chicago. Reviewer: read-only governance/tooling subagent. Source pack: `C:/Users/localhost/JARVIS_PRESERVATION_2026-10-05/snapshots/jarvis-v5-pack`. Candidate: `C:/Users/localhost/JARVIS_RECONCILIATION_2026-10-05/jarvis`.

This review reads files as data. It does not execute pack code, application code, generators, tests, signing commands, Docker, provider operations or network requests. It writes only this evidence file outside the candidate repository. Proposed paths below are recommendations for the implementation owner, not claims that relocation has happened.

## Recommendation

Adopt V5 product and architecture intent into grouped canonical documents, preserve the existing application, and retain the V5 engineering toolkit with explicit activation boundaries. Preserve all 467 input files in an immutable source archive with a per-file SHA-256 accounting map. Keep one editable `governance/PRODUCT_SPEC.json` and one rendered `docs/product/JARVIS_PRD_V5.md`. Navigation pointers at legacy validator paths can remain, but must not contain a second normative PRD.

For the smallest maintainable documentation change, add a separate, narrowly scoped canonical documentation renderer/indexer that reads JSON and Markdown as data, does not import pack modules, and only writes an explicit allowlist of current document views and inventories. Preserve original trust/signing/worker logic. Fence original `generate.py` and `index.py` against the integrated application root, including their existing `--managed` bypass, or delegate their application-root entry to the canonical renderer. `render.py` calls `generate()` and inherits this fence. Do not leave an unchanged legacy generator that can overwrite the new compatibility pointers.

`context.py` already derives exact requirement slices from root PRODUCT_SPEC and takes document paths from ROADMAP and CONTEXT_REGISTRY. Relocating those registry fields is sufficient for context selection; no algorithm change is necessary. Keep every required document substantive: compatibility pointers in a required-reading list would produce shallow context, because context.py does not follow links.

The pack's protected-change, mission, verification, owner-key and runtime policy designs can become current specifications without falsely claiming that their enforcement is installed. Keep all enrollment policies disabled and all runtime drafts unadopted. The current human request authorizes documentation reconciliation; an unenrolled example gate does not create a new permission requirement for this task.

## Input accounting and unique inventories

Native `rg --files --hidden` inventory contains **467 files**. Original `docs/DOC_INDEX.json` inventories **436**. The extra **31 files** are the complete `claude-ui-ux-dev-skills/` tree, outside the original V5 managed inventory. An audit that validates only DOC_INDEX silently misses these extras.

| Group | Actual files | Retention / adoption role |
| --- | ---: | --- |
| `.agents/` | 22 | V5 engineering skill source; six collide with current skills |
| `.codex/` | 17 | Coding specialist configs; eight collide with current configs |
| `docs/` | 112 | Product/architecture/security/operations documents, 14 ADR proposals, generated views and index |
| `governance/` | 26 | Intent, crosswalks, policy proposals, historical observations and descriptive state |
| `missions/` | 24 | Stable J5-M00 through J5-M23 definitions; future work, no automatic execution |
| `tools/` | 42 | Tool source, tool tests, README, schema requirements; not application scaffolding |
| `schemas/` | 16 | README and 15 draft JSON Schemas |
| `tests/` | 30 | One valid and one invalid fixture for every draft schema |
| `prompts/` | 27 | 26 modular draft prompts and START_V5 notice |
| `generated/` | 30 | 15 `.txt` previews plus 15 JSON manifests |
| `templates/` | 21 | Proposed policy, evidence, action, recovery and lifecycle forms |
| `integration/` | 4 | Codex config and GitHub workflow examples; never installed by copy |
| `reference/` | 42 | Original sources, V3 schemas/ADRs, V4 proposals, V4.1 acceptance and validation history |
| `validation/` | 9 | Historical V5 report/logs/context metrics/archive checks, including original failed signing iteration |
| `claude-ui-ux-dev-skills/` | 31 | Fourteen skill documents, scripts/archive, licenses, themes and showcase |
| Root files | 14 | Entry/orientation, build view, reports, source index, manifest and checksums |

Counts are based on actual file discovery, not wording in a historical report. The source pack claims 93 requirements, 22 invariants, 16 context topics, 17 coding agents, 22 V5 skills, 24 missions, 26 prompt modules, 15 prompt assemblies and 15 draft contracts. The actual inspected registries expose those structures. None of these counts measures implemented product features.

### Governance registry inventory

All 26 filenames below are unique additions to this candidate at the time of inspection. A root `governance/` tree can hold adopted documentation registries, but its existence never grants runtime enforcement or installation.

| Registry | Required interpretation and path work |
| --- | --- |
| PRODUCT_SPEC.json | One current machine-readable product source. The rendered PRD is derived, never separately maintained. |
| INVARIANTS.json | Canonical invariant IDs/text. Relocate `owningDoc` paths. A new owningDoc path changes full-registry digests even when rule text stays unchanged. |
| ROADMAP.json | Definitions/dependencies only. Relocate mission `path` and `requiredReading`; do not mark completed to match repository work. |
| CONTEXT_REGISTRY.json | Required topic files and exact requirement slices. Relocate all active paths and retain byte budgets/failure semantics. |
| AGENT_REGISTRY.json | Exact specialist/skill names and source locations. Can point to reference configs outside auto-discovery locations. |
| PROMPT_REGISTRY.json | `status: draft`, `activeRuntimeChanged: false`; existing active registry is the code registry. Keep draft module paths/hashes current. |
| SCHEMA_REGISTRY.json | All 15 `producerStatus: not_integrated`, empty producers/consumers, null promotion evidence. Relocate owning docs and predecessors without changing contract identities. |
| REQUIREMENT_TRACE.json | Generated 93-requirement mission crosswalk. `runtimeProof: null` is deliberate. |
| ARTIFACT_REGISTRY.json | Generated managed-file lifecycle and static consumers, not a comprehensive application dependency graph. Rebuild from exact adoption map, including extras and historical classes. |
| ARTIFACT_POLICY.json | Metadata classes/triggers and index exclusions. Must recognize adopted archive paths without forcing metadata onto preserved historical bodies. |
| CONTROL_MATRIX.json | `implemented_pack`, `reference_only` and `specified_not_implemented` describe pack delivery, not deployment. Relocate artifacts; annotate current implementation evidence separately. |
| IMPLEMENTATION_MAP.json | Ownership and proposed evidence mapping. Relocate owningDocs and relocated mission/config/template patterns, retaining actual application source/test patterns. It is a candidate baseline. |
| EVAL_CATALOG.json | Reference test source mapping and planned product evals; E-APP-REGRESSION is still planned/unmapped in original. Discover actual repository suites before installation. |
| TRUST_POLICY.json | Policy v2, all paths protected by default, empty trustedKeyIds, owner_key_not_enrolled. Imported policy remains unenrolled. Existing accepted history patterns must still protect docs/ADR and database migrations. |
| EVIDENCE_POLICY.json | `enabled: false`, empty signers/workflows. Proposed freshness/activation conditions; no authenticated verification installer. |
| MISSION_POLICY.json | `enabled: false`, empty signers, null installationEvidence. Proposed trusted-controller policy only. |
| STATE.json | Descriptive-only state; original values are all null with original pack integration blockers. Replace active handoff description honestly or retain as dated original observation; no completion receipts implied. |
| OBSERVATIONS.json | Historical unknown/live-state observations. Do not infer present deployment from them. |
| RECONCILIATION.json | Six focused static observations at commit 481b262817095fdc070871c22c7897d21b4f3fcf; not current reconciliation findings. |
| OWNER_DECISIONS.json | Historical $50, unapproved $60, pending budget/lease/interruption/recovery settings. No runtime enrollment. Contains one broken recovery template path noted below. |
| RETIREMENTS.json | Explicit proposal records and lineage only. Nothing grants deletion of current files. |
| REVIEW_DISPOSITION.json | Original pack review provenance, not independent acceptance of this merged candidate. |
| RESEARCH_SOURCES.json | Research evidence provenance. Never install product authority from a research source. |
| SOURCE_ARCHIVE.json | Original source path/hash and old overlay lineage. `originalOverlayPath` intentionally describes historical paths; do not rewrite them as if they were current references. |
| VERSION_TRANSITION.json | V3/V4/V4.1 to V5 pack relocation/removal history. `removedPackEntryPoints` is not a list of candidate runtime files to delete. |
| MISSION_TRANSITION.json | Old/new mission mapping; no old completion automatically becomes V5 signed evidence. |

### Tool inventory

Preserve the full 42-file tools tree. The 40 Python/Node source/test files are distinct from README and requirements-schema.txt.

Data selection, planning and documentation:

- common.py, generate.py, render.py, index.py, context.py, compile_prompts.py, v5_checks.py, validate.py.
- reconcile.py, overlay_plan.py, impact.py, review_evidence.py, retirement.py, state.py, env_report.py.

Trust, records and remote evidence:

- trust-gate.mjs, evidence-signing.mjs, signed_records.mjs, owner-signing.mjs, owner_record_signing.mjs, key_lifecycle.mjs.
- mission_gate.mjs, mission_runner.py, promotion_evidence.py, github_candidate.py, git_snapshot.py, version_gate.py.

Worker/isolation/reference models:

- prepare_builder.py, isolated_worker.py, isolation_probe.py, reference_controls.py, trusted_time.py.

Tool and schema tests:

- tests/test_pack_tools.py, tests/test_reference_controls.py, tests/test_v41_enforcement.py, tests/test_v5_tools.py.
- tests/trust-gate.test.mjs, tests/v41-enforcement.test.mjs, tests/v5-trust.test.mjs, schema_tests/test_schemas.py.

Supporting files: README.md and requirements-schema.txt.

GitHub collectors and promotion evidence tools can perform remote reads when run; signing tools can generate/sign key material; isolated_worker can launch Docker; state/generation/index tools mutate files. A generic description such as “tooling only” is not an execution authorization. Preserve them with their actual purpose and future validation boundary.

### Prompt/schema/template inventory

Draft schemas are action-intent, approval-resolution, authority-lease, capability, execution-authorization, executor-manifest, first-party-app-event, first-party-app-manifest, life-ledger-event, proactive-brief, prompt-assembly, proposed-action, skill-record, source-reference and world-state. Their absolute schema IDs and `1.0.0-draft` wire versions remain unchanged by relocation. The six existing runtime schemas are explicitly external-preservation references and remain in the candidate's `schemas/` root. No producer or consumer adoption can be claimed from a copied draft.

Prompt assemblies are conversation, replan, weekly-review, voice, edith, night-mode, research, finance, health, fba, mentor, relationship, skill-curation, email and proactive. Each injects selected invariant text and ordered modules. All preview texts explicitly identify themselves as draft previews. They must remain outside the code-based active runtime registry and outside old `prompts/runtime/*.md` consumers.

The 26 draft modules are core-system, constitution, source-grounding, uncertainty, security-privacy, tool-policy, message-writer, accountability, planner, replanner, memory-extractor, skill-curator, weekly-review, email-triage, finance-observer, health-and-training, historical-reconstruction, proactive-operator, voice, night-mode, browser-operator, relationship-vault, fba-ops, mode-friday, mode-mentor and mode-edith.

The 21 templates are authority-lease.json, bootstrap-receipt.json, capability-manifest.json, change-impact.json, connector-card-spec.md, executor-manifest.json, first-party-app-manifest.json, health-check.json, incident-record.json, key-state.proposed.json, mission-run.json, recovery-plan.json, release-record.json, retirement-proposal.json, runbook-template.md, session-handoff.json, skill-template.md, and four policies: authority-expansion.proposed.json, authority.proposed.json, interruptions.proposed.json, runtime-budget.proposed.json.

Only connector-card-spec.md collides with an existing candidate template; its bytes differ. Preserve the old version in an appropriate archive and merge current connector/runtime-specific detail rather than automatically preferring a shorter generic template. Proposed policies are disabled, and placeholder receipts/keys are templates rather than real records.

## Runtime and installed-trust boundaries

The pack itself explicitly preserves current prompt assembly, context limits, deterministic denial, kill flag, model budget guard and application CI. Its RECONCILIATION observations date to a different source checkpoint; R1/current candidate changes may already resolve observations. Do not turn those old observations into present-tense defect claims without current source and tests.

Existing active code lives in `packages/brain/src/prompts`, current runtime prompt sources in `prompts/runtime/*.md`, TypeScript contracts in `packages/contracts`, current JSON schemas in `schemas/*.schema.json`, and database storage/migrations in `packages/database`. None should be replaced by V5 drafts, reference_controls.py arithmetic or a generic scaffold.

TRUST_POLICY has no enrolled owner keys; EVIDENCE_POLICY and MISSION_POLICY are disabled. The workflow lives in `integration/github/`, not `.github/workflows/`, and explicitly identifies itself as an integration example. Codex configuration examples are not merged into `.codex/config.toml` or the user's global settings. No available file proves a credential-free host, protected merge, independently trusted recorder, reviewed rootless image, key custody or actual Docker isolation.

The user adopting newer product intent does not authorize a future email/send/payment/provider/key ceremony. Finance remains prohibited beyond observation under INV-FINANCE-001. The $50 and $60 history does not choose an active budget. M00/M01 examples remain roadmap documentation unless separately requested; no new signature should be invented to admit the present documentation change.

## Mission evidence and historical validation

J5-M00 is audit-only; J5-M01 is owner-controlled trust preparation/installation. J5-M02 onward requires independently enrolled mission trust and current prerequisite receipts for implementation. ROADMAP and STATE are descriptive and contain no cryptographic completion proof. Existing preservation/reconciliation evidence can support later recertification; it should not be relabeled as a completed signed mission now.

Mission definition hashing in mission_gate.mjs binds mission object, mission Markdown, required-reading hashes and referenced exact product requirements, excluding display-only runState/completedRunRef. Relocating current document paths changes definitions. A later installed verifier must issue new receipts or recertify existing qualifying evidence; path changes must not trigger re-running old migrations, pairing or provider effects merely to refresh dates.

M00's generic Work method includes an implementation step while its own Non-goals forbids source changes. For current reading, the explicit audit-only mission mode/non-goals control. Preserve original bytes and clarify the canonical mission interpretation instead of using the generic step as an implementation grant.

VALIDATION_REPORT.md reports **513 tests passed** on **September 26, 2026, at 22:16:22.481635 UTC**: 189 Python, 107 Node and 217 JSON Schema cases, Python 3.13.5, Node 22.16.0, Linux, jsonschema 4.26.0. It reports 40 syntax files, 24 bounded mission packets, 32 source/archive records and the largest packet at 59,966 UTF-8 bytes. This is prior pack evidence, not tests run against the merged October 5 repository. The original failed signing-input log is preserved and excluded from the passing final-run count.

The source report expressly did not execute application builds, real DB concurrency, providers, migrations, deployment, enrollment, branch protection, local dirty-tree audit or independent verifier installation. Docker was unavailable. Tests exercised configuration, synthetic Git/signature/key/isolation cases and reference models. Preserve those exact limitations beside the historical results. Linux candidate validation remains required.

## Exact path coupling and required repairs

The critical coupling is observable directly in source:

| Source location | Behavior | Consequence after grouping |
| --- | --- | --- |
| generate.py:10–11 | Eight fixed generated outputs include docs/PRD.md, docs/BUILD_PLAN.md, BUILD_ORDER.md, docs/WORKING_STATE.md, docs/ENFORCEMENT_STATUS.md, root governance crosswalks and MANIFEST.md | `--managed` does not prevent overwriting new compatibility pointers. |
| generate.py:23–27 | Apps/packages check is bypassed by managed mode; managed set comes from docs/DOC_INDEX.json | Do not hand it a whole merged-repo index. |
| generate.py:43 | PRD output hard-coded as docs/PRD.md | Canonical renderer must output docs/product/JARVIS_PRD_V5.md. |
| generate.py:48 | Mission links use `../` + mission path, assuming BUILD_PLAN sits at docs/ | Use relative links computed from actual output directory. |
| generate.py:82–89 | Only `reference/` is classified archival; metadata is required for every other Markdown; immutableHistory equals archived | A new docs/archive tree would otherwise be treated as active metadata-governed artifacts and preserved bodies fail. |
| common.py:71–83 | make_index requires non-reference Markdown frontmatter and excludes only docs/DOC_INDEX.json/SHA256SUMS self-hashes | New canonical index needs explicit historical/compatibility metadata handling and exact exclusions. |
| index.py:7–19 | Root indexing with --managed still rewrites original index/checksum paths | Fence legacy writer or delegate to canonical allowlisted writer. |
| context.py:19,31,38 | Root PRODUCT_SPEC; registry-owned exact files; mandatory overflow fails | Relocated registry paths suffice; do not substitute pointers or truncate safety. |
| compile_prompts.py | Full INVARIANTS bytes are hashed into preview JSON invariantDigest | Owning-doc path-only updates require current preview JSON regeneration or explicit historical-preview labeling. |
| validate.py:21,34 | Original index path and metadata assumptions | Original validator is not automatically a merged canonical-doc validator. |
| validate.py / v5_checks.py:41 | Calls original generated views and compares all fixed output bytes | Original validation cannot certify grouped docs until generator paths are adapted. |
| Tool tests' ROOT declarations | Python tests infer pack root from tool file position | Preserved original tests may expect original pack AGENTS/index/generated views; run original tests on original archived/extracted pack, or adapt under Linux with an explicit diff. |
| integration/github/governance-gate.yml | BASE tools, root governance policy and owner-public.pem, original validate.py and version/impact checks | Preserve as reference; not safe to activate until actual path/evidence map is installed and tested. |

Suggested current-view allowlist:

- governance/PRODUCT_SPEC.json -> docs/product/JARVIS_PRD_V5.md.
- governance/ROADMAP.json -> docs/missions/BUILD_PLAN.md; a root BUILD_ORDER.md can be navigation only.
- governance/STATE.json -> docs/agents/WORKING_STATE.md.
- governance/CONTROL_MATRIX.json -> docs/security/ENFORCEMENT_STATUS.md.
- PRODUCT_SPEC + ROADMAP -> governance/REQUIREMENT_TRACE.json.
- Exact per-file adoption map + current registries -> governance/ARTIFACT_REGISTRY.json, a current MANIFEST or documentation manifest, and a canonical DOC_INDEX with defined exclusions.

A generic recursive replace of `docs/` strings is unsafe. Update active reference fields, not historical identities, source URLs, originalOverlayPath, old wire IDs or source hashes. At minimum update:

- ROADMAP.missions[].path / requiredReading; CONTEXT_REGISTRY.alwaysFiles / topic requiredFiles / optionalFiles.
- INVARIANTS.rules[].owningDoc; SCHEMA_REGISTRY.contracts[].owningDoc / predecessor when archive location changes.
- AGENT_REGISTRY agent/skill paths when configs are preserved under docs/agents rather than auto-discovered.
- IMPLEMENTATION_MAP.owningDocs and patterns for relocated definitions; EVAL_CATALOG coveragePatterns for relocated missions/config examples if claiming a current map.
- CONTROL_MATRIX artifact doc paths; ARTIFACT_POLICY archive exemptions and index exclusions; explicit current consumer maps in ARTIFACT_REGISTRY.
- Runtime/prompt/schema docs and module paths only where a preserved source contains current path references. Preserve content hashes when bytes do not change; rehash and record adaptation when bytes do change.
- Current Markdown local links, inline code path references, startup/skill instructions and examples. Preserve original versions in the immutable source archive.

When unique originals stay in tools/jarvis-v5 but canonical writing is delegated, update its README to lead with the current boundary and the canonical renderer command. The original README tells users to run render/generate/index at root; leaving those instructions unqualified would reintroduce stale paths. A reference-only note without an actual refusal is weak protection against accidental overwrite.

If all canonical data and outputs instead use one bounded imported layout map, modifications to generate.py, common.py, index.py, validate.py and v5_checks.py are necessary. render.py can inherit generate's changes; context.py needs only relocated registry values; compile_prompts.py's generated output root is supplied by CLI. This fuller adaptation must preserve validation rules rather than broadly permitting missing metadata or disabling generated-drift checks. No change to signing, mission eligibility, trusted-time, isolated worker or policy logic is required merely to relocate documents.

## Skill/config preservation and extra design material

Eight existing coding configs collide and differ: repo-explorer, architecture-planner, docs-researcher, backend-implementer, frontend-implementer, integration-specialist, security-reviewer and test-evals. Nine V5 configs are unique: memory-architect, runtime-prompt-engineer, mobile-implementer, voice-engineer, browser-engineer, executor-engineer, governance-reviewer, agent-runtime-engineer and release-operator.

Six existing skill paths collide and differ: agent-evals, connector-integration, database-and-jobs, evolution-whatsapp, jarvis-product-rules and security-and-privacy. Sixteen V5 skills are unique: agent-runtime, android-device, browser-executor, deploy-vercel-convex-neon, executor-safety, first-party-apps, governance-enforcement, incident-and-restore, key-recovery, memory-and-context, operational-drills, progressive-context, repository-reconciliation, runtime-prompts, schema-evolution and voice-and-realtime.

Safest placement is `docs/agents/v5-reference/configs/` and `docs/agents/v5-reference/skills/`, with registry paths targeting those retained sources. Updating current root AGENTS and existing product/architecture skills to the canonical reading order is useful. Wholesale copying into `.codex/agents` or `.agents/skills` would activate instruction discovery and override working specialist behavior. Reference configs can be promoted later, one reviewed role at a time. They are coding specialists, distinct from runtime Council agents.

The 31 extra design files contain 14 skill documents: artifacts-builder, design-accessibility-review, design-design-critique, design-design-handoff, design-design-system, design-research-synthesis, design-user-research, design-ux-copy, emil-design-eng, frontend-design-plugin, frontend-design-public, theme-factory-wow, typeset and webapp-testing. Keep the entire tree under `docs/design/reference/claude-ui-ux-dev-skills/` with licenses, scripts, compressed component source, 10 themes and theme-showcase.pdf. Do not merge it into active skill discovery merely because its files are named SKILL.md.

Both frontend-design-plugin and frontend-design-public advertise the same skill name, frontend-design. The plugin edition requires an absent `/teach-impeccable` capability in some situations. webapp-testing refers to helper scripts not present in this tree and asks to run helpers before reading them. These are reference-origin instructions, not applicable execution authorization for this task. The artifact init script performs global npm installation, latest Vite scaffolding, many unpinned dependency installs and direct config writes. The bundling script installs Parcel packages and removes dist/bundle.html. Retain original bytes but do not execute them against the canonical app.

The component tarball was listed read-only with `tar -tf`, without extraction or execution. It contains components/ui, lib/utils.ts and hooks/use-toast.ts. Listing displayed ordinary relative paths, but no dependency compatibility, executable safety or complete link/type analysis is implied. It remains a reference payload and should not seed the working UI automatically.

## Concrete original defect and history traps

OWNER_DECISIONS.json's `v5-recovery-custody` proposal points to `templates/recovery-plan.proposed.json`, which does not exist. The actual file is `templates/recovery-plan.json`. Correct the adopted active reference and record that adaptation; preserve original broken reference in the immutable source archive. Do not create a duplicate proposal to hide the discrepancy.

SCHEMA_REGISTRY's six missing standalone runtime-schema paths are intentional references to the application; all six exist in the inspected candidate. SOURCE_ARCHIVE originalOverlayPath and VERSION_TRANSITION relocation-from/removal records intentionally refer to paths absent in the standalone pack. Treat them as history. In particular VERSION_TRANSITION lists removed old flat prompt paths such as prompts/runtime/core-system.md; the candidate still has working flat prompt material, and those files must not be deleted from an old pack cleanup list.

Existing accepted ADRs retain their original numeric/slug identities under docs/ADR. V3 proposed ADRs 0016–0024 remain archival evidence; V5 proposals v5-001 through v5-014 remain explicitly proposed until an actual accepted decision assigns a non-colliding repository identity. Do not reuse numerical 0016 or assume 0025 is unused.

## Canonical document owners

Suggested ownership after grouping:

| Current path | Responsibility |
| --- | --- |
| docs/agents/DOCUMENTATION_GOVERNANCE.md | Meaning/evidence/proposal separation, document source/derived views, adoption workflow; explain current owner authorization and future installed trust boundaries. |
| docs/agents/CONTEXT_PACKS.md | Bounded task context, required-file paths, byte budgets, source digests. |
| docs/agents/SESSION_CONTINUITY.md | Descriptive handoff, expected-hash updates, no claim of signed completion. |
| docs/agents/ARTIFACT_LIFECYCLE.md | Preservation, supersession, current consumer map, archive exemptions and explicit retirement. |
| docs/missions/MISSION_ADMISSION.md | Definitions, prerequisite receipts and future trusted runner installation. |
| docs/security/TRUST_BOOTSTRAP.md | Owner key/root and protected promotion installation specification. |
| docs/security/BUILDER_ISOLATION.md | Reasoning host/worker/verifier credential and execution boundaries. |
| docs/security/VERIFICATION_EVIDENCE.md | Signed purpose-scoped evidence and exact workflow/artifact corroboration. |
| docs/security/KEY_LIFECYCLE.md | Signing/recovery rotation and compromise ceremonies, not keys. |
| docs/security/AUTHENTICATION_BOUNDARY.md | Trusted principal identity, devices and step-up. |
| docs/security/APPROVAL_MODEL.md and POLICY_MATRIX.md | Server-normalized action approval and deterministic runtime permissions. |
| docs/security/CAPABILITY_AND_AUTHORITY.md | Finite scope, leases, revocation, high-impact limits. |
| docs/security/SECURITY.md, PRIVACY_TIERS.md, SUPPLY_CHAIN.md | Threats, source locality/egress and reviewed acquisition. |
| docs/security/DISASTER_RECOVERY.md, INCIDENT_RESPONSE.md, KILL_SWITCH_DRILLS.md | Restoration fencing, recovery evidence and independently observed stop behavior. |
| docs/architecture/SCHEMA_EVOLUTION.md | Draft lifecycle, real producers/consumers and migration acceptance. |
| docs/agents/PROMPT_ARCHITECTURE.md | Source registry, content fingerprint, complete-request budgets and preview/runtime distinction. |
| docs/archive/v5-source/ | Exact original source ZIP/index/report evidence. New canonical index must distinguish its provenance from current acceptance. |

These are ownership suggestions, not requirements to introduce every named directory. A single current overview and explicit owner links should resolve any overlap with retained R1 security, costs, cases and context documents. Keep unique user intent and operational source evidence from R1 when V5 is generic or silent.

## Completion criteria for documentation absorption

Documentation absorption can finish before runtime tool installation when all of the following are true:

1. Every actual 467 source file has an input SHA-256 and an explicit current destination, archive-only disposition or duplicate/supersession relation. ZIP member bytes are verified independently of the old 436-file index.
2. PRODUCT_SPEC requirements render completely to the one canonical V5 PRD. V2 and superseded conflicts have preserved originals and explicit current successors.
3. Current entry files lead to the same authority order and grouped document owners. No stale separate-V5 exclusion remains in current startup docs.
4. Active registry paths resolve to substantive current documents or deliberately retained reference artifacts. Historical path fields remain clearly historical.
5. Original generators cannot overwrite legacy navigation pointers at the integrated root. Current canonical renderer/index commands and exact output allowlist are documented.
6. Draft prompt/schema material is absent from active runtime consumers. Keys, signers, policy values and install state remain disabled/unknown unless genuinely installed outside this task.
7. Historical V5 tests and original reconciliation observations are labeled with date/checkpoint/scope. No old pack result is counted as Linux candidate validation.
8. Linux validation instructions cover the resulting application and any adapted doc tools, preserving existing source/tests/migrations and accepted ADR bodies. No provider/deployment/key action is inferred from absorption.

This establishes a canonical **documentation/source candidate**. Executable acceptance and release readiness still require the separately scoped Linux validation gate.
