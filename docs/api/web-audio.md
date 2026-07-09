# Web Audio API

## Official
- MDN: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- `AudioContext` / `AudioBufferSourceNode` / `MediaStreamAudioSourceNode`
- Autoplay: context often starts `suspended` until a user gesture → `resume()`

## This repo
- Soundboard / greetings: `src/components/GreetingsPanel.js`
- Decode/play helpers: `src/utils/audioRoutePassthrough.js`, `audioSourceManager.js`
- Rewards / progressive: `useRewardAudio.js`, `useProgressiveAudio.js`
- Editor: `AudioEditorPanel.js` (`OfflineAudioContext`)

## Agent rules
- Local speakers ≠ patient sink — route bugs hurt patients even when “sounds fine”
- Do not block decode/play with heavy React work on the same tick as start
- Prefer existing helpers; do not add a second AudioContext graph unless required
