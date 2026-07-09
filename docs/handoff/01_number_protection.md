# Handoff: Number / Sensitive Data Protection (v4.84.7)

## Problem
Phone, SSN, dates, dosage, money, addresses, email, and spelling must survive STT overlap and display as readable **units**. Wrong edits lose the interpreter their job.

**Full approach (A–E shipped):** [`../development/sensitive-data-approach.md`](../development/sensitive-data-approach.md)

## Pipeline (read in order)
1. **STT overlap** — `removeOverlapPreservingDigitSequences()` + `containsCriticalData` guards (`captionEngine` / `useDeepgram`)
2. **Lane-aware number words** — `convertEnglishNumberWords(text, lang)`
3. **Sentinel gate (v4.84.5)** — `detectSentinelContext` → skip stitch and/or phone format for date/address/email/spelling/dosage…
4. **Date mask** — `maskDateUnits` before stitch so day+month+year stay intact
5. **Digit stitch + phone/SSN format** — when sentinel allows
6. **NYC zip repair** — `repairNYCZipNumbers()`
7. **UI highlight + copy** — `splitHighlightSegments` → date / dosage / money / number spans (`TranscriptionBoard` / `StableTextMorph`)

## Highlight units (click-copy)
| Type | Example | Copy |
|------|---------|------|
| number/phone | `555-123-4567` | digits |
| date | `May 8 1990` | ISO `1990-05-08` when year present |
| dosage | `500 mg` | `500 mg` |
| money | `$25.00` | amount digits |

## Name / spelling chips (not protector)
- Sealed trailing chips only (`transcriptFormat.js`)
- Weak cue `I'm` needs Capitalized name — `I'm sorry` ≠ Name
- Spelling: spoken paragraph stays; trailing `Spelled · SMITH` (v4.84.6)

## Known footguns
| Bug | Cause | Fix direction |
|-----|-------|---------------|
| Numbers vanish mid-call | Overlap dedupe ate digits | v4.18 hardened — add test before changing overlap |
| EN "once" → 11 | Ran ES map on EN lane | Always pass `lang` to `convertEnglishNumberWords` |
| `I'm sorry` Name chip | Weak cue grabbed next word | v4.84.3 stopwords + Capitalized gate |
| Lone `8` in date | Number regex only | v4.84.4 date units |
| Address digits → phone | No sentinel gate | v4.84.5 |

## Touch only
- `src/utils/sensitiveDataProtector.js` (+ tests)
- `src/utils/transcriptFormat.js` (chips / spelling)
- `src/components/TranscriptionBoard.js` / `StableTextMorph.js` (display/highlight only)

## Do not touch (without reading tests)
- `src/hooks/useDeepgram.js` overlap/hallucination paths
- Overlap algorithm until date/dose unit tests stay green

## Acceptance
- `sensitiveDataProtector.test.js` + `transcriptFormat.test.js` pass
- Phones still group; dates/doses/money are one span; sentinels brake display only
