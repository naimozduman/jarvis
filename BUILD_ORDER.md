# Build order

Historical build-kit document, retained during the October 5, 2026 reconciliation. Its original requirements, phase sequence and commands are dated implementation/history evidence. Start at `CODEX_START_HERE.md` and follow `docs/JARVIS/CODEX_START_HERE.md`; this document cannot override the current reading order or authorize an old migration, recovery, provider connection or deployment.

- [x] Phase 0: Repository bootstrap and safety foundation.
- [x] Phase 1: Core data, events, durable jobs, ownership/authentication boundary, policy, approvals, and audit.
- [x] Phase 2: Brain, constitution handling, memory retrieval, context assembly, reasoning, behavioral engine, replanning, and provider-free invariant evaluation. See `docs/progress/phase-2.md` and `docs/BRAIN_EVALS.md`.
- [ ] Phase 3: WhatsApp and Evolution API provider-free vertical slice is implemented and
      verified, but Phase 3 is not closed: production Evolution build verification, immutable
      digest evidence, deployment, and real pairing remain explicitly pending. Do not begin
      Phase 4. See `docs/progress/phase-3.md` and `docs/EVOLUTION_VERSION_GATE.md`.
- [ ] Phase 4: Web control center.
- [ ] Phase 5: Gmail and Google Calendar.
- [ ] Phase 6: Health, finance, training, nutrition, and additional connector interfaces.
- [ ] Later: Native iOS, Apple Health, location, Hermes, external communication, and release hardening.

Do not begin the next phase until the current phase has a written smoke result, updated docs, passing focused tests, and no unresolved critical security finding.
