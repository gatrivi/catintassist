# Handoff: Medical Term Priority

## Problem
Homophones and generic STT readings beat clinical terms. Medical interpreting needs clinical vocabulary to win over common words when context is ambiguous.

## Stub (v4.56)
`src/utils/medicalTermLexicon.js`:
- `MEDICAL_TERMS_EN`, `MEDICAL_TERMS_ES` — seed arrays (extend, do not replace format)
- `scoreTermPriority(token, lang, context)` — higher score = prefer this reading
- `applyMedicalBias(text, lang)` — pure post-process hook (returns text unchanged until lexicon wired)

## Integration points (Phase 2 — document only for now)
| Hook | File | When |
|------|------|------|
| Post-STT finalize | `useDeepgram.js` | After bubble text sealed, before caption stored |
| Pre-translate glossary | `useTranslate.js` | Before `translateWithFallback`, apply `findCorrection` + medical replacements |

## Touch only
- `src/utils/medicalTermLexicon.js`
- `src/utils/medicalTermLexicon.test.js`
- Integration files above (Phase 2 only)

## Do not touch
- Translation engine chain order
- Bubble layout / `TranscriptionBoard.js` unless adding zero-height term highlight

## Acceptance
- Unit tests pass for `scoreTermPriority` and `applyMedicalBias`
- Seed includes at least 10 EN + 10 ES clinical terms
- No regression in number protection tests

## Phase
1. **v4.56:** stub + tests (done)
2. **Next:** seed lexicon from user corrections + wire `applyMedicalBias` in `useDeepgram.js`
3. **Later:** shared medical glossary via DB (`06_auth_db.md`)
