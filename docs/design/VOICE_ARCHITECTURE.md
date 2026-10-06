---
title: "Realtime Voice as a Core Surface"
document_id: "docs::VOICE_ARCHITECTURE"
status: "active"
authority_class: "protected"
owner_role: "voice_engineer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Voice is transport, not a second assistant

Use an authenticated speech session attached to canonical Core conversation/job IDs. Local wake/VAD and privacy filtering precede optional STT. Realtime transport, STT/LLM/TTS or speech-to-speech implementation are replaceable adapters, not permission sources. LiveKit, Gemini Live and other options remain candidates with verified provider probes before adoption.

## Lifecycle

Record speech input and model text separately from generated audio, audio sent and playback acknowledged. A client playback acknowledgement approximates heard content; it does not prove human comprehension. Source transcript corrections update provenance without rewriting executed actions.

Barge-in stops playback first, then requests model cancellation and prevents new action proposals. For each action consult the server dispatch state. Undispatched work may cancel. Dispatched work moves to cancel_requested or reconciliation_required until external evidence resolves it. See EXECUTOR_ARCHITECTURE.

## Timing and reliability

Measure endpointing, transcription, first useful token, first audio, tool latency, interruption response and reconnect behavior on real devices. Do not import demo latency claims as service-level objectives. Long-running tools continue as durable jobs, with bounded status updates instead of blocking the speech loop. Reconnect uses canonical session IDs and operation keys.

## Privacy and cost

Redact secrets before cloud TTS. Honor source locality before sending audio/frames. Sample camera/screens only for a declared purpose, with visible capture and short retention. COST_AND_MODEL_POLICY governs cumulative STT, realtime, inference and TTS spend. Voice fallback never drops approval or privacy guarantees. Wake phrase does not authenticate an owner for high-impact approval.
