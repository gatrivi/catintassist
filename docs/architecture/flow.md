# Architecture Flow (v4.48.2)

## End-to-end (on call)
Mic/tab → Deepgram WS → captions (via `useDeepgram`)
→ `useTranslate` (DeepL/Google fallbacks)
→ `TranscriptionBoard` UI (render transcription + translation)
→ (spoken output, if enabled) `useTTS`
→ `setSinkId` / virtual mic routing

## Off-call
`DashboardHeader` + main panel (scoreboard / tools).
Timers + stats live in `SessionContext`.

## Key state owners
- `SessionContext`: timers, daily stats, break/avail bookkeeping, pins
- `useDeepgram`: dual EN/ES sockets + language detection tie-break
- `useTranslate`: translation per bubble with “sticky” language pairs

## Where to look first when something “feels wrong”
- Column/lane issues: `src/components/TranscriptionBoard.js` + `src/hooks/useDeepgram.js`
- Translation instability / garble on splits: `src/hooks/useTranslate.js`
- Patient audio routing: `useTTS` + sink routing code paths

