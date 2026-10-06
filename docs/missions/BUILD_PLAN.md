---
title: "V5 adapted build plan"
document_id: "v5-generated-build-plan"
status: "active"
authority_class: "protected"
owner_role: "architecture_planner"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Implementation roadmap

This adapted plan is maintained by reviewed edits alongside governance/ROADMAP.json. The current documentation manager renders the PRD and byte index only. The original pack-generated plan remains recoverable in the exact V5 source archive.

Source: `governance/ROADMAP.json`. Mission identifiers are stable. Filenames and former phase numbers do not authorize work.

| Mission | Work | Prerequisites | Entry |
| --- | --- | --- | --- |
| J5-M00 | Preserve and inventory the actual repository | None | [J5-M00](J5-M00.md) |
| J5-M01 | Install trusted governance and rehearse recovery | J5-M00 | [J5-M01](J5-M01.md) |
| J5-M02 | Decide each existing subsystem disposition | J5-M01 | [J5-M02](J5-M02.md) |
| J5-M03 | Reconcile the existing Brain and prompt runtime | J5-M02 | [J5-M03](J5-M03.md) |
| J5-M04 | Reconcile infrastructure and durable execution | J5-M02 | [J5-M04](J5-M04.md) |
| J5-M05 | Prove model admission and one bounded live probe | J5-M03, J5-M04 | [J5-M05](J5-M05.md) |
| J5-M06 | Build recovery and incident readiness for private data | J5-M04 | [J5-M06](J5-M06.md) |
| J5-M07 | Deliver Surface Zero and trusted owner identity | J5-M05, J5-M06 | [J5-M07](J5-M07.md) |
| J5-M08 | Connect the dedicated WhatsApp transport | J5-M07 | [J5-M08](J5-M08.md) |
| J5-M09 | Tune daily usefulness, modes and accountability | J5-M07 | [J5-M09](J5-M09.md) |
| J5-M10 | Complete the owner control center | J5-M07 | [J5-M10](J5-M10.md) |
| J5-M11 | Add read-first Gmail and Calendar integration | J5-M10 | [J5-M11](J5-M11.md) |
| J5-M12 | Build Life Ledger, Journal and idea continuity | J5-M10, J5-M06 | [J5-M12](J5-M12.md) |
| J5-M13 | Adopt Personal OS contracts and procedural memory | J5-M12, J5-M03 | [J5-M13](J5-M13.md) |
| J5-M14 | Connect existing domain apps one at a time | J5-M13 | [J5-M14](J5-M14.md) |
| J5-M15 | Build Android companion and controlled device context | J5-M13, J5-M07 | [J5-M15](J5-M15.md) |
| J5-M16 | Build measured realtime voice | J5-M15, J5-M03 | [J5-M16](J5-M16.md) |
| J5-M17 | Implement owner-enrolled device self-control | J5-M15, J5-M09 | [J5-M17](J5-M17.md) |
| J5-M18 | Implement the first external executor safely | J5-M13, J5-M07, J5-M06 | [J5-M18](J5-M18.md) |
| J5-M19 | Introduce bounded worker delegation | J5-M18, J5-M09 | [J5-M19](J5-M19.md) |
| J5-M20 | Enroll finite Night Mode | J5-M19, J5-M16 | [J5-M20](J5-M20.md) |
| J5-M21 | Build the browser and research surface | J5-M13, J5-M07 | [J5-M21](J5-M21.md) |
| J5-M22 | Harden supply chain and recurring operations | J5-M06, J5-M02 | [J5-M22](J5-M22.md) |
| J5-M23 | Promote a bounded usable release | J5-M07, J5-M22 | [J5-M23](J5-M23.md) |

M00 reads a sanitized snapshot. M01 prepares and installs trust. Neither claims installation merely by existing. Every implementation admission requires authentic prerequisites. A completed mission is recertified, not blindly rerun, when its definition or trust epoch changes.

M09 defines the proposed 30-day evidence window for unattended expansion. Control-center and read-only feature work need not wait for that window. M18 gates external writers. Android is not a prerequisite for a web/API executor. Browser organization work does not imply browser write authority.

The full old-to-new mission mapping is `governance/MISSION_TRANSITION.json`. No V4 completion automatically becomes V5 evidence.
