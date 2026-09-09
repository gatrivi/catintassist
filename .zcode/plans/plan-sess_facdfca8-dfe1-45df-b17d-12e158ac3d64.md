Soundboard readiness fixes (finish DIAGNOSIS-2026-09-07 fix-list item 2 + hardening)

1. **WebAudio ramp everywhere** — replace `setInterval` `rampVolume` in `audioRoute.js` with WebAudio `linearRampToValueAtTime` (already proven in `audioRoutePassthrough.js:8`). Kills the hidden-tab garble on the dual-element fallback + `OnCallSoundboardStrip` dual path (:235, :250).
2. **Un-swallow autoplay errors** — `play().catch()` in `audioRoutePassthrough.js:100` and `AudioSettingsContext.playClipToSink` surfaces a visible toast/badge ("clip blocked — click to retry") instead of a silent no-op.
3. **Mic-swap seam guard** — visibilitychange watchdog (`AudioSettingsContext.js:291-309`) must not rebind the mic while `sinkPlaybackActive`; check flag before rebinding.
4. **Force-migrate stale route pref** — one-time migration: stored `dual_element` pref from v4.86.x → `passthrough`.
5. **Loudness normalization on save** — peak-normalize clip to −1 dBFS on record/import in `audioRoutePassthrough.decodeBlobToBuffer` path (or editor export), so "sounds fine to me" ≈ what patient hears.
6. **Crossfade splices** — 5–10ms fade at silence-removal boundaries in `AudioEditorPanel.spliceAudioBuffer` to remove clicks.
7. **Small hardening** — guard `JSON.parse` of health cache (GreetingsPanel :186); re-snapshot gates when clip list changes in OnCallSoundboardStrip.

Verification: existing tests (`audioSelfTest`, `audioRoutePassthrough`, `soundboardMetaService`) + build green, then one push via `node scripts/safe-push.js` as a new version (number shown in UI). Voicemeeter external-mic mode stays out of scope (separate plan, docs/handoff/09).