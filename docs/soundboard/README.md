# Soundboard (v4.75.0)

## What it is
Pre-recorded greetings + clip legibility health (Deepgram) + **manual** route attestation + **passthrough injection** routing to patient path.

## Routing (v4.75.0)

**Default: passthrough injection** — clip plays through the same VB-Cable element as live mic (see [`voicemod-comparison.md`](voicemod-comparison.md)).

| Mode | Key | When |
|------|-----|------|
| Passthrough (default) | `CATINT_ROUTE_MODE=passthrough` | Clip replaces mic stream on passthrough element |
| Dual element (legacy) | `CATINT_ROUTE_MODE=dual_element` | Separate sink `Audio` element — use for A/B only |

On-call **Greetings** strip (collapsible above transcript) fires 7 high-use slots when health + CALL OK pass.

## Hear yourself (v4.84.27)

| Goal | Setting |
|------|---------|
| Patient hears greeting | 🔊 VB out = **CABLE Input** (not Speakers) |
| You hear via Windows Listen | Listen on **CABLE Output** → headphones, *and* VB out = CABLE Input |
| Preview without patient path | 🧪 Test Mode + raise **🔊 You (Local)** |

Wrong classic: STT in = CABLE Output ✓, VB out = Speakers ✗ → Listen stays silent.

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
6. Play mode or on-call strip → virtual mic only if health + manual CALL OK pass

Header **Test local** / **Test route** = quick tone checks without a clip.

## Playback and safety
- **Passthrough inject**: same VB-Cable path as live mic (v4.75.0)
- **Mic mode (🎤)**: soundboard plays **local speakers only** — phone assistant + debug; see [`../onboarding/mic-mode-phone-assistant.md`](../onboarding/mic-mode-phone-assistant.md)
- **Anti-Scream Ramp**: ~50ms volume ramp
- **Test Mode**: blocks virtual mic; local speakers only
- **Mic Monitor**: verify recording path before long takes
- **Route debug** strip: mode, STT active, sink, mic, passthrough state, route event log

## Navigation
- **Studio**: off-call only — pyramid / Soundboard button
- **On-call strip**: `▾ Greetings` above transcript during active call
- **← Scoreboard** / **Escape** exits studio

## Diagnostics
- `window.__CAT_STT_ACTIVE` — Deepgram connected
- `window.__CAT_ROUTE_DIAG` — last 40 route events
- Route debug panel in Play mode

## Known issues
- Verify passthrough routing on your call stack before retiring Voicemod
- `CALL OK` is human attestation, not automated remote verification

## FAQ
- Peep beep after call: silence reminder for disconnect-after-call (billing safety).
