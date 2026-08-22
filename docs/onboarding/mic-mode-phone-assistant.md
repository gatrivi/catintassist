# Mic mode — phone interpreting assistant (v4.80.15)

Use CatIntAssist on a **phone or tablet** (or Cursor preview) when you cannot share a browser tab. Mic mode routes **STT from your mic** and plays **soundboard + TTS on local speakers** — nothing through VB-Cable.

## Toggle
- I/O strip **🎤** (with 🔖 tab · 🎧 VB) — purple highlight = mic ON
- Hotkey **M** still toggles mic
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
1. Turn **🎤** ON → CONNECT (allow mic). **v4.84.34:** green button fires mic prompt on the same tap (no 280ms delay).
2. Speak — transcript appears.
3. Tap a **Greetings** clip or translation **🔊** — audio plays on **your** speaker, not VB-Cable.
4. Soundboard Studio: **Test Mode** checkbox is forced ON (same behavior).

## Verified (2026-08-21, production catintassist.gatrivi.com)

Chromium end-to-end: mic permission → stream attach → **both EN+ES `nova-3-general` sockets open** →
~17 PCM frames/sec upstream → Deepgram `Results` (VAD `is_final`/`speech_final`) streaming back →
caption UI live. Same key+params+audio replayed to Deepgram transcribes cleanly
("…appointment tomorrow at 09:15. Take 2 tablets every 8 with food." — smart_format working).
Audio-disconnect banner + **Re-attach** (timer/transcript preserved) verified under forced failure.
Mobile pitfalls already covered: stale-deviceId fallback (`inputSource.js`), same-tap getUserMedia
(v4.84.34), HTTPS secure-context check.

Watch item: stop → CONNECT within the HIPAA grace window did not always re-dial sockets in the
desktop harness (fresh page load always worked). If a phone user reports "connect does nothing
after a call", have them reload first, then investigate the reconnect race.

## Limits
- Mic mode does **not** send greetings/TTS to the remote party — production calls on desktop still need tab mode + VB-Cable + CALL OK.
- Browser `SpeechSynthesis` TTS fallback is always local (no sink).

## See also
- [`quickstart.md`](quickstart.md) — Step “On a phone”
- [`../soundboard/README.md`](../soundboard/README.md) — routing + health gates
- [`../tts/README.md`](../tts/README.md) — TTS contract
