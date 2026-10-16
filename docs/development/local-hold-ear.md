# Local hold ear — plan (queued 2026-10-16)

**Goal:** hear MY "please hold / un momento" lines on my mic, locally, $0 Deepgram.
Hold = provider left the room = silence. Only my side formalizes it.

## Verdict: good enough — for a phrase list, not for transcription
- **Engine:** `vosk-browser` (WASM, CPU, offline). Small EN + ES models ≈ 40–50 MB each, cached once.
- **Grammar mode:** recognizer only allowed the hold phrases + `[unk]`. Fixed short list = high accuracy; full free speech locally would NOT be good enough for medical transcription.
- **Privacy:** audio never leaves the machine (Web Speech API rejected: sends my voice, incl. patient data I repeat, to Google).

## What changes (from → to)
| | now | after |
|---|---|---|
| hold start | provider's words via Deepgram, or manual button | + my own hold phrase on local mic |
| cost | — | $0 (local CPU) |
| my mic to Deepgram | never | still never |

## Steps
1. Lazy-load vosk-browser + model only after first CONNECT (not on page load).
2. Feed mic track → recognizer in a Worker, grammar = list from `holdPhrases.js`.
3. Match → same hold-intent path as today (`matchHoldPhrase`), source tag `local-mic`.
4. Settings switch, ships OFF. Latency + CPU check on a real call before ON.

## Open risks
- Model hosting: Vercel bandwidth (free tier) → load from alphacephei CDN or jsDelivr, not our bundle.
- Echo: patient audio leaking into my mic could fire it → only my mic device, VAD gate.
