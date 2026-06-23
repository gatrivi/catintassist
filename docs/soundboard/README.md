# Soundboard (v4.71.0)

## What it is
Pre-recorded greetings + clip legibility health (Deepgram) + **manual** route attestation before patient-path playback.

## AUDIO HEALTH (clip QA only)
On upload/record, audio is sent to Deepgram. Score tiers:

| Score | Label |
|-------|--------|
| untested | UNTESTED |
| >= 0.9 | PEACHES |
| >= 0.75 | GOOD |
| >= 0.5 | PASSING |
| < 0.5 | UNACCEPTABLE |

Health proves **source clip legibility**, not that the patient path works.

## Route verification (v4.71.0)
Patient-path unlock requires **manual CALL OK** — not auto-proof when the browser finishes playing.

| Badge | Meaning |
|-------|---------|
| SINK PLAYED | Browser played clip into selected virtual sink; awaiting your confirm |
| CALL OK ✓ | You attested remote side heard it cleanly |

Proof is stored per fingerprint: **clipKey + sinkId + micDeviceId**. Changing VB-Cable or mic invalidates prior proofs.

Flow:
1. Off-call → Soundboard Studio
2. Setup → record/upload → health bar
3. Preview locally (▶) with 🧪 Test Mode if needed
4. 📡 Call Test → routes to virtual sink only
5. Confirm: *Did remote side hear it cleanly?* → **Yes, mark CALL OK**
6. Play mode (Test Mode off) → virtual mic only if health + manual CALL OK pass

Header **Test local** / **Test route** = quick tone checks without a clip.

## Playback and safety
- **Anti-Scream Ramp**: ~50ms volume ramp
- **Test Mode**: blocks virtual mic; local speakers only
- **Mic Monitor**: verify recording path before long takes
- **Route debug** strip: sink, mic, test mode, passthrough mute state, last route test

## Navigation
Soundboard Studio is off-call only.
- **← Scoreboard** in studio header
- **Escape** returns to scoreboard (when editor modal closed)

## Roadmap
- `VIRTUAL_MIC_ROUTE` — reliable audio to patient path (**PARTIAL**)
- Voicemod prerecorded greetings remain safe fallback until routing is proven

## Known issues
- Patient-side routing still unreliable under some STT load
- `CALL OK` is human attestation, not automated remote verification

## FAQ
- Peep beep after call: silence reminder for disconnect-after-call (billing safety).
