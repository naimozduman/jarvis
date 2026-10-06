# JARVIS Home

Responsibility: the Android launcher experience and the boundary between JARVIS and the underlying phone. This document specifies behavior, not a new visual design.

**Product requirement / architecture decision:** JARVIS Home is the default Android HOME launcher. The Ratio-inspired page concept comes from S2-M0007, 2026-09-09 17:45:56; rejection of system-losing Guided Access and shortcut bounce follows in M0011/M0013. Stock Android and retained OEM surfaces are reinforced by S2-M0025 and M0035. [R019–R022, R027]

## Three-page concept

| Page               | Main responsibility                            | Typical contents                                                                                                                |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Left: intelligence | What matters now and why                       | Briefing, upcoming commitments, active Cases, useful widgets, contextual suggestions, device/integration health when actionable |
| Center: Home       | Fast, reliable entry to the phone              | App launching, owner-selected organization, search/command entry, access to JARVIS chat and voice                               |
| Right: messages    | Unified conversations under JARVIS's interface | Chats, unread state, search, drafts, handoff state and conversation actions backed by the messaging adapter                     |

This is a confirmed organizational concept. Exact typography, gestures, card layouts, animations, widgets and app grouping remain design work. Ratio is an inspiration, not a dependency or instruction to clone all of its behavior. The owner dislikes the iOS App Library experience; do not recreate a forced detour to reach apps.

The right page should let the owner perform supported routine messaging without opening each network app. Unsupported calls, media or network-specific features can open the appropriate native app with an honest explanation. That fallback does not change the intended unified experience or justify claiming unavailable API support. [MESSAGING_AND_HANDOFF.md](MESSAGING_AND_HANDOFF.md) owns transport details.

## Surface ownership

| JARVIS owns or integrates                                    | Android / Samsung / Google retains                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Home pages, app discovery/launch and contextual organization | System navigation/recents behavior supplied by the platform                                  |
| Personal search, JARVIS chat, Cases and intelligent widgets  | Wallet, secure payments, banking apps and their security checks                              |
| Unified message presentation and permitted reply actions     | Network apps and capabilities the adapter cannot support                                     |
| JARVIS voice experience and optional assistant role          | Telephony, emergency calling and system audio/device behavior                                |
| Attention recommendations and supported notification actions | Notification shade, permission controls and system notifications                             |
| Context collection under explicit access                     | Secure lock screen, biometric/credential authentication and app sandboxes                    |
| Optional later device-policy integration                     | Settings, Quick Panel, camera pipeline, Bluetooth, Wi-Fi, cellular, OTA and security updates |

The latest Samsung discussion accepts One UI/Good Lock lock-screen and Quick Panel functionality as useful existing infrastructure. Rebuilding them is not immediate scope. Becoming HOME does not grant system privileges or guarantee OEM gesture/recents integration; test the chosen device. Android defines separate HOME and ASSISTANT roles with user-mediated role requests. **Confirmed Android capability.** [RoleManager documentation](https://developer.android.com/reference/android/app/role/RoleManager)

## Primary interactions

**Return Home:** the system Home action enters JARVIS Home directly. It must not open a shortcut, flash the OEM launcher and then bounce into a web page. Default-role setup should explain how to restore the OEM launcher if needed.

**Find and launch:** applications remain reachable without a cloud request, model inference or a successful backend login. Handle app install/uninstall, disabled apps, work-profile availability and missing deep links. Restricted package visibility and profile behavior require implementation testing; do not assume every app is always discoverable through one query.

**Search:** one entry point can route to apps, exact personal records, people, messages, files, Cases or a question. Deterministic matches should appear immediately from available local data. Show which results require cloud retrieval, the latest sync time and whether search covers only the cached subset. Ambiguous intent should not silently become an external action.

**Contextual Home:** surface a departure recommendation, an approaching commitment or a useful follow-up when evidence warrants it. Prefer stable organization; context should not constantly rearrange the owner's muscle memory. Explain why an item appears and provide dismiss/correct/pin controls. A dismissal does not automatically cancel the underlying Case.

**Messaging:** show which account/network a conversation belongs to, whether data is current, whether the owner or JARVIS is composing, and whether Handoff is active. Owner takeover must be immediately available. Internal authorship records remain exact even if outward disclosure policy is unresolved.

**Voice:** provide explicit listening, thinking, working, approval-needed and unavailable states, with cancel/interrupt controls. The user liked Siri-inspired feedback in S8-M0005; polished motion is later UX work and must not hide real failures behind animation.

## Offline and failure behavior

Home is a local phone function. Backend downtime, exhausted API budget, a missing local model or a disconnected Beeper host must not stop app launching or normal Android use. Cached personal results and chats show freshness. Drafts and safe pending commands can be saved; external delivery remains pending until verified.

If JARVIS crashes, preserve a path to the OEM launcher and normal settings. If a permission is denied, keep the relevant page functional with reduced capabilities and a specific explanation. Avoid full-screen error walls on Home for a single failed integration. Urgent JARVIS interactions follow [VOICE_AND_DEVICE_CONTROL.md](VOICE_AND_DEVICE_CONTROL.md), not launcher overlays that impersonate a system phone call.

## Build and acceptance order

Start with correct HOME registration, reliable app launch, local search and a useful personal-core entry point. Add left-page intelligence and right-page messaging as their services become dependable. Test Home gesture/back navigation, reboot, app changes, lock/unlock, power saving, offline operation, large text and screen-reader accessibility on stock Samsung. Confirm Wallet, banks, camera, calls and settings remain usable. Measure actual battery and responsiveness before adding continuous visual or contextual effects.

No final UI redesign was authorized in this reconstruction. [ROADMAP.md](ROADMAP.md) places visual refinement after useful end-to-end behavior.
