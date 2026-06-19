# Handoff: Number Protection

## Problem
Phone numbers, SSN-like sequences, and spelled digits must survive STT overlap removal and display correctly. Wrong edits lose the interpreter their job.

## Pipeline (read in order)
1. **STT overlap** — `removeOverlapPreservingDigitSequences()` in `useDeepgram.js` calls `sensitiveDataProtector.js`
2. **Lane-aware number words** — `convertEnglishNumberWords(text, lang)` — EN lane only converts EN words; ES lane only ES
3. **Digit grouping** — `formatPhoneAndSSNDigits()` — 9-digit → XXX-XX-XXXX, 10-digit → XXX-XXX-XXXX
4. **NYC zip repair** — `repairNYCZipNumbers()`
5. **UI highlight + copy** — `TranscriptionBoard.js` → `getNumberHighlightRegex()`, click-to-copy

## Known footguns
| Bug | Cause | Fix direction |
|-----|-------|---------------|
| Numbers vanish mid-call | Overlap dedupe ate digits | v4.18 hardened — add test before changing overlap |
| EN "once" → 11 | Ran ES map on EN lane | Always pass `lang` to `convertEnglishNumberWords` |
| Spanish "once" (eleven) on EN lane | Same | Lane must match bubble language |

## Touch only
- `src/utils/sensitiveDataProtector.js`
- `src/utils/sensitiveDataProtector.test.js`
- `src/components/TranscriptionBoard.js` (display/highlight only)

## Do not touch (without reading tests)
- `src/hooks/useDeepgram.js` overlap/hallucination paths

## Acceptance
- All existing `sensitiveDataProtector.test.js` tests pass
- New cases cover: 9-digit phone, 10-digit phone, spelled digits mid-sentence, NYC zip, overlap preserves digit runs

## Test ideas
```js
// add to sensitiveDataProtector.test.js
formatPhoneAndSSNDigits('2125551234') // → grouped
convertEnglishNumberWords('call me at two one two', 'en') // digits in EN lane
convertEnglishNumberWords('once al día', 'es') // eleven, not "1 time"
```

## Phase
Hardening + tests. No UI layout changes.
