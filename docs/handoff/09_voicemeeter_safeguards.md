# Executor spec: Voicemeeter microphone safeguards

Planning only, 2026-09-07. Implement this task, then return the diff and test
results for review. Do not push/deploy before that review. No subagents needed.

## Outcome

Add an explicit **Mic handled by Voicemeeter** option. When enabled, the app
does not forward the physical microphone and sends greetings only to the
explicitly selected standard Voicemeeter Input. Patient audio/STT continues
through the original CABLE Output. No changes to Windows or mixer settings.

## Ground truth and boundaries

- Read `00_global_rules.md` and run `git status --short` first. Current version
  is 4.86.8; reserve 4.86.9 unless another release already took it.
- Existing dirty work includes AudioSettingsContext, AudioRouteStatusBar,
  GreetingsPanel, audioRoutePassthrough, audioSelfTest and translation files.
  Preserve those edits; compare your work against the starting working tree,
  not just HEAD. Do not stage other agents' changes.
- Primary edits: `src/contexts/AudioSettingsContext.js`,
  `src/components/AudioRouteStatusBar.js`, `src/utils/audioRoutePassthrough.js`.
  Add a small pure routing-policy utility and tests if it keeps decisions clear.
  Add context/component tests. Release metadata and second-mic-cable docs are
  allowed. Do not change translation, STT acquisition, scoreboard or layout.
- Voicemeeter was configured with HS-220U on B1; virtual input strip B1 is
  still disabled. Thus app tests cannot establish caller-ready greetings.

## Exact behavior

1. Persist boolean `CATINTASSIST_EXTERNAL_MIC_ROUTING` (`true`/`false`);
   missing/invalid means false. Add one labeled checkbox beside existing
   off-call audio setup controls, never in transcript bubbles. It remains
   operable without detected devices. Do not enable it automatically.
2. Enabled: stop only app-owned forwarding tracks/clip playback, detach and
   pause the forwarding element. Do not acquire a physical mic for forwarding
   or its automatic meter. Keep the physical mic selection for recording and
   explicit monitoring. Label the route **Mic: Voicemeeter (unverified)**;
   never imply signal health from a selected device.
3. Guard EVERY mic restoration path: Restore Mic, clip success/failure/stop,
   visibility/pagehide watchdog, delayed getUserMedia completion and cleanup.
   None may reattach/play a mic while external mode is on. Stop late-acquired
   tracks. Use a current mode/generation guard to prevent stale async work
   after mode or sink changes. External Restore Mic stops clips and reports
   `ok: false, reason: 'external_mic_managed'`; UI says **Check Voicemeeter**.
4. External mode outgoing sink: only an explicitly selected audiooutput whose
   label is standard `Voicemeeter Input` (optional parenthesized vendor suffix).
   Reject AUX, VAIO3, numbered In endpoints, default aliases, CABLE and hardware
   speakers for this profile. These endpoints do not share the configured bus.
   Do not change STT label matching or broaden the supported mixer topology.
5. Keep stored requested sink ID separate from the effective usable sink ID.
   In external mode expose effective `selectedSinkId = ''` to existing consumers
   until enumeration validates the requested sink. Retain the requested ID for
   reattachment and picker display. Never auto-select a replacement in external
   mode. Missing/blank-label/wrong sink shows **Choose Voicemeeter Input** in the
   existing setup hint; caller playback stays blocked. Device return revalidates.
   Leave legacy auto-selection behavior unchanged outside this explicit mode.
6. Check the current effective sink at playClipToSink entry AND after decoding;
   cancel pending playback on mode/sink changes. No stale operation may route
   a clip to a previously selected cable. Existing direct clip consumers already
   use selectedSinkId: verify they receive the effective value, not requested ID.
7. In playBufferViaPassthrough, missing sink/setSinkId, rejected binding or
   rejected play must reject the session promise and clean up. Do not start the
   buffer source or fall back to default speakers. Check cancellation after each
   await; stop-before-bind-completes must never resume playback. Preserve existing
   cleanup/mic restore behavior where permitted by the current forwarding mode.
8. External mode clip completion restores no mic; Voicemeeter owns it. Do not
   promise mic ducking during greetings: the external mic remains live.
   Update only misleading hints in the touched setup component.

## Required verification

Use mocked Audio/getUserMedia/devices and deferred promises, not real audio.

- Default false and persisted true; toggling external on stops app tracks.
- External mode makes no forwarding getUserMedia call; recording/explicit
  monitor behavior remains available.
- Every restoration path above cannot revive mic forwarding in external mode.
- Late mic acquisition is stopped; mode/sink changes cancel pending clips.
- With original CABLE first in enumeration, explicit Voicemeeter Input survives
  refresh; invalid/missing/blank-label device gives no effective sink and no
  automatic fallback. Returning device restores eligibility.
- No buffer starts after failed binding/play or cancellation during binding.
- Legacy valid mic+sink forwarding and normal clip cleanup still work.
- Run focused tests first, then `npm test` and `npm run build` once. Report
  unrelated failures without repairing unrelated files or calling the app ready.
- Check compact UI at 900x600 if running a dev server; follow browser skills.

## Handoff and release

Bump version constant/package/lock consistently and add a short release note.
Update second-mic-cable.md with the new checkbox and exact device selection.
Return changed files, focused/full check results, and unresolved issues.
Do not claim installation or remote audio validation: user still must enable
B1 on Voicemeeter's virtual input, select Out B1 in the call platform, and
verify voice → greeting → voice plus absence of patient echo off-call.

Reviewer should inspect the task delta and tests first; avoid re-auditing the
whole repo. Translation cooldown is a separate future task.
