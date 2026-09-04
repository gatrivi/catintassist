# Session status — 2026-09-03 (branch `hotfix/tab-stt-v4.85.1`, latest v4.86.8)

## Shipped this session (all pushed, tests green)
- **v4.86.0–4** scoreboard UX: de-dupe strip, Metrics toggle fixes, 12-grid fit (cells 42px, cap 38vh/260px), low-hanging fruit (dead toggle hidden, summary dedupe). Notes: `docs/development/scoreboard-ux-notes.md`
- **v4.86.1** local dev translate gateway: `npm run gateway` (port 59210) + `src/setupProxy.js`
- **v4.86.3–5** timers: `📞Xm 📡Ym` chips (strip summary + next to Connect); Connect button 2× wide; **draggable grab bar** under expanded scoreboard (persisted `catint_scoreboard_max_vh`)
- **v4.86.6** center of sticky row shows timers instead of "Disconnected" (error/zombie states keep status text); localhost seed `src/utils/devStatsSeed.js` — Sep 3 = 15 calls / 172m, apply-once, date-locked
- **v4.86.7** speech auto-start default ON (`catint_speech_auto_v1`, toggle in Settings); auto-stop verified (SilenceGuardian: 3 prompts + 7min → stop+break; trailing silence >30s deducted)
- **v4.86.8** pins persist across calls/days — removed auto-wipes at start/end/endDay in `SessionContext.js`

## ⚠️ OPEN: pins unpinned DURING calls (user's live complaint)
Ruled out so far:
- `migratePinnedCaptions` (`src/utils/pinnedCaptions.js`) — never removes pins, only remaps ids. Not the dropper.
- Session start/end/endDay wipes — removed in v4.86.8.

Remaining suspects (next agent: check these first):
1. **`catint_pinned_cleared` event fired mid-call** — only remaining dispatcher is the HIPAA grace path (`SessionContext.js` ~line 265–275, `requestHipaaDisconnectGrace`). Check whether zombie/re-attach or callEndGuard triggers `clearCaptions` + dispatch *during* an active session.
2. **Pin identity churn** (`pinnedCaptions.js`) — a live bubble that re-seals with different text mid-call can make a pinned row match TWO captions (over-broad `pinMatchesCaption` `pinLive`+includes rule); a later `migrate` may remap the pin onto the wrong bubble → looks unpinned.
3. **`TranscriptionBoard.js` is Muse Spark's WIP** (uncommitted changes in working tree — audio route/TTS/greetings files too). Re-read before editing; do not commit Muse's files.

## Parallel work in flight (do not touch / do not commit)
- Muse Spark: soundboard + audio routing (`AudioRouteStatusBar.js`, `audioRoutePassthrough.js` — 2 failing tests: expected `passthrough`, got `dual_element`), `useTranslate.js`, `GreetingsPanel.js`, `TranscriptionBoard.js`, `api/main.py`
- CatTS local translate bridge: `http://127.0.0.1:59200/stt/translate`, live + verified EN↔ES; restart notes `CATINTASSIST_TRANSLATION.md`

## Resumable backlog
- Progress-bar/stack audit (~40% unaudited: monthly/daily timelines, heatmap, pace ETA, off-call painting in timeline, req/day readout)
- Scoreboard audit remaining: expanded income cards, emoji rows, goal wheel, idle tips, presets E2E, soundboard workspace header (`docs/development/scoreboard-ux-notes.md`)
- Toolbar gate consolidation (deferred, plan in notes doc)
- Seed block `devStatsSeed.js` needs tomorrow's call history when user provides it
- 20/80 is now a *guideline* (`docs/scoreboard/README.md`); transcription must always stay visible
