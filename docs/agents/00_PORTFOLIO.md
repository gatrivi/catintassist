# Redirect (v4.48.2)
This doc moved to `docs/archive/portfolio.md`.

<details><summary>Legacy (kept for reference)</summary>

# CatIntAssist — Portfolio & Interview Map

**Version:** v4.44.0 · **Stack:** React, Deepgram STT, DeepL/Google translate, Web Audio  
**Pitch:** Real-time medical-style EN↔ES interpreter cockpit — transcribe, translate, speak, track shift goals.

---

## Interview weight (what hiring managers actually care about)

| Weight | Area | Why |
|--------|------|-----|
| **35%** | Live transcript + translation loop | Core product. "I built a real-time bilingual call assistant." |
| **25%** | TTS → patient audio path | Closes the loop. Without it, demo feels half-finished. |
| **20%** | On-call reliability | Zombie reconnect, bubble splits, no lost timer/transcript. Production mindset. |
| **10%** | Scoreboard / shift metrics | Differentiator; shows you understand the *user's job*, not just APIs. |
| **10%** | Soundboard studio | Nice story (Voicemod problem); smaller audience than translation. |

---

## Recommended focus order (portfolio)

1. **Local TTS** (Piper / Kokoro / Coqui via localhost API) → replace browser `speechSynthesis` + dead Inworld path  
2. **TTS + soundboard → virtual mic** (same audio routing; one fix, two features)  
3. **Translation reliability** (no "bueno" on splits; cache; comma chunking — v4.43 started this)  
4. **60-second demo script** (connect → spell email → translate → TTS → pin number)  
5. Scoreboard polish, soundboard hotkeys — only after demo path is bulletproof  

**Your instinct on local TTS is right** — not because it's the hardest, but because it's the highest *demo ROI*: no API billing, works offline in interviews, proves ML integration. It's not more important than STT+translate exist, but it's the best *next* milestone.

---

## Feature status (one line each)

### Main view (on call) — `02_MAINVIEW.MD`
| Feature | Status |
|---------|--------|
| Dual-column EN/ES bubbles + color coding | DONE |
| Deepgram live STT (EN+ES sockets) | DONE |
| Incremental translate (DeepL → Google fallback) | PARTIAL — quota/garble issues |
| Bubble play TTS | BROKEN-ish — browser fallback only |
| Pin messages, hover pin, copy numbers | DONE |
| Spelling formatter (`as in` / `como en`) | DONE v4.43 |
| Comma-split 40+ word bubbles | DONE v4.43 |
| Call mode: 80% transcript width | DONE |
| Zombie re-attach after refresh | DONE v4.35 |

### Scoreboard (off call) — `01_SCOREBOARD.MD`
| Feature | Status |
|---------|--------|
| 12-metric grid + game flip | DONE |
| Off-call fills `<main>` (not header strip) | DONE v4.42–v4.44 |
| Live rolling income, progress ladders | DONE |
| Break budget, late login, logout estimate | DONE |

### Soundboard — `SOUNDBOARD_CHECKLIST.md`
| Feature | Status |
|---------|--------|
| Record, waveform, health gate, test mode | DONE |
| Play to patient on live call | **BROKEN** |
| Off-call studio only | DONE |

### Soundscape — `04_SOUNDSCAPE.MD`
| Feature | Status |
|---------|--------|
| Connect chime, coin stack, idle coins | NOT_STARTED / PARTIAL |

### Workspace
| Feature | Status |
|---------|--------|
| Off-call: scoreboard ↔ soundboard switch | DONE |
| First-visit studio hint | DONE |

---

## Demo script (target for interviews)

1. Off-call → scoreboard visible (shift progress)  
2. Connect → live tab audio  
3. Speak EN → ES appears + **local TTS plays to virtual sink**  
4. Spell email → formatted lines (`D · delta`)  
5. Pin a number → survives scroll  
6. *(Optional)* Off-call soundboard → preview + call test  

**Blockers today:** steps 3–4 TTS path; soundboard step 6 patient audio.

---

## Architecture (for deep-dive questions)

```
Mic/tab → Deepgram WS → captions (useDeepgram)
       → useTranslate → DeepL/Google
       → useTTS → [MISSING: local server] → setSinkId → virtual mic
       → TranscriptionBoard UI

Off-call: DashboardHeader (controls) + main (scoreboard | soundboard)
On-call:  compact header + TranscriptionBoard
State:    SessionContext (timers, stats, pins)
```

---

## Doc index (read these, not the whole repo)

| File | Contents |
|------|----------|
| `00_PORTFOLIO.md` | This file — priorities + status |
| `01_SCOREBOARD.MD` | Metrics, goals, layout rules |
| `02_MAINVIEW.MD` | Transcript / translation UX |
| `03_SOUNDBOARD.MD` | Greetings lab + health audit |
| `04_SOUNDSCAPE.MD` | Chimes / coin sounds |
| `05_TTS_SPINOFF.md` | Local TTS side project + merge contract |
| `SOUNDBOARD_CHECKLIST.md` | Enum checklist for soundboard passes |
| `/agents.md` | Living backlog (user instructions) |

---

## Honest portfolio gap

**Shipped:** Impressive breadth — STT, translate, scoreboard, soundboard safety, spelling UX.  
**Missing for flagship:** One **reliable** spoken output path and a **2-minute recorded demo**.  
Local TTS + virtual mic routing = turns a dev project into a product story.

</details>
