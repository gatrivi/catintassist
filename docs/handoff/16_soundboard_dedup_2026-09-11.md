# 16 — Soundboard dedup v4.99.3 (SHIPPED)

**Version:** v4.99.3 (top-right pill). Status: tests + build green, ready to push.

## What changed
- Retired `open_client` ("Client Open") — exact same words as `greeting_en`.
  Survivor: `greeting_en` = "Opener – Client" (keeps morning/afternoon/evening takes).
- Relabeled the rest, deleted nothing:
  openers in call order, closers grouped, old generics tagged Legacy.
- Your recording of the retired tile auto-copies to the survivor if its
  slots are empty (clip + health score + CALL OK stamp). Old blob stays as
  recoverable orphan in IndexedDB — Storage panel lists it, Export backup saves it.

## Why this shape
- Only 1 byte-identical dupe existed. The other same-job tiles have
  different handbook tails, so they stay as separate recordable steps.
- On-call strip untouched (7 tiles: both openers, hold excuses, sign off, louder, intake).

## Files touched
- `src/services/soundboardMetaService.js` (retire map, relabels, merge filter, seed 3)
- `src/components/GreetingsPanel.js` (ACTIONS, carry-over in reloadData)
- `src/services/soundboardMetaService.test.js`, `src/services/cloudSync.test.js`
- `src/content/releaseNotes.js`, `src/constants/version.js`, `package.json`
- `docs/CHANGELOG.md`

## Verify on live
1. Studio shows 25 tiles, no "Client Open".
2. Opener tiles read Opener–Client / Opener–LEP / Opener–LEP (ES) / Opener–Direct dial.
3. If you had recorded Client Open only: Opener–Client morning shows SAVED.
4. Release-notes modal pops for v4.99.3 on load.

## Next (not started)
- Soundboard patient-audio path still the big open issue (AGENTS.md inbox).
- If more same-job tiles feel like dupes after using the new names, name them here and we collapse case-by-case.
