# Legacy: TTS Spin-off Project Brief

**Why separate:** Local TTS (Piper/Kokoro/Coqui) is R&D-heavy. Keep CatIntAssist context lean; merge when audio path works.

**Parent app:** CatIntAssist `useTTS.js` + `AudioSettingsContext` (`setSinkId`, `localVolume`, `sinkVolume`)

---
## Contract (what spin-off must prove)
```
POST /tts  { text, lang: "en"|"es" }  →  audio/wav or audio/mpeg
```

Optional: `GET /health` → `{ ok: true, model: "piper-..." }`

**Success criteria:**
1. Latency < 2s for ~20 words on your machine
2. EN + ES voices acceptable for medical-style demo
3. Same audio plays to local speakers AND selected sink (virtual mic)
4. No cloud API key required

---
## Integration back into CatIntAssist (one file mostly)
Replace `prefetchTTS` in `src/hooks/useTTS.js`:
```js
const res = await fetch('http://127.0.0.1:59125/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, lang }),
});
const blob = await res.blob();
return URL.createObjectURL(blob);
```

Keep existing dual-`<audio>` + `setSinkId` play path in `playTTS`.

Env: `REACT_APP_TTS_URL=http://127.0.0.1:59125`

