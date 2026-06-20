# Soundboard (v4.58.0)

## What it is
Pre-recorded greetings + an audio "legibility health" gate so patient playback stays safe.

## AUDIO HEALTH (AI audit)
On upload/record, the audio is sent to Deepgram:
- If Deepgram confidently transcribes it → status **PEACHES**
- If it fails → status **UNACCEPTABLE**

UX:
- Each greeting button shows a micro-health bar (RED to GREEN)
- Health bars are visible in both **Settings** and **Play Mode**

## Playback & safety
- **Anti-Scream Ramp**: ramps volume over ~50ms (no instant 100% hit)
- **Test Mode**: blocks playback to the Virtual Mic / Caller so you can verify locally
- **Mic Monitor**: verify physical recording path before committing

## Navigation (v4.58.0)
Soundboard Studio is a full-pane workspace (off-call only).
- **← Scoreboard** in studio header, play view, and setup view
- **Escape** returns to scoreboard (when editor modal is closed)
- Dock pyramid still cycles workspaces
- Setup **Save & Play** returns to play mode only — not scoreboard

## Roadmap checklist (safety first)
- `VIRTUAL_MIC_ROUTE` — reliable audio to patient path (**PARTIAL**)

How to verify
1. Off-call → open Soundboard Studio
2. Setup → record/upload → wait for health bar
3. Preview locally with Test mode on
4. Header **Test route** for quick sink check without a live call

## Known issues
- Patient-side playback routing still unreliable — use local/test mode for QA
- Crackles may appear under high STT load

## FAQ
- If you hear the peep beep: silence reminder for disconnect-after-call (billing safety).
