# Translation incident assessment - 2026-09-03

## Live finding

`http://127.0.0.1:59200/health` refused the connection. The local translator was not running.

## Intended route

`useTranslate` sends one request at a time:

1. `local_stt` -> `POST http://127.0.0.1:59200/stt/translate`
2. `/api/translate` Vercel gateway when local is unavailable
3. Server gateway tries configured Azure, DeepL, Google Cloud, AWS, then MyMemory.

The local provider is the CATTS **CTranslate2 Marian EN<->ES bridge**. It should be the normal path; it is faster and more consistent than an unconfigured or free remote fallback.

## What the call samples mean

- Missing/slow/weak translations can be caused by the local provider being down and the gateway fallback taking over.
- `You guys are in the same Okay.` and `You guys the safe location at the main entrance.` are already bad English STT source. Translation cannot restore words Deepgram did not recognize; literal Spanish is expected downstream behavior.
- A one-word `Okay.` may stay `Okay.` because short weak results are deliberately accepted instead of blank. This is a quality limitation, not proof that the local translator was used.

## Safe next check (when not on a call)

1. Start or restore the CATTS local translation service.
2. Verify `GET http://127.0.0.1:59200/health` succeeds.
3. Verify a real `POST /stt/translate` EN->ES and ES->EN response.
4. Make one short live call test. Check whether the bad wording begins in the transcription column (STT/audio) or only in translation.

Do not send patient transcript text to a new browser-side provider as a quick fix. Keep the local-first, gateway-only browser boundary.
