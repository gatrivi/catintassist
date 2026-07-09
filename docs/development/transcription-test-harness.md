# Transcription Test Harness (v4.81.0)

Dev-only path to test STT caption logic **without tab capture**.

## Pipeline (one path)

```
fixture JSON / live Deepgram WS
  → applyDeepgramTranscriptPayload
  → reduceTranscriptEvent (captionEngine)
  → rows / session captions
```

`DevSimulatePanel` stays bubble-injection only. Do not mix the two.

## Enable

- Dev builds: always on (`NODE_ENV !== 'production'`)
- Prod unlock: `REACT_APP_DEV_TEST_HARNESS=true`
- UI: Settings → Behavior → **Test Harness**

## InputSource kinds

`tab` | `mic` | `virtualCable` | `mockStream` | `audioFile` | `fixture`

- `fixture` — no MediaStream; replay events only
- `mockStream` — silent AudioContext stream (no permission prompt)

## Add a fixture

1. Create `src/fixtures/transcription/<id>.json`
2. Use **fake PHI only** (`555-123-4567`, `01/02/1970`, `123 Main Street`, `John Example`)
3. Include **interim typo → interim correction → final seal**
4. Register in `src/fixtures/transcription/index.js`
5. Run `npm run test:fixtures`

Schema TLDR:

```json
{
  "id": "my-case",
  "label": "…",
  "meta": { "protectionsOn": true, "pair": { "left": "en", "right": "es" } },
  "events": [
    { "atMs": 0, "lane": "en", "payload": { /* Deepgram Results */ } }
  ],
  "expect": {
    "minFinals": 1,
    "langs": ["en"],
    "preserveDigits": ["5551234567"],
    "finalTexts": ["555"]
  }
}
```

`disconnect-reconnect` uses **revenant** capture-gate meta (`meta.revenantCaptureGate`). Legacy App APIs may still say `isZombieCall`.

## npm scripts

```bash
npm run test:fixtures
npm run test:transcription
```

## Live attach smoke (manual)

```
[ ] tab attach starts
[ ] mic attach starts
[ ] virtualCable attach starts
[ ] fixture replay works (Settings → Behavior → Test Harness)
[ ] mockStream does not request browser media permission
```
