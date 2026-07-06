# CatIntAssist Roadmap (v4.60+)








**North star:** 80%+ viewport = transcription + translation. Stable on **900×600**. Everything else serves the live interpret loop.

Agent task specs: [`handoff/README.md`](handoff/README.md) · Daily use: [`onboarding/advice.md`](onboarding/advice.md)

---

## Phase table

| Phase | Focus | Ship when | Defer |
|-------|--------|-----------|-------|
| **0 — Solid core** | STT/translate sweep, zombie re-attach, no UI thrash | **Now** | Scoreboard drag-grid, DB, soundboard prod |
| **1 — Daily UX** | Metric presets, 🎯 goal wheel, mic meter strip, default bg, Settings → Display visibility | After Phase 0 green | Interpreter STT, full grid rearrange |
| **1.5 — Persistence lite** | Bundled default bg, export/import soundboard+bg JSON | Anytime (by hand OK) | Full auth |
| **2 — Platform** | Supabase auth + stats/corrections sync | When multi-device needed | Server-side API keys |
| **2 — Soundboard prod** | Fix `VIRTUAL_MIC_ROUTE`, block UNACCEPTABLE greetings | After routing proven | New greeting features |
| **3 — Interpreter lane** | PTT or VAD-gated mic STT (optional column) | If token budget approved | Always-on interpreter socket |

---

## Phase 0 — STT / translate stability (blocking)

Prod verification checklist:

- [ ] Long utterance → bubble split → **both** segments translated (no "bueno" wipe on first part)
- [ ] Refresh mid-call → yellow zombie re-attach; timer + translations preserved
- [ ] 9–10 digit phone sequences survive overlap prune ([`01_number_protection.md`](handoff/01_number_protection.md))
- [ ] Weak translation beats empty (`AGENTS.md`)
- [ ] No status UI thrash on connect ([`.cursor/RULES/ui-thrash.md`](../.cursor/RULES/ui-thrash.md))
- [ ] EN/ES column tie-break sane ([`transcription-pane/README.md`](transcription-pane/README.md))

**Code:** [`useTranslate.js`](../src/hooks/useTranslate.js) · [`useDeepgram.js`](../src/hooks/useDeepgram.js) · [`sensitiveDataProtector.js`](../src/utils/sensitiveDataProtector.js)

---

## Phase 1 — Daily UX (v4.60.0)

| Item | Status | Spec |
|------|--------|------|
| Scoreboard presets (minimal / standard / full) | **Shipped v4.60.0** | [`handoff/03_scoreboard.md`](handoff/03_scoreboard.md) |
| 🎯 goal wheel always in toolbar | **Shipped v4.60.0** | [`onboarding/advice.md`](onboarding/advice.md) |
| Mic meter in I/O strip (OK / MUTED / NO SIGNAL / CLIP) | **Shipped v4.60.0** | [`AudioRouteStatusBar.js`](../src/components/AudioRouteStatusBar.js) |
| Default bundled background | **Shipped v4.60.0** | `public/bg/default.svg` |
| ElementHint tooltips (copy selector) | **Shipped v4.75.5** | [`development/element-hint.md`](development/element-hint.md) |
| Copy chips + digit stitch | **Shipped v4.75.6** | [`transcription-pane/README.md`](transcription-pane/README.md) |
| Transcript corrections (teach STT + glossary) | **Shipped v4.76.0** | [`transcription-pane/corrections.md`](transcription-pane/corrections.md) |

**Presets (900×600):**
- **Minimal:** bounty, mins today, break left, connect
- **Standard:** condensed game view (default)
- **Full:** 12-cell numeric grid + progress bars

Keys: `catint_scoreboard_preset_v1` · `catint_visible_metrics_v1` · `catintassist_visible_cards`

---

## Phase 1.5 — Background lite

- Bundled `public/bg/default.svg` when IndexedDB has no `bg_app`
- User upload still wins via Show tools → soundboard bg
- Optional: seed IndexedDB on first run; export/import JSON (manual OK)

---

## Phase 2 — Auth + DB (later)

Follow [`handoff/06_auth_db.md`](handoff/06_auth_db.md):

1. Auth shell (login/logout)
2. Sync `catintassist_stats` → `user_daily_stats`
3. Sync `catint_corrections_v1` → `corrections`
4. Medical glossary → `medical_terms`
5. Keep Deepgram/DeepL keys **client-side encrypted** unless explicitly approved

**Stack:** Supabase (SQL + RLS) preferred; Firebase if realtime > SQL.

**Do not implement** until approved — localStorage/IndexedDB stays source of truth.

---

## Phase 2 — Soundboard production (v4.75.0)

From [`soundboard/README.md`](soundboard/README.md) + [`voicemod-comparison.md`](soundboard/voicemod-comparison.md):

- **Passthrough injection** (default) — clip via same element as live mic
- **On-call Greetings strip** — quick-fire when health + CALL OK pass
- **Route diagnostics** — `__CAT_ROUTE_DIAG`, STT-active flag, Route debug panel
- **Dual-element** — legacy fallback (`CATINT_ROUTE_MODE=dual_element`)
- **Still verify** on your call stack before retiring Voicemod

---

## Phase 3 — Interpreter mic STT (optional)

Full-time third Deepgram socket ≈ **doubles+ API cost** vs tab-only.

If needed later, prefer:
1. **Push-to-talk** interpreter note (hold key → short burst STT)
2. **VAD-gated** bursts (RMS > threshold ~300ms)
3. **Local Whisper tiny** (offline, CPU cost)

Enables interpreter lane, compliance log, replay — **not required for solid v1**.

Visual mic bars (Phase 1) use AnalyserNode only — **zero STT tokens**.

---

## Answers a–f (TLDR)

| # | Topic | Direction |
|---|--------|-----------|
| a | Low-res scoreboard | Presets + hide toggles — not drag-grid yet |
| b | Goal wheel | Persistent 🎯 in toolbar + portal modal |
| c | DB + bg | Default bg bundled; DB when multi-device needed |
| d | STT stability | Phase 0 checklist above |
| e | Soundboard on calls | **On-call strip** — passthrough route; verify vs Voicemod |
| f | Interpreter mic | Visual meter now; transcribe Phase 3 only |

---

## Do not do yet

- Soundboard greetings on calls — **passthrough route v4.75.0**; verify patient audio before retiring Voicemod
- Always-on interpreter mic Deepgram socket
- Full scoreboard drag-and-drop rearrange (until presets work at 900×600)
- Moving API keys server-side without explicit approval
- DB migration before Phase 0 green

---

## Future inbox

From [`archive/future.md`](archive/future.md) + AGENTS soundscape:

- [x] Click bad translation → user correction → local glossary (**v4.76.0** — DB sync Phase 2)
- [ ] Connect sound: purse opening
- [ ] Every minute: coin earn sound (richer each minute)
- [ ] Call end: coin stack crash into purse
- [ ] Soundboard: health bar per greeting; Deepgram legibility audit in studio
- [ ] Medical terms glossary ([`handoff/02_medical_terms.md`](handoff/02_medical_terms.md))
- [ ] Transcript corrections: Deepgram bias + partial glossary (UI shipped v4.76.0)

---

*Edit this file by hand. Version anchor: v4.76.0*
