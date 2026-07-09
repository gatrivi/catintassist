# MediaStream / getDisplayMedia / getUserMedia

## Official
- `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- `getDisplayMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- MediaStream: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream

## This repo
- Tab share (production interpret): `getDisplayMedia({ video: true, audio: true })` — see `src/utils/inputSource.js`, `useAudioSource.js`
- Mic / phone assistant: mic mode — `docs/onboarding/mic-mode-phone-assistant.md`
- Capability probe: `canUseTabCapture` in `audioSourceManager.js` (missing in some embedded WebViews)

## Agent rules
- Tab capture needs a **user gesture**; do not auto-prompt in a loop
- Preserve tab stream across calls when the product already does (avoid re-permission spam)
- Mock/silent streams exist for tests — do not break those helpers
