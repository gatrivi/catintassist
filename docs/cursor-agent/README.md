# Cursor Agent Rules (v4.56.0)

Read this file first. Stays small on purpose.

**Handoff specs:** [`docs/handoff/README.md`](../handoff/README.md) — pick one task, read global rules once.

## Scope by task (touch only these files)
| Task | Touch only |
|------|------------|
| Soundboard play/setup | `src/components/GreetingsPanel.js`, `src/index.css` (`.sb-*` blocks) |
| Soundboard storage | `src/utils/storage.js` |
| STT / transcript | `src/hooks/useDeepgram.js`, `src/components/TranscriptionBoard.js` |
| TTS | `src/hooks/useTTS.js` — or separate TTS repo per `docs/tts/` |
| Scoreboard | `src/components/GameScoreboard.js`, `src/components/DashboardHeader.js` (scoreboard/progress only) |
| Number protection | `src/utils/sensitiveDataProtector.js`, tests, `TranscriptionBoard.js` (display only) |
| Medical terms | `src/utils/medicalTermLexicon.js`, tests; Phase 2: `useDeepgram.js` |
| Transcript corrections | `src/utils/transcriptCorrections.js`, tests; Phase 2: `TranscriptionBoard.js` |
| UI cleanup | `src/index.css`, header/scoreboard chrome — see `docs/handoff/05_ui_cleanup.md` |
| Auth / DB | **read** `docs/handoff/06_auth_db.md` — out of scope until approved |

Do **not** re-read the whole repo for a one-file fix.

## Work pane stability (v4.55+)
- No inline diagnostic panels in bubbles
- No show/hide blocks that change row height in interpret pane
- See `docs/handoff/00_global_rules.md`

## Soundboard safety backlog (priority order)
1. `VIRTUAL_MIC_ROUTE` — verify with a voice note through the intended virtual mic path
2. Done: `CALL_PATH_AUTO_VERIFY`, passthrough mute during sink playback (`v4.47`)

## User prefs
- Push to `master`; user pulls live
- Laconic replies
- Version bump in `src/App.js` on ship

## IndexedDB
- Clips in browser IndexedDB per origin (`idb-keyval`)
- Not in git; export/import in Setup → storage panel

## Test before push
```bash
npm test
npm run build
```
