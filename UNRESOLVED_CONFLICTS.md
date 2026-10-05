# Unresolved conflicts — 2026-10-05

**Unresolved source-selection conflicts: none.** Every materially divergent main/R1 path has a
disposition and provenance in `RECONCILIATION_MATRIX.md`. The candidate has no merge markers or
unmerged index entries. No test file or accepted ADR was silently removed.

The two ADR 0016 histories coexist under their full original slugs. R1's current documentation
authority, main's personal-system integration and accepted C7 safeguards have been reconciled.
Monthly-bills, V5, Jarvis Zero and external legacy/recovery packs remain separate by explicit
scope decision.

These unresolved verification and product questions must not be mistaken for resolved behavior:

- Executable typecheck, lint, format, build, tests, dependency installation and runtime checks
  were deferred because the required isolated Windows environment was unavailable.
- Manually reconstructed Drizzle snapshots and the additive Telegram ID-default migration need
  disposable PostgreSQL/catalog and generator verification. Existing implicit FK names can
  produce a future generator naming proposal that must be reviewed in its own diff.
- The hosted reliability test retains its historical explicit endpoint and must not be run
  against remote infrastructure as part of provider-free local validation. Prepare a separately
  reviewed local equivalent for that coverage.
- Prior deployment/test counts remain reported historical evidence. Current production state,
  live message/read proof, owner-approved baseline population and long-term daily-use quality
  were not examined in this phase.
- Current product-level open questions remain in `docs/JARVIS/OPEN_QUESTIONS.md`; no new product
  authority, payment capability, controller autonomy or V5 governance was inferred.

The complete execution gates are in `DEFERRED_VALIDATION.md`. These limits permit a clean
reviewable reconciliation candidate; they do not permit claiming a validated deployment.
