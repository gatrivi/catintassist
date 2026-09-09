# Number / Sensitive-Data Pipeline Eval (2026-09-08)

Incident: card number dictated yesterday got formatted as a phone number.
Top rule: **digits must never disappear or show inaccurately.**

## Why the card got phone-formatted
`formatPhoneAndSSNDigits` (`src/utils/sensitiveDataProtector.js:80`) matches any 8–16 digit run:
- 9 digits → SSN shape, 10 → phone, 11 leading-1 → +1 phone, **everything else → groups of 3 with dashes**.
- No card detector exists anywhere (`grep credit|card|visa|amex` = 0 hits). A 16-digit card falls into the 3-group fallback → looks like a weird phone. Exactly your incident.
- 17+ digits: regex fails entirely → raw unformatted. 14-digit Diners also mis-grouped in 3s.

## Digit-length rule table (current)
| Length | Result |
|---|---|
| 1–7 | untouched (7-digit phones never formatted) |
| 8 | 3-group fallback |
| 9 | SSN NNN-NN-NNNN — **unconditional, no cue needed** |
| 10 | phone NNN-NNN-NNNN |
| 11 (starts 1) | +1 phone |
| 8, 11, 12–16 | 3-group fallback |
| 17+ | nothing |

## Three disagreeing phone regexes (conflict)
1. `sensitiveDataProtector.formatPhoneAndSSNDigits` — 8–16 digits (render).
2. `translationSensitiveTokens.PHONE_RE` — only 10–11 digits (translation-loss check).
3. `sensitiveDataProtector.NUMBER_HIGHLIGHT_REGEX` — loose catch-all (highlight).

Consequence: **12–16 digit runs are invisible to translation-loss detection** — if the translation engine drops them, no salvage fires. Also `ID_RE` matches any bare 9 digits → 9-digit account numbers mis-flagged as SSN.

## Other confirmed hazards (ranked)
1. **Split bubbles kill stitching**: `splitLongTextAtCommas` can split comma-dictated digits ("555, 123, 4567") into separate bubbles; stitch only runs per-bubble → fragments never join, may under-format.
2. **NYC zip repair can corrupt**: any "NY NNN" → rewritten to "100NN" regardless of context (`repairNYCZipNumbers` :572).
3. **Sentinel first-match order**: `detectSentinelContext` returns first cue in text; a "phone" cue earlier in a paragraph suppresses formatting for an actual SSN later.
4. **Multi-word numbers mangled**: no hundred/thousand compounds — "twenty twenty four" → "20 20 4" (may stitch to 20204).
5. **Stitch over-joins**: any ≥2 adjacent single digits join ("I have 2 3 options" → "23").
6. **Duplicated dosage/money regexes** in 3 files with drifting unit lists (protector ×2 + translationSensitiveTokens).
7. Salvage markers `[⚠ Check: ...]` could leak into corrections/exports as literal text.

## What's solid (don't break)
- Overlap removal & hallucination pruning are digit-guarded (`removeOverlapPreservingDigitSequences`, `containsCriticalData`) — digits survive chunking.
- v4.82 translation strength ledger rejects digit-losing translations (for 10–11-digit phones and dates/doses/money — gap is only the odd-length runs above).
- Date masking via PUA sentinels prevents stitch/format tearing dates; verified no leak into translation.

## Recommended fix plan (not yet implemented)
1. **Card-number detection** in `formatPhoneAndSSNDigits`: cue words (card, crédito, visa, MC, amex, "security code") OR 13–19-digit runs / 4×4 chunks → format as `#### #### #### ####` (Amex 4-6-5), never phone-shape. CVC (3–4 digits after cue) left bare + highlighted.
2. **Unify digit-run classification** into one helper used by render + translation tokens + highlight, so loss-detection covers all lengths.
3. Make 9→SSN cue-gated (require ssn/social cue, else neutral grouping).
4. Add card fixtures + tests; add 12–16 digit case to `translationSensitiveTokens`.
