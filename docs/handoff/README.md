# Agent Handoff Index (v4.88.4)

**Read first:** [`00_global_rules.md`](00_global_rules.md)

Outside agents: pick **one** spec below. Do not re-read the whole repo.

## Current app version
Top-right must show **v4.94.0** (uncommitted — local only). Status: [`12_tiny_translate_chunks_2026-09-09.md`](12_tiny_translate_chunks_2026-09-09.md) (translate chunk fix, push scope pending) + [`11_cpu_sink_fix_2026-09-09.md`](11_cpu_sink_fix_2026-09-09.md) + [`10_session_status_2026-09-08.md`](10_session_status_2026-09-08.md) — coordinate before staging (very dirty tree).

## Current operating invariants
- Active-call STT controls are fixed and reachable: `TAB` + `VB` in a 30px row. Never remove them; a compact UI may only move secondary setup behind a labeled expander.
- Switching acquires new audio before releasing old audio. Failed TAB/VB switch keeps captions and the working stream.
- VB resolves `CABLE Output` automatically or fails closed. It must never capture a default physical mic. Saved IDs validate vs live enumeration; explicit VB-out picks are never auto-overridden (`CATINTASSIST_SINK_EXPLICIT`).
- Header cat is the quiet app-health beacon: gray ready · blue connecting · green STT live · amber check · red error. Silence alone is not an error.
- Translation is local TTT (`127.0.0.1:59200/stt/translate`, Marian int8, CORS includes `:3001`) → Vercel gateway. Browser must never call a third-party provider. No provider keys in `.env`, so gateway fallback 503s — local-only is correct. Wait for 2 words; one request runs at a time; live updates require 10 new words. Failure must remain visible, never blank.
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
| 8 | Translation freeze (uncommitted) | [`08_translation_freeze.md`](08_translation_freeze.md) | `useTranslate.js`, `TranscriptionBoard.js` |
| 9 | Voicemeeter safeguards (pending) | [`09_voicemeeter_safeguards.md`](09_voicemeeter_safeguards.md) | `AudioSettingsContext.js`, `AudioRouteStatusBar.js`, `audioRoutePassthrough.js` |
| 10 | Session status 2026-09-08 | [`10_session_status_2026-09-08.md`](10_session_status_2026-09-08.md) | read-only status — big vs little session split |
| 11 | CPU sink fix 2026-09-09 | [`11_cpu_sink_fix_2026-09-09.md`](11_cpu_sink_fix_2026-09-09.md) | read-only status — uncommitted, do not push |
| 12 | Tiny translate chunks 2026-09-09 | [`12_tiny_translate_chunks_2026-09-09.md`](12_tiny_translate_chunks_2026-09-09.md) | `translationApplicator.js`, `useTranslate.js` — uncommitted, push scope pending |

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
