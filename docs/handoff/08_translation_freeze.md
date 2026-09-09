# Translation Freeze Handoff (v4.86.1, UNCOMMITTED)

Live STT edits were blanking readable translations mid-read. Fix is done in working tree, not committed. Next agent: verify on localhost:3000, then commit.

## Uncommitted changes (do not lose)
- `src/hooks/useTranslate.js` — freeze + `isStale` badge + tail-only carry-over
- `src/components/TranscriptionBoard.js` — ↻ stale badge next to frozen translation

## What changed
- Split/non-prefix STT edit no longer `setTranslation('')`. Display freezes, `engineStatus='translating'`, ↻ badge shows.
- Failed/empty engine round never overwrites a good visible translation.
- Unchanged segments reused by exact source-text match (no refetch, no churn). Only new/changed tail hits network.
- Split tail keeps same `captionId`, so frozen prefix carries automatically. 10-word live gate untouched.
- `translationRef` mirror avoids effect dep loop (build is warning-free).

## Verify on localhost:3000
```powershell
# terminal 1: local translate gateway (committed v4.86.1)
npm run gateway
# terminal 2: dev server (setupProxy routes /api/translate → gateway)
npm start
```
- Type/speak so a bubble gets a translation, then keep talking: old text must stay + ↻ until new arrives. Never blank.
- Related tests: `src/hooks/useTranslate.{auto,split,persisted}.test.js` — 7/7 pass.
- `npm run build` passes (direct react-scripts; repo `build` script may differ).

## Known pre-existing (not mine, do not mix in)
- `releaseNotes.test.js` + `ReleaseNotesModal.test.js` fail: v4.86.1 gateway entry has empty `highlightElementIds` (test needs >0). Fix separately.
- Full `npm test` blocked per handoff README (dirty engine work) — same story.

## Open: local TTT service API
- Separate agent is lifting a local TTT service API for localhost:3000. Port/contract TBD — record here when known.
- Freeze work only touches the two files above; gateway (`scripts/local-translate-gateway.js`, `src/setupProxy.js`, port 59210) is committed and must keep working.

## Touch-only
`src/hooks/useTranslate.js`, `src/components/TranscriptionBoard.js`, plus tests under `src/hooks/useTranslate.*.test.js`.

## Do not regress
- No blank translation frames; stale badge only, no layout shift (80/20 + no-vanish rules).
- Never re-add browser→provider fetch (gateway only); Lingva stays out.
