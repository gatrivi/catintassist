# Agent Handoff Index (v4.85.14)

**Read first:** [`00_global_rules.md`](00_global_rules.md)

Outside agents: pick **one** spec below. Do not re-read the whole repo.

## Current app version
Top-right must show **v4.85.14** after this ship.

## Current operating invariants
- Active-call STT controls are fixed and reachable: `TAB` + `VB` in a 30px row. Never remove them; a compact UI may only move secondary setup behind a labeled expander.
- Switching acquires new audio before releasing old audio. Failed TAB/VB switch keeps captions and the working stream.
- VB resolves `CABLE Output` automatically or fails closed. It must never capture a default physical mic.
- Header cat is the quiet app-health beacon: gray ready · blue connecting · green STT live · amber check · red error. Silence alone is not an error.
- Translation is local translator → Vercel gateway. Browser must never call a third-party provider. Wait for 2 words; one request runs at a time; live updates require 10 new words. Failure must remain visible, never blank.
- Full tests are currently blocked by existing dirty translation-engine work; do not discard or stage it with unrelated changes.

## What's new (docs)
- [`docs/development/sensitive-data-approach.md`](../development/sensitive-data-approach.md) — A–E + ES name chips (v4.84.3–4.84.8)
- [`docs/CHANGELOG.md`](../CHANGELOG.md) — recent versions
- [`docs/transcription-pane/corrections.md`](../transcription-pane/corrections.md) — bubble teach
- [`docs/development/element-hint.md`](../development/element-hint.md) — tooltip system

## How to work
1. Read global rules + your task spec
2. Touch only files listed in that spec
3. `npm test` + `npm run build`
4. Bump version in `src/constants/version.js`, `package.json`, and `package-lock.json`
5. Push to `master` (user pulls live)

## Task specs (priority order)

| # | Task | Spec | Code entry |
|---|------|------|------------|
| 1 | Number protection | [`01_number_protection.md`](01_number_protection.md) | `src/utils/sensitiveDataProtector.js` |
| 2 | UI cleanup | [`05_ui_cleanup.md`](05_ui_cleanup.md) | `src/index.css`, header components |
| 3 | Medical term priority | [`02_medical_terms.md`](02_medical_terms.md) | `src/utils/medicalTermLexicon.js` |
| 4 | Transcript corrections | [`04_transcript_corrections.md`](04_transcript_corrections.md) | **SHIPPED v4.76.0** — [`corrections.md`](../transcription-pane/corrections.md) |
| 5 | Scoreboard polish | [`03_scoreboard.md`](03_scoreboard.md) | `GameScoreboard.js`, `DashboardHeader.js` |
| 6 | Auth + DB (future) | [`06_auth_db.md`](06_auth_db.md) | read only until approved |
| 7 | STT soft outage | [`07_stt_soft_outage.md`](07_stt_soft_outage.md) | `useDeepgram.js`, `captionEngine.js`, `TranscriptionBoard.js` |

## Also read
- [`docs/cursor-agent/README.md`](../cursor-agent/README.md) — touch-only file table
- [`docs/architecture/module-map.md`](../architecture/module-map.md) — feature → file map
- [`AGENTS.md`](../../AGENTS.md) — user prefs + open inbox items

## Test commands
```bash
npm test
npm run build
npm start   # manual sanity at 900×600
```
