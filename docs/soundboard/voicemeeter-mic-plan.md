# Voicemeeter Mic Routing Plan (2026-09-07) — PLAN ONLY

Goal: hardware-level mic path so (1) app crash ≠ client deaf, (2) greetings reach the client through a path that never touches the browser's mic handling.

## Why this fixes the soundboard problem

Today the browser forwards your mic and injects greetings into VB-CABLE (`AudioSettingsContext` passthrough). The client's "mic" is the browser — every crash, tab throttle, autoplay rejection, or stream swap lands on the patient. With Voicemeeter, **Voicemeeter becomes the mic**, and the browser just plays a clip into it like any speaker — same semantics as Voicemod ("just works" per `voicemod-comparison.md`).

## Target signal flow (Voicemeeter Standard)

```
Physical mic ──► Voicemeeter Strip[0] ──► B1 ──► "Voicemeeter Output" = CALL APP's mic
App greetings ─► "Voicemeeter Input" (VAIO, Strip[2]) ──► B1 ──► same
Call audio ────► CABLE Input ──► CABLE Output ──► app STT + your Windows Listen (UNCHANGED)
```

- Strip[0] = your physical mic → **B1 on** (client always hears you, Voicemeeter keeps running even if browser dies)
- Strip[2] (Voicemeeter VAIO virtual input) → **B1 on** (app plays greetings to playback device "Voicemeeter Input")
- Call app mic device = **"Voicemeeter Output (VB-Audio Voicemeeter VAIO)"**
- A1 = your headphones (optional self-monitor)
- CABLE path for call audio: untouched

App-side afterwards (separate, later change): greetings sink = "Voicemeeter Input" instead of CABLE Input; mic passthrough no longer needed on this route (keep as fallback).

## Staged rollout (each step reversible)

1. **Inspect (no changes):** run `scripts/setup-voicemeeter-mic.ps1` without `-Apply` — prints current strips/buses. Verify Voicemeeter Standard is running.
2. **Apply mic routing:** run with `-Apply` (auto-backs up settings XML to %TEMP%, prints restore path). Extend script: Strip[2].B1 = 1.
3. **Off-call verify:** Windows Voice Recorder on "Voicemeeter Output" — speak + fire an app greeting; both must appear in the recording. Call app (test call / echo service) mic = Voicemeeter Output.
4. **Live call test:** one real call using Voicemeeter Output as mic. Confirm client hears you + greeting; then kill the app mid-call — client must still hear you.
5. **Keep old VB-CABLE route as fallback** until 2–3 clean call days. Revert = restore backup XML or flip call-app mic back to CABLE.

## Risks / cautions

- Voicemeeter adds ~5–10ms mic latency — irrelevant for interpreting.
- Windows "default device" changes: keep headphones as A1 so you always hear the call.
- The existing script hardcodes mic name `Microphone (HS-220U)` — confirm your actual mic name in inspect step before `-Apply`.
- Do this **off-call / between shifts**, never mid-call.

## 48 kHz quality checklist (2026-09-11, verified in code)

The app plays at 48 kHz end-to-end — no code change needed:

- Playback: persistent `AudioContext({ sampleRate: 48000 })` per sink (`src/utils/audioRouteDirect.js:39`, v4.104.0 direct-sink engine); clips decode onto it and render into "Voicemeeter Input" via `setSinkId`.
- Recording: webm/opus 128 kbps, raw mic, browser DSP off (`src/components/GreetingsPanel.js:612-630`).
- Gain: clips peak-normalize to −1 dBFS then gain ×1 default → keep sink/local volume sliders ≤ 100% or clips hard-clip at the device.
- Cacophony diagnosis (2026-09-11): was Voicemeeter gain > 0 closing a feedback loop — faders reset to 0 dB fixed it.

If audio still sounds garbled/robotic, it's the virtual device formats, not the app:

1. mmsys.cpl → *Voicemeeter Input*, *Voicemeeter Aux Input*, *CABLE Input* → Properties → Advanced → **24-bit, 48000 Hz** each (44.1k device = Windows resampler = the classic Voicemeeter garble).
2. Voicemeeter Menu → System Settings → main sample rate **48000 Hz**.
3. Test recorder (e.g. Edge voice-recorder tab): pin the site mic explicitly to *Voicemeeter Output*, not "Default" (fixes intermittent "no registered sound"); monitor playback on headphones, never back into a VB device (loop).

## What I can do vs you

- I can: run inspect + `-Apply` via the script, extend the script, verify with recordings.
- You must: make the test/real call and confirm what the client hears (I can't hear the patient side).
