# Audio eval — measuring the microphone (Stage 5)

**Why this exists.** Everything measured so far is text-level: the harness scores
*provider text vs displayed text*, and the provider text comes from fixtures I
wrote. Not one number touches a microphone. So "the provider hears it right" is a
guess, and the three provider questions below are unanswerable until it isn't:

- `nova-3-general` vs `nova-3-medical` on the English lane
- does a keyterm list actually help, or does it force-fit invented words?
- is `filler_words=true` safe on Nova-3? (the code comment blames it for a dead
  EN socket, and nobody has ever tested that claim)

**What already exists (do not rebuild any of it).**

| Existing | Reused for |
|---|---|
| `scripts/dg-health-probe.js` | key loading from `.env`, HTTPS POST to `/v1/listen`, WAV synthesis |
| `src/utils/audioSelfTest.js` | the "score a clip against its script" precedent (confidence × recall) |
| `src/utils/sttEval.js` | all metrics, the frozen normalization, the table |
| `src/fixtures/eval/` | the manifest + gating pattern |
| `buildListenUrl` | the *exact* production query string, so the A/B tests the real request |
| jest | the report runner (`npm run eval:audio`) |

**Only three things are new:** the manifest, `scripts/eval-audio.js`,
`src/utils/sttAudioEval.test.js`. No production code path changes.

---

## The loop (10 minutes of your voice, once)

1. **Record.** Read the 24 scripted sentences in
   `src/fixtures/audio/manifest.json` (`say` is what to read). Anything you
   already recorded as `.m4a`/`.mp3`/`.webm` is fine.
2. **Convert** (ffmpeg is on this machine):
   ```powershell
   ffmpeg -i my-clip.m4a -ar 16000 -ac 1 -c:a pcm_s16le src\fixtures\audio\clips\en-01-albuterol.wav
   ```
3. **Transcribe + score:**
   ```powershell
   node scripts\eval-audio.js          # network: Deepgram only
   npm run eval:audio                  # offline: scores what step 2 produced
   ```

Step 3 sends each clip once **per config under test** (general, medical,
general+keyterm), writes the provider text to
`src/fixtures/audio/provider-text.json`, and never writes your key anywhere.

## Privacy rules (non-negotiable)

- **Never record a patient.** These are scripted sentences you read yourself.
  That is the whole reason this corpus is cheap: no PHI, so it can be committed
  and re-run by anyone.
- Only the *transcripts* are committed. Clips are committed too (they are your
  own voice reading generic medical sentences) — `.gitignore` already allows
  `*.wav`. If you would rather not commit audio, add
  `src/fixtures/audio/clips/` to `.gitignore`; the manifest and the scores still
  work, you just re-record the audio each time.
- The key is read from `.env.local` by the same code that already reads it, and
  is never printed.

## What the report tells you

The same table as `eval:stt`, plus one new column: **real WER** — provider text
from a real microphone against the script you read. Everything else (term acc,
digit recall, negation recall, the repair gain) now runs on real audio instead of
on text I invented.

And the A/B becomes a number per config:

| config | WER | terms | digits | invented terms | verdict |
|---|---|---|---|---|---|
| nova-3-general | … | … | … | … | baseline |
| nova-3-medical (EN) | … | … | … | … | keep if it wins |
| general + keyterm | … | … | … | … | **cut the list if invented > 0** |

## The gates (same discipline as the text corpus)

- **digits must be 100%** — a dose that drifts fails the build.
- **invented terms must be 0** for keyterm bias. A term that appears when you
  never said it is force-fitting: cut the list, do not tune the weights.
- Negation recall reported; a dropped `denies` is counted, never auto-fixed.

## Cost

24 clips ≈ 2 minutes of audio. Three configs ≈ 6 minutes of Deepgram audio —
**cents**, not dollars. Re-running is cheaper than one hour of your time.

## Related

[`stt-eval-plan.md`](../stt-eval-plan.md) §Stage 5 ·
`src/fixtures/eval/` (the text corpus this mirrors) ·
`docs/development/sensitive-data-approach.md`
