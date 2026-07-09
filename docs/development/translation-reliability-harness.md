# Translation Reliability Harness (v4.82.0)

Pure **accept/reject applicator** shared by live `useTranslate` and Jest fixtures.

## Pipeline

```
caption text → splitLongForTranslation (~40 words)
  → per-segment engine (or mock)
  → applyTranslationResult
  → caption.translations[key] (sealed only → IDB)
  → composeCaptionTranslation → UI
```

Key: `captionId::segmentId::sourceHash::targetLang`

## Invariant

Prefer previous-good (`preserved: true`, status stays `ok`/`weak`) over blank, stale, or filler. Sensitive token loss → append ` [⚠ Check: TOKEN]`.

## Persist (sealed only)

Write `caption.translations` when final + accepted / warning salvage / user override. No interim IDB churn. Restores with `catint_captions_v2`.

## npm

```bash
npm run test:translation
```

## Fixtures

`src/fixtures/translation/*.json` — fake PHI only (`555-…`, `01/02/1970`).

## Files

- `src/utils/translationApplicator.js`
- `src/utils/translationSensitiveTokens.js`
- `src/utils/translationFixtureReplay.js`
- `src/hooks/useTranslate.js` (thin consumer)
