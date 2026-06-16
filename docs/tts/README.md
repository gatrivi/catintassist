# TTS (v4.48.2)

## Why the spin-off exists
Local TTS (Piper/Kokoro/Coqui) is R&D-heavy, so the app keeps its main STT/translate/UX context lean.

## Contract (what spin-off must prove)
`POST /tts { text, lang: "en"|"es" } → audio bytes (wav/mp3)`

Optional:
- `GET /health → { ok: true, model: "piper-..." }`

Success criteria:
1. Latency < 2s for ~20 words (on your machine)
2. EN + ES voices acceptable for medical-style demo
3. Same audio plays to:
   - local speakers, and
   - selected sink (virtual mic)
4. No cloud API key required

## Integration back into CatIntAssist
Replace `prefetchTTS` in `src/hooks/useTTS.js` with a fetch to the local TTS server,
then keep existing dual-`<audio>` + `setSinkId` play path in `playTTS`.

Env:
- `REACT_APP_TTS_URL=http://127.0.0.1:59125` (example)


