# ADR 0021: Conservative owner casual-chat reasoning

Accepted by the owner on 2026-10-01 following the frozen casual-chat comparison.

The standard route remains `openai/gpt-6-luna`, medium. Only an enrolled owner on a trusted direct Telegram or WhatsApp surface with a whole-turn match in the deterministic casual allowlist may request low reasoning. Action, planning, reminder, tool, research, policy, high-consequence and uncertain or referential turns are outside that allowlist. Conflicting, inferred, stale or pending context conservatively retains medium. Unknown classifications retain medium.

This is a trusted request option, not a new model or authority path. The same effective reasoning configuration constructs both the admitted request and the generated request, preserving the request hash. Model runs retain the actual reasoning level and canonical request usage receipt. Schema, context, budgets, accounting, deterministic validators, policy, action execution and conversational truth are unchanged.

Content-free routing records contain the canonical request ID, selected route category, reasoning level, reason category, phase and latency. Telemetry failures cannot fail a turn. Idempotent replay returns before routing or generation. The private frozen synthetic benchmark disables production classification so compared candidates receive the same fixture and explicit test configuration; it has no delivery authority.

Rollback: disable `casualChatRoutingEnabled` in canonical composition; no migration or configuration budget change is required. Alternate model evaluation is separate and does not promote any candidate to production.
