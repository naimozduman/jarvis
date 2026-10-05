# Archive of old directions

Responsibility: retain rejected/superseded exploration and useful lessons without making it active scope. Source chronology is in [DECISIONS.md](DECISIONS.md). Reopening an item requires a specific current requirement, new evidence and an explicit decision; discussion length is not authority.

## Platform and interface exploration

| Direction                                                             | Historical reason                                                                                | Current status and lesson                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iPhone/SpringBoard/JarvisBoard-style replacement                      | Desired a phone centered on JARVIS while still using an iPhone                                   | Archived by the stock Android HOME direction. Useful lesson: a real default surface matters; a web app or visual replica is not equivalent                         |
| Jailbreak paths for the discussed iOS/devices                         | Investigated deeper control when normal iOS could not deliver the launcher/automation experience | Archived research, not a current installation plan. Old jailbreak availability/security claims were not validated here                                             |
| Permanent Guided Access kiosk                                         | Proposed to keep a JARVIS app front and center                                                   | Explicitly rejected in S2-M0011 because loss of normal system/app/Wallet behavior defeats daily use                                                                |
| Shortcuts bounce / stock Home flash                                   | Proposed approximation of a custom launcher                                                      | Explicitly rejected in S2-M0013. Do not polish the animation instead of using Android's real HOME mechanism                                                        |
| Rebuilding an iPhone kernel                                           | User asked whether extreme engineering could remove platform limits                              | Exploratory question, not a commitment; assistant discouraged the route. Latest Android direction excludes it. Do not claim a viable kernel plan was established   |
| GrapheneOS/custom ROM/root/custom Android kernel as first step        | Explored for deeper integration, privacy and OS control                                          | Archived as default platform. Retain only as conditional future research after an important stock limitation is demonstrated                                       |
| Pixel as mandatory JARVIS hardware                                    | Earlier recommendations emphasized bootloader/custom-system flexibility                          | Superseded by stock-first and latest S26 Ultra preference. A particular carrier Pixel's bootloader must be checked if that future need arises                      |
| Custom phone hardware / owner-only pixels / private directional audio | Assistant brainstormed novel hardware capabilities in S2-M0002                                   | Unapproved and outside scope; user explicitly rejected building a phone in M0003. Retain the principle of solving the underlying problem, not the hardware project |

## Hardware and commercial assumptions

Earlier S3–S7 discussions compared iPhone/Pixel/Samsung, foldables, OnePlus/ROG and temporary used phones. S4 narrowed to a low-cost S22 plus cloud prototype after $350/$500 budget questions. These were context-sensitive recommendations, not proof of a purchase. S2-M0051 later favors a daily S26 Ultra with useful local AI and more RAM if affordable.

Do not restore the old temporary-phone ceiling as the current hardware requirement or treat battery capacity, assistant benchmark tables, financing estimates or carrier promotions as verified facts. Retain daily battery, thermals, coverage, affordability and normal phone reliability. T-Mobile preference is latest; exact SKU/account eligibility is a purchase-time check. “Carrier unlocked” and “bootloader unlockable” are different concepts.

## Architecture and implementation assumptions

| Older assumption                                                                           | Disposition                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp dedicated assistant number via Evolution defines the whole product                | Historical starter adapter. Current unified personal messaging is Beeper beneath JARVIS UI; dedicated assistant transport may remain only if useful and explicitly chosen |
| Railway persistent worker is required                                                      | Superseded after explicit no-upgrade decision S1-M0044; later willingness to pay does not resurrect Railway as a requirement                                              |
| pg-boss must be the sole active physical scheduler                                         | Older worker mode. Reported serverless baseline uses Neon canonical jobs and Convex references; preserve durable job invariants, not a duplicate worker topology          |
| Neon/Vercel/Convex must remain forever because they were hard to build                     | Not a product constraint. VM consolidation is favored for evaluation; no migration selected or performed by this reconstruction                                           |
| Every operation must remain free forever                                                   | Superseded by S1-M0183's explicit willingness to pay later and S2's budgeted AI direction. Free-for-now history remains relevant to earlier decisions                     |
| $3/$4/$5 trial-credit gates, frozen free-model catalogs or a $50 example are active limits | Historical implementation/planning values. Current hard governor requirement survives; owner numeric budgets are unset                                                    |
| One cloud model or provider-specific chat history is JARVIS's brain                        | Superseded by multi-provider routing, local tasks and canonical personal memory                                                                                           |
| One orchestrator means no independent Council agents                                       | Earlier implementation scope. JARVIS remains chairman/authority coordinator while approved Council adds genuinely separate bounded seats                                  |
| Ephemeral-only location and source-provider-only personal history                          | Superseded by explicit years-long location and personal-index requirements. Raw-noise retention remains bounded                                                           |
| Always ask before every calendar write or harmless read                                    | Assistant caution is weaker than explicit user standing-rule/calendar automation and non-annoying Guardian requirements                                                   |
| Never send any email under any future circumstances                                        | Early explicit product boundary, later expanded for scoped operational correspondence. MVP remains read/draft until grants; no blanket send authority                     |
| Unlock/open another app repeatedly to keep its context fresh                               | Workaround under investigation, not canonical architecture. Prefer resolving the data/sync cause                                                                          |
| Infrastructure health or a green ordinary test suite proves the product works              | Rejected inference. Historical cloud failures and unrun final matrix demonstrate separate readiness/usefulness checks                                                     |

## Rejected and unapproved ideas

The owner explicitly rejected transferring money to a friend as punishment in S1-M0187, including rejecting it within the same message that explored it. Do not reintroduce it through a payment broker or accountability feature. Deliberate user override and supportive challenge remain the product direction.

Predictive scenario simulation and autonomously building missing systems were assistant-origin suggestions without specific approval of autonomous production deployment. Keep them as experiments in [ROADMAP.md](ROADMAP.md), not hidden active requirements. Exact Council roster, model/vendor choices, low-level confidence percentages and every brainstormed feature list are not approved merely because the assistant repeated them.

The assistant's unqualified refusal of relationship Handoff and its original-characters-only preference are not user rejections. The latest user-approved bounded Handoff and broader Council inspiration remain active with their genuine policy/technical questions. Archiving obsolete directions must not erase later user approvals.

## Operational history kept out of the product specification

Retire the fragile Windows migration-helper route discussed in S1. Later reports moved migration execution to a rehearsed Linux workflow with separated runtime/migration credentials. Old recovery instructions, temporary secret names, QR pairing screens and token troubleshooting are historical evidence, not commands for future sessions to execute blindly.

Unrelated WaziWave/charity references, generic model chatter and a lone ISBN do not establish JARVIS features. Older linked PRDs, ZIPs, screenshots and repository files were not supplied as independently readable attachments here; assistant claims about their contents are secondary evidence. Preserve relevant lessons from reported work in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) without fabricating an inspected codebase.
