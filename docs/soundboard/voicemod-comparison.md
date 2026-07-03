# Voicemod vs Browser Soundboard Routing (v4.75.0)

## TLDR

| | Voicemod | CatIntAssist (v4.75.0) |
|---|----------|------------------------|
| **Injection point** | OS virtual mic driver | Browser `HTMLAudioElement` → VB-Cable |
| **Path during clip** | Replaces mic at driver level | **Passthrough inject** (default) — clip stream replaces mic on same passthrough element |
| **STT load** | Independent of browser WebSocket | Shared browser audio thread — was suspect for crackle |
| **Local monitor** | You hear Voicemod output | Dual path: local element + passthrough |
| **Health check** | You hear it = patient hears it | Deepgram legibility + manual CALL OK |
| **Fallback** | N/A | Dual-element `setSinkId` if passthrough fails |

## Why Voicemod “just works”

Voicemod sits **below** the browser. When you fire a prerecorded greeting:

1. Voicemod stops forwarding your physical mic
2. Plays the WAV into the **same** virtual device the call app already uses
3. No second `Audio` element, no `setSinkId` race with a live mic stream

The call app sees one continuous virtual mic input.

## What CatIntAssist did before v4.75.0

```
Mic ──► passthrough Audio (setSinkId) ──► VB-Cable ──► call app
Clip ──► separate sink Audio (setSinkId) ──► VB-Cable ──► call app  ← second element
```

Problems:

- Two elements fighting for the same virtual sink
- Passthrough muted but still bound — timing/gain issues under STT CPU load
- Local preview used a **different** decode path than patient path → “sounds fine to me”

## v4.75.0 passthrough injection (default)

```
Mic ──► passthrough Audio ──► VB-Cable
         ▲
         └── during clip: srcObject = MediaStreamDestination(clip)
             mic stream saved and restored on end
```

Same element, same `setSinkId`, same path as live speech — closer to Voicemod semantics.

**Route mode** stored in `localStorage` key `CATINT_ROUTE_MODE`:

- `passthrough` (default) — injection via `playClipToSink` in `AudioSettingsContext`
- `dual_element` — legacy second `Audio` element (for A/B testing)

## Diagnostics (repro under STT)

- `window.__CAT_STT_ACTIVE` — true when Deepgram socket connected
- `window.__CAT_ROUTE_DIAG` — ring buffer of route events
- Soundboard Studio → Play → **Route debug** — shows mode, STT flag, last 6 events
- `assessSttLoadRisk()` warns if dual-element used while STT active

### Repro checklist

1. Off-call: record clip → health PASSING+ → Call Test → CALL OK
2. Start call + STT (Connect)
3. Fire greeting from **on-call strip** or Studio Play
4. Compare patient audio vs Voicemod same phrase on same VB-Cable
5. If passthrough fails, check Route debug for `fallback_dual` or `play_fail`

## When to still use Voicemod

- Passthrough injection still garbles on your machine
- Call app rejects browser-routed audio
- You need soundboard during non-Chrome browser

## Files

- [`audioRoutePassthrough.js`](../src/utils/audioRoutePassthrough.js)
- [`routeDiagnostics.js`](../src/utils/routeDiagnostics.js)
- [`AudioSettingsContext.js`](../src/contexts/AudioSettingsContext.js) — `playClipToSink`
- [`OnCallSoundboardStrip.js`](../src/components/OnCallSoundboardStrip.js)
