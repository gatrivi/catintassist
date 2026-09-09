# 13 · CPU freeze — blank caption row (v4.94.1, 2026-09-09)

## Status: DONE — fixed, tested, pushed (commit 62d049d)

## Symptom
App on :3001 froze, Chrome ate 100% CPU during calls. Console flooded with
`[CAT VANISH] ui_blank_caption_skipped` ~4×/sec, same id (`dg-en-114.58-i`), fired from inside React render.

## Root cause (NOT the translation API changes)
1. `captionEngine.js` — when `removeOverlapPreservingDigitSequences` emptied the first
   transcript of a turn, the freshly appended live-draft row (no `text` field) was kept in
   state via the `overlap_empty_freeze` early-return. It could never seal (seal requires
   `text?.trim()`), so it sat there forever and even persisted to IDB (resurrected on reload).
2. `TranscriptionBoard.js` — during every render, that blank row fired `flagVanish(force:true)`
   → unthrottled `console.warn` (expensive with DevTools open).
3. `setSttNow` interval re-rendered the whole board every 250ms (fixed to 1000ms in v4.93.1,
   but the running tab still had the 250ms build).
Net: 4 full-board renders/sec × layout-thrashing ref callbacks × forced console.warn = freeze.

## Fixes shipped
- `captionEngine.js`:
  - `mergeCaptionsForUi`: blank live draft (`!text?.trim()`) never merged into UI rows.
  - `overlap_empty_freeze` branch: if last row is the just-appended all-empty draft, drop it
    (prevents blank rows persisting to IDB).
- `TranscriptionBoard.js`: `blankFlaggedRef` Set — blank-caption vanish log fires once per id per session, not per render.
- `sensitiveDataProtector.js` (pre-existing red tests, fixed same push): ssn/phone sentinel
  modes now pass `ignoreAddressGuard`/`ignoreDateGuard` to BOTH `stitchSingleDigitSequences`
  and `formatPhoneAndSSNDigits` — "Medicaid ID 1013159516, Madison Avenue May 8" groups to
  `101-315-9516` again.
- `releaseNotes.js`: added 4.94.1 entry; fixed 4.93.0's empty `highlightElementIds` (was failing tests).

## Verification
- 71 test files green (`node scripts/test-in-batches.js`), incl. 2 new captionEngine tests
  (blank draft dropped at merge + at overlap_empty_freeze).
- `npm run build` clean. Pushed via safe-push (1/4 that hour).

## Watch in prod
- Blank rows should never appear; if `[CAT VANISH] ui_blank_caption_skipped` reappears more
  than once per id, the engine is re-creating blanks somewhere else — check `initEngineFromPersisted`.
- If 1Hz full-board renders still cost CPU on long calls, next step: isolate `sttNow` into the
  small status subcomponent (only consumer) instead of board-level state.
