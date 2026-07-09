# Global Rules (every agent reads once)

## Hard constraints
- **80/20 viewport:** transcription + translation ~80%; scoreboard ~20% (`AGENTS.md`)
- **Work pane stability (v4.55+):** no inline diagnostic panels in bubbles; no show/hide blocks that change row height; use `title`/hover for hints
- **Version visible:** bump `src/App.js` top-right tag on every ship
- **Tests before push:** `npm test` + `npm run build` — do not push crashing builds
- **Precise diffs:** if user asks for "all metrics", implement **all** metrics

## Touch-only discipline
Each handoff spec lists allowed files. Do not refactor unrelated code.

## Layout stability
- Nothing in the interpret pane may pop in/out without transition or reserved space
- Throttled auto-scroll only on new bubble or finalize (`TranscriptionBoard.js`)
- `React.memo` on bubbles — do not remove without reason

## Translation / STT
- Do not destroy existing translations on bubble split (`useTranslate.js` sticky pairs)
- Weak short accepts (`"K."`, `"Yes"`) are intentional — not errors
- Lingva removed from chain — do not re-add browser CORS mirrors

## Persistence today
- Stats: `localStorage` key `catintassist_stats`
- Corrections (stub): `catint_corrections_v1`
- Soundboard clips: IndexedDB (not in git)
- No backend/login yet — see `06_auth_db.md`

## User communication
- **Answer tiers:** 60% <40w · 30% <80w · 10% <120w (summaries + replies; see `AGENTS.md`)
- Laconic replies; user is often on call
- Mention version number in feature messages
