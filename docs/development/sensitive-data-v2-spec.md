# Sensitive Data v2 Spec — EN/ES medical interpreting (2026-09-08)

Status: **PROPOSAL — not implemented.** Extends eval in `DIAGNOSIS-2026-09-08-number-pipeline.md`.
Iron rule: **nothing disappears; nothing shows inaccurately; ambiguity → keep raw digits + copy chip.**

## Naming cheat-sheet
- `src/utils/sensitiveDataProtector.js` — the engine (`applyDisplayProtections` at render).
- `src/utils/translationSensitiveTokens.js` — stops translations dropping digits.
- `splitHighlightSegments()` — paints clickable chips.

## Core design change: one classifier, three consumers
Today 3 disagreeing regex sites (render / translation-guard / highlight). Replace with one exported
`classifyRuns(text, lang)` in sensitiveDataProtector; translationSensitiveTokens + highlight consume its output.
Every digit run ≥4 chars gets exactly one verdict → no length gaps, no drift.

## Taxonomy (all EN/ES medical-call cases)

| # | Type | Examples (spoken) | Verdict |
|---|---|---|---|
| 1 | Phone | "five five five..." 7/10/11-digit | 7→NNN-NNNN, 10→NNN-NNN-NNNN, 11(1)→+1 ... (unchanged) |
| 2 | SSN | cue: "social security / número de seguro social" + 9 | 9 w/ SSN cue → NNN-NN-NNNN; no cue → neutral |
| 3 | **Card** (NEW) | cue: card/tarjeta/crédito/débito/visa/mastercard/amex/"número de tarjeta" + 13–19 digits or 4×4 chunks | `#### #### #### ####` (Amex 4-6-5); 15/16 w/o cue → 4-grouping too |
| 4 | **CVC/expiry** (NEW) | "security code ... one two three" / "expires zero nine twenty seven" | CVC 3–4 digits after cue: bold + chip, no dashes; expiry → date unit |
| 5 | **Member/policy ID** (NEW) | cue: member ID/policy/póliza/member ID number + alphanumeric 6–14 | chip, NO reformat (preserve letters+digits verbatim) |
| 6 | **MRN / case / claim / account #** (NEW) | cue: medical record/expediente/case number/número de caso/claim/reclamo/account + digits/alphanum | chip, verbatim |
| 7 | Date/DOB/appointment | existing | unchanged (mask + sentinel) |
| 8 | Dosage | existing | unchanged |
| 9 | Money/copay | existing | unchanged |
| 10 | Address + ZIP | existing | unchanged (NYC repair gets context gate) |
| 11 | Email | existing | unchanged |
| 12 | **Vitals** (NEW) | "120 over 80", "temperature 101 point 2", A1C 7.4, weight 150 pounds | keep as-is + highlight; never stitched into phone shape |
| 13 | **Times** (NEW) | "at 3 30" → 3:30 (already partial via clock cue) | N:NN, guarded from stitch |
| 14 | Fallback | any digit run ≥4 with no cue | neutral 4-grouping `####` chunks, chip; **never 3-group** |
| 15 | Alphanumeric runs | "B 4 5 9 2" | stitched only if ≥4 units and mostly digits-with-letters cue |

## Behavior changes (precise, from → to)
1. 3-group fallback → **removed everywhere** (this caused the card-as-phone incident). Unknown → 4-groups.
2. 9 digits unconditional SSN → SSN only with ssn cue; else neutral 4-group.
3. 12–16 digit runs invisible to translation guard → classifier output feeds `diffSensitiveTokens` → salvage fires.
4. Card/CVC/member-ID/MRN/case/claim/account: nothing → cue detection (EN+ES tables) + formats above.
5. `repairNYCZipNumbers` always-on → only when an address cue is active.
6. `detectSentinelContext` first-match-wins → ordered by cue proximity to the digit run (nearest cue wins).
7. Word2num still no compounds; "twenty twenty four" guard: year pattern (19xx/20xx) → freeze, no stitch.
8. Overlap/hallucination guards: unchanged (already digit-safe).

## Sentinel cue words (new tables, EN/ES)
- card: card, credit, debit, visa, mastercard, amex, tarjeta, crédito, débito
- cvc: security code, cvv, cvs, código de seguridad
- member: member id, policy number, póliza, número de socio
- mrn: medical record, mrn, expediente, case number, número de caso, claim, reclamo, account number, número de cuenta, folio

## Tests/fixtures to add
`credit-card.json`, `member-id.json`, `mrn.json`, `vitals.json`, `times.json`, `fallback-4group.json`; extend
translation fixtures for 16-digit loss salvage. ES dictation fixtures for tarjeta/expediente.

## Out of scope (unchanged)
Name chips, spelling blocks, corrections UI, translation strength ledger internals.
