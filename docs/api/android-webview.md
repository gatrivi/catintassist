# Android WebView — not a native app

## Official
- WebView: https://developer.android.com/reference/android/webkit/WebView
- Chrome Android media: same Web APIs; permissions differ from desktop

## This repo
- **Phone assistant** = browser mic mode, not a packaged WebView APK
- See: `docs/onboarding/mic-mode-phone-assistant.md`
- `getDisplayMedia` often missing/limited in embedded WebViews — we probe via `canUseTabCapture`

## Agent rules
- Prefer mic-mode docs over inventing native bridges
- Do not assume Chrome desktop tab-capture behavior on phone
