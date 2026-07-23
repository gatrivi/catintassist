# Soundboard (v4.84.33)

## What it is
Pre-recorded greetings + clip legibility health (Deepgram) + **manual** route attestation + **passthrough injection** routing to patient path.

## Button chrome (v4.84.29)
See [`../development/button-sizing.md`](../development/button-sizing.md):
- **Green** = live to patient / playing · **Amber** = local preview / blocked · **Rose** = record/delete · **Gray** = setup/edit/filters (no gold studio brand)
- Clip row: Record → Preview → Call → Edit

## Routing (v4.75.0)

**Default: passthrough injection** — clip plays through the same VB-Cable element as live mic (see [`voicemod-comparison.md`](voicemod-comparison.md)).

| Mode | Key | When |
|------|-----|------|
| Passthrough (default) | `CATINT_ROUTE_MODE=passthrough` | Clip replaces mic stream on passthrough element |
| Dual element (legacy) | `CATINT_ROUTE_MODE=dual_element` | Separate sink `Audio` element — use for A/B only |

On-call **Greetings** strip (collapsible above transcript) fires 7 high-use slots when health + CALL OK pass.

## Off-call preflight (v4.84.33)

**Will callers hear it?** — 3 steps in Soundboard Studio (no more 🧪 Test toggle):

| Step | Button | Proves |
|------|--------|--------|
| 1 · Clip quality | **Check** | Deepgram legibility (PEACHES etc.) |
| 2 · You hear it | **🔊 Hear** | Your speakers — not patient path |
| 3 · Caller hears it | **📡 Send** → **CALL OK** | VB-Cable path (same as on-call) |

- **Tiles** = local preview until health + CALL OK → then arm patient path
- **Beep cable** = quick VB tone without a clip
- **More ▾** = mic monitor + route debug (advanced)

## Hear yourself (v4.84.27)

| Goal | Setting |
|------|---------|
| Patient hears greeting | 🔊 VB out = **CABLE Input** (not Speakers) |
| You hear via Windows Listen | Listen on **CABLE Output** → headphones, *and* VB out = CABLE Input |
| Preview without patient path | Step 2 **🔊 Hear** or tap any tile (before CALL OK) |

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
2. **Will callers hear it?** → Check → Hear → Send → CALL OK
3. Or Setup → record/upload per clip
4. Play tiles (armed to patient after CALL OK) or on-call strip

Header **Test local** / **Test route** = quick tone checks without a clip.

## Playback and safety
- **Passthrough inject**: same VB-Cable path as live mic (v4.75.0)
- **Mic mode (🎤)**: soundboard plays **local speakers only** — phone assistant + debug; see [`../onboarding/mic-mode-phone-assistant.md`](../onboarding/mic-mode-phone-assistant.md)
- **Anti-Scream Ramp**: ~50ms volume ramp
- **Mic Monitor** (More ▾): verify recording path before long takes

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
