# TTS Spin-off Project Brief

**Why separate:** Local TTS (Piper/Kokoro/Coqui) is R&D-heavy. Keep CatIntAssist context lean; merge when audio path works.

**Parent app:** CatIntAssist `useTTS.js` + `AudioSettingsContext` (`setSinkId`, `localVolume`, `sinkVolume`)

---

## Contract (what spin-off must prove)

```
POST /tts  { text, lang: "en"|"es" }  →  audio/wav or audio/mpeg
```

Optional: `GET /health` → `{ ok: true, model: "piper-..." }`

**Success criteria:**
1. Latency &lt; 2s for ~20 words on your machine  
2. EN + ES voices acceptable for medical-style demo  
3. Same audio plays to **local speakers** AND **selected sink** (virtual mic)  
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

---

## Already have OmniVoice Studio? Use it.

**Repo:** `github.com/debpalash/OmniVoice-Studio` (desktop + FastAPI backend)

**Find it (WSL):**
```bash
find ~ /mnt/c/Users -maxdepth 5 -type d -iname 'OmniVoice-Studio' 2>/dev/null
ls ~/OmniVoice-Studio ~/projects/OmniVoice-Studio 2>/dev/null
```

**Find it (Windows PowerShell):**
```powershell
Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "OmniVoice-Studio" -ErrorAction SilentlyContinue | Select -First 3 FullName
```

**Run:**
```bash
cd OmniVoice-Studio
bun install
bun run desktop-prod    # or: bun run dev
```
API usually on **`:8000`** when app is running. TTS: `POST /generate` (multipart: `text`, `language`, optional ref audio).

**CatIntAssist wire:** point `useTTS.js` at `http://127.0.0.1:8000/generate` → blob → existing `setSinkId` play path. No new TTS project needed if OmniVoice works.

**Also has MCP server** — usable from Cursor when `bun dev` is running.

---

## Fallback stack (if OmniVoice lost / too heavy)

| Option | Pros |
|--------|------|
| **Piper** + tiny FastAPI | Lightweight |
| **OmniVoice Studio** | Already cloned — use this first |

---

## Spin-off repo checklist

- [ ] `docker compose up` or `python server.py`  
- [ ] curl test EN + ES  
- [ ] HTML test page: play to default + pick output device  
- [ ] README with 30s demo video/GIF  
- [ ] Document RAM + first-request latency  

---

## Do NOT rebuild in spin-off

- Deepgram STT  
- Translation  
- Scoreboard  
- Soundboard UI  

Only: **text → audio bytes → browser playback → virtual sink**

---

## After merge

1. Wire `useTTS.js` to local server  
2. Reuse same sink routing for soundboard (`GreetingsPanel`)  
3. Record 60s flagship demo (see `00_PORTFOLIO.md`)  

**Parent doc index:** `00_PORTFOLIO.md`
