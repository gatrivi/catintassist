# Translation Reliability Harness (v4.82.0 — safety ledger)

Pure **accept/reject applicator** shared by live `useTranslate` and Jest fixtures.

## Invariant

> Once a bubble/segment has a usable translation, nothing weaker may overwrite it.

Blank / filler / stale / digit-loss / failed ≪ prior `ok`/`weak`. No valid result → **source passthrough** (never silent blank).

## Pipeline

```
caption text → splitLongForTranslation (~40 words)
  → per-segment engine (or mock)
  → applyTranslationResult
  → caption.translations[key] (sealed only → IDB)
  → composeCaptionTranslation → UI
```

Key: `captionId::segmentId::sourceHash::targetLang`

## Persist (sealed only)

Write when final + accepted / warning salvage / passthrough-fail / user override. Hydrate before re-fetch.

## npm

```bash
npm run test:translation
```

## Files

- `src/utils/translationApplicator.js`
- `src/utils/translationSensitiveTokens.js`
- `src/utils/translationFixtureReplay.js`
- `src/hooks/useTranslate.js`
