# Mic mode — phone interpreting assistant (v4.80.15)

Use CatIntAssist on a **phone or tablet** (or Cursor preview) when you cannot share a browser tab. Mic mode routes **STT from your mic** and plays **soundboard + TTS on local speakers** — nothing through VB-Cable.

## Toggle
- Header **🎤** (right cluster) — orange = mic mode ON
- Persists: `localStorage` key `catint_mic_test_mode_v1`

## Audio paths

| Path | Tab mode (desktop) | Mic mode (phone / debug) |
|------|-------------------|--------------------------|
| STT input | Shared tab audio | Device microphone |
| Soundboard greetings | VB-Cable → patient (after health + CALL OK) | **Speakers / headphones only** |
| TTS (bubble 🔊, notes) | Local + VB-Cable dual path | **Speakers / headphones only** |
| VB-Cable test tone | Enabled | Disabled (no virtual route) |

## Why local playback in mic mode
1. **Phone assistant** — hear greetings and translations yourself; hold phone near ear like a pocket interpreter.
2. **Debug 100× faster** — you hear exactly what the clip/TTS sounds like without a second machine or patient on the line.
3. **No false “CALL OK”** — mic mode skips virtual-mic routing and health gates on the on-call greetings strip.

## Code
| Piece | File |
|-------|------|
| Mic flag read/write | `src/utils/micMode.js` |
| Local-only guard | `isLocalOnlyPlayback()` in `src/utils/audioSelfTest.js` |
| Soundboard Studio | `GreetingsPanel.js` |
| On-call greetings strip | `OnCallSoundboardStrip.js` |
| TTS | `useTTS.js` |
| I/O strip labels | `AudioRouteStatusBar.js` |

Route log: `window.__CAT_ROUTE_DIAG` shows `routeMode: local_speakers` when mic mode plays.

## Quick test (phone)
1. Turn **🎤** ON → CONNECT (allow mic).
2. Speak — transcript appears.
3. Tap a **Greetings** clip or translation **🔊** — audio plays on **your** speaker, not VB-Cable.
4. Soundboard Studio: **Test Mode** checkbox is forced ON (same behavior).

## Limits
- Mic mode does **not** send greetings/TTS to the remote party — production calls on desktop still need tab mode + VB-Cable + CALL OK.
- Browser `SpeechSynthesis` TTS fallback is always local (no sink).

## See also
- [`quickstart.md`](quickstart.md) — Step “On a phone”
- [`../soundboard/README.md`](../soundboard/README.md) — routing + health gates
- [`../tts/README.md`](../tts/README.md) — TTS contract
