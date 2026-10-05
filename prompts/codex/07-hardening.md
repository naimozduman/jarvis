# Later phase: Production hardening and release candidate

Historical build prompt from the original staged build kit. Before using any step, read `CODEX_START_HERE.md`, follow `docs/JARVIS/CODEX_START_HERE.md`, and consult `CANONICAL_DOCUMENTATION_MAP.md`. The instructions below describe their original phase and are not current startup or release authorization. Preserve current source, accepted ADRs and later product decisions.

Use `$security-and-privacy`, `$deploy-railway-vercel`, `$agent-evals`, and the `security_reviewer`
agent when those skills and infrastructure are available.

Complete threat modeling, authentication/session hardening, OAuth scope review, encryption and key
rotation procedures, webhook replay tests, prompt-injection regressions, backup/restore drills,
queue recovery, provider outage behavior, production monitoring, retention/deletion workflows, and
the release checklist. Promote only after critical and high-severity findings are resolved.
