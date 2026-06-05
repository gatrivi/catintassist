# Cursor agent rules (CatIntAssist)

Read this file first. Stays small on purpose.

## Scope by task

| Task | Touch only |
|------|------------|
| Soundboard play/setup | `src/components/GreetingsPanel.js`, `src/index.css` (`.sb-*` blocks) |
| Soundboard storage | `src/utils/storage.js` |
| STT / transcript | `src/hooks/useDeepgram.js`, `src/components/TranscriptionBoard.js` |
| TTS | `src/hooks/useTTS.js` — or separate TTS repo per `05_TTS_SPINOFF.md` |
| Scoreboard | `src/components/DashboardHeader.js` |

Do **not** re-read the whole repo for a one-file fix.

## Soundboard safety backlog (priority order)

1. `VIRTUAL_MIC_ROUTE` — verify with WhatsApp Desktop voice note → VB-Cable input
2. Done: `CALL_PATH_AUTO_VERIFY`, passthrough mute during clips (`v4.47`)

## User prefs

- Push to `master`; user pulls live
- Laconic replies
- Version bump in `src/App.js` on ship

## IndexedDB

Clips in browser IndexedDB per origin (`idb-keyval`). Not in git. Export/import in Setup → storage panel.
