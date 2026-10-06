# Constitution engine

Constitution items are protected, explicitly versioned owner values. The Phase 2 `ConstitutionService` supports draft creation, review, owner activation, replacement version, deactivation, review scheduling, active listing, and decision-relevant lookup.

A model has only one constitutional capability: it may emit a `constitution_candidate`. That candidate is persisted as a draft proposal and requires owner review. There is no model code path to activate, weaken, replace, deactivate, or otherwise mutate an active constitutional value.

Repeated misses are behavioral observations. They may drive a recovery plan, a shorter minimum action, a replan, or an intervention. They never lower an active goal. A goal of five training sessions therefore remains intact after five misses.

Owner hard overrides are separate auditable records. They outrank preferences and hypotheses, but not security policy, legal constraints, permissions, or system safety. JARVIS explains a material consequence once and then stops relitigating the same valid override unless circumstances change.
