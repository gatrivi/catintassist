# Soundboard (v4.48.2)

## What it is
Pre-recorded greetings + an audio “legibility health” gate so patient playback stays safe.

## AUDIO HEALTH (AI audit)
On upload/record, the audio is sent to Deepgram:
- If Deepgram confidently transcribes it → status **PEACHES**
- If it fails → status **UNACCEPTABLE**

UX:
- Each greeting button shows a micro-health bar (RED ⛔ to GREEN 🍑)
- Health bars are visible in both **Settings** and **Play Mode**

## Playback & safety
- **Anti-Scream Ramp**: ramps volume over ~50ms (no instant 100% hit)
- **Test Mode (🧪)**: blocks playback to the Virtual Mic / Caller so you can verify locally
- **Mic Monitor (“Hear Myself” 👂)**: verify physical recording path before committing

## Roadmap checklist (safety first)
Soundboard uses a status enum: `NOT_STARTED` · `PARTIAL` · `DONE` · `BROKEN`.

Pass A — Safety & verification (current focus)
- `HEALTH_BAR` — Deepgram legibility score per clip (**DONE**)
- `TEST_MODE` — local-only playback toggle (**DONE**)
- `ANTI_SCREAM_RAMP` — ~50ms volume ramp (**DONE**)

Pass C — Core patient-audio bug (last big step)
- `VIRTUAL_MIC_ROUTE` — reliable audio to patient path (**PARTIAL**)

How to verify (v4.39-style)
1. Off-call → open Soundboard Studio
2. Setup → record/upload → waveform appears under clip name
3. Wait for health bar
4. Preview: should play locally with expected tint/progress
5. Call Test: should route through the intended patient path

## Known issue
- “Crackles” may be related to browser buffer overhead under high STT load.

## FAQ (quick)
- If you hear the “peep” beep: it’s the silence reminder for disconnect-after-call (billing safety).

