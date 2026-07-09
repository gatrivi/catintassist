# Deepgram (live STT)

## Official
- Docs: https://developers.deepgram.com/
- Live streaming: https://developers.deepgram.com/docs/live-streaming-audio
- JS SDK patterns: WebSocket URL + API key; binary audio frames

## This repo
- Hot path: `src/hooks/useDeepgram.js`
- Apply payload / fixtures: caption engine + `docs/development/transcription-test-harness.md`
- Do **not** invent REST polling for live captions — we use streaming WS

## Agent rules
- Prefer fixing shared apply/protect helpers over per-bubble hacks
- Never drop digit sequences while “cleaning” interim text
- Reconnect/zap paths must not thrash UI (see ui-thrash rule)
