# Connect & languages

## Gestures

| Action | Mode | Use |
|--------|------|-----|
| **Single tap** Connect | `mic` | Phone/tablet demo, device microphone |
| **Double tap** Connect | `tab` | Interpreter work — browser tab audio |

## Tab mode = EN↔ES

Double-tap always uses **dual Deepgram EN+ES sockets** and auto language pick — your production interpreter path. Custom language pairs (e.g. PT→ZH) apply only on **mic** connect.

## Languages

- Default UI: **ENG → SPA** (full support)
- Hold language bar to pick other pairs
- Partial support: PT, RU, ZH, FR, DE, IT, JA, KO, etc. (see `?` table in app)

## Code

- `src/hooks/useDeepgram.js` — capture + STT
- `src/hooks/useTranslate.js` — translation pairs
- `src/contexts/LanguageContext.js` — user pair prefs
