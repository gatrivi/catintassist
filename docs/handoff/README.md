# Agent Handoff Index (v4.56.0)

**Read first:** [`00_global_rules.md`](00_global_rules.md)

Outside agents: pick **one** spec below. Do not re-read the whole repo.

## Current app version
Top-right must show **v4.56.0 (Handoff)** after this ship.

## How to work
1. Read global rules + your task spec
2. Touch only files listed in that spec
3. `npm test` + `npm run build`
4. Bump version in `src/App.js` + `src/components/SettingsPanel.js`
5. Push to `master` (user pulls live)

## Task specs (priority order)

| # | Task | Spec | Code entry |
|---|------|------|------------|
| 1 | Number protection | [`01_number_protection.md`](01_number_protection.md) | `src/utils/sensitiveDataProtector.js` |
| 2 | UI cleanup | [`05_ui_cleanup.md`](05_ui_cleanup.md) | `src/index.css`, header components |
| 3 | Medical term priority | [`02_medical_terms.md`](02_medical_terms.md) | `src/utils/medicalTermLexicon.js` |
| 4 | Transcript corrections | [`04_transcript_corrections.md`](04_transcript_corrections.md) | `src/utils/transcriptCorrections.js` |
| 5 | Scoreboard polish | [`03_scoreboard.md`](03_scoreboard.md) | `GameScoreboard.js`, `DashboardHeader.js` |
| 6 | Auth + DB (future) | [`06_auth_db.md`](06_auth_db.md) | read only until approved |

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
