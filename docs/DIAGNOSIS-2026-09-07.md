# Full App Diagnosis — 2026-09-07 (v4.86.8)

> Read-only audit. No code was modified. Sources: 3 parallel crawls (audio/STT/soundboard, translation, app shell/state) + full test run.

## TL;DR — top findings

1. **Translation "54s late" is explained by design**: global queue concurrency = 1, sequential segments, 4s timeout per engine, and a **dead first engine** (port mismatch 59200 vs 59210). Fix candidates are clear.
2. **Soundboard garbling**: default route is DUAL_ELEMENT — two `<audio>` elements fighting over the same virtual sink (the historically identified garble source), plus throttled `setInterval` volume ramps when the tab is hidden, and swallowed autoplay failures.
3. **Secrets in the client bundle**: `.env` ships `REACT_APP_DEEPGRAM_API_KEY` + Azure key baked into built JS. Anyone can extract them.
4. **Tests**: 407/410 pass. 3 failures: 2 in `audioRoutePassthrough.test.js` (tests still expect old default "passthrough", code now defaults DUAL_ELEMENT — tests not updated), 1 in `releaseNotes.test.js` (no release note entry for v4.86.8). `npm test` (batch runner) aborts on batch 1 failure, so batches 2–8 silently never run.
5. **Structure debt**: `DashboardHeader.js` 3,076 lines, `index.css` 6,721 lines, `SessionContext.js` is a non-memoized god-context (~60 values, all consumers re-render every tick). `ErrorBoundary` exists but is **never mounted**.
6. Docs drift: docs claim v4.84.29–4.85.15; code is 4.86.8. ROADMAP says auth "do not implement until approved" but Firebase auth is already shipped.

---

## 1. Test suite health (actual run)

- Direct run: **61 suites, 59 pass / 2 fail; 410 tests, 407 pass / 3 fail.**
- Failures:
  - `src/utils/audioRoutePassthrough.test.js` — "defaults to passthrough" and "invalid value falls back to passthrough" fail because `readRouteModePreference` now defaults to DUAL_ELEMENT (v4.86.2). Tests are stale, not necessarily the code.
  - `src/content/releaseNotes.test.js` — `getReleaseNoteForVersion('4.86.8')` returns null; no release-note catalog entry for the current version.
- `npm test` → `scripts/test-in-batches.js` **aborts at batch 1/8 on first failure** (exit 1). Batches 2–8 never execute — masked coverage. Recommend: continue-on-fail + summary.

## 2. Translation subsystem

Files: `src/hooks/useTranslate.js`, `src/utils/translation*.js`, `api/translate.js`, `scripts/local-translate-gateway.js`.

### Bugs (ranked)

1. **Port/path mismatch kills `local_stt` engine** — browser fetches `http://127.0.0.1:59200/stt/translate` (`translationEngines.js:228`) but the local gateway listens on **59210** and serves `/api/translate` (`local-translate-gateway.js:13`). First engine in the chain can never succeed → every caption pays a wasted timeout first.
2. **Global concurrency = 1** (`translationRequestQueue.js:6`) + sequential segment loop (`useTranslate.js:433-508`) + 4s timeout × 2 engines. A dead chain ≈ 8s/segment; a 6-segment monologue ≈ 48s + 800ms debounce ≈ the reported "54 seconds too late".
3. **Timer leak / unhandled rejections** — per-engine timeout promises never cleared (`translationEngines.js:288-291`).
4. **Gateway 503 never blacklists** — `no_provider_available` → `Error('gateway 503')` → classified `'error'` not `'limit'` (`translationEngines.js:316-322`), so the dead chain retries in full for every segment.
5. **Cache poisoning** — weak results are cached (`useTranslate.js:407`) and served indefinitely; `pruneStorage` wipes the whole cache >1000 entries instead of LRU (`useTranslate.js:34-39`).
6. **"Bueno" leak** — source-side filler guard only matches the exact word "bueno" (`useTranslate.js:318-322`); garbage rejection requires source ≥4 words/digits/punctuation (`translationApplicator.js:85-87`), so 2–3-word sources accept filler replies, which then get cached and frozen by the strength ledger.
7. **Split carry-over is exact-match only** — repunctuated prefix after a split forces refetch of the whole prefix through the 1-slot queue (`useTranslate.js:425-448`); segment ids are positional so old entries orphan on split.
8. **Effect cleanup aborts in-flight work on any dep change** (e.g. `prefetchTTS` identity, `correctionsRev`) — `useTranslate.js:559-562`.
9. Dead code: `lastAzureOutcome` (never set), `keys` param in `buildEngineChain`, `prevSegmentsRef`, stale `ENGINE_LABEL` map in `TranslationStatusBar.js:14-20` (advertises engines that no longer exist browser-side).
10. Minor: sanitize false-positives on "LIMIT"/"FORBIDDEN" substrings (`translationEngines.js:185-199`); passthrough-overlap threshold rejects proper-noun/number-heavy short sentences; DeepL always `api-free.deepl.com` even with pro keys (`api/translate.js:27`); translation keys in plain localStorage.

### Positives

Strength ledger (`preferStronger`) + v4.86.1 freeze correctly enforce "weaker never overwrites stronger" per segment; good fixture replay harness (14 scenarios); engine blacklists/cooldowns exist.

## 3. Audio / STT / Soundboard

Files: `src/utils/audioRoutePassthrough.js`, `audioRoute.js`, `audioSourceManager.js`, `src/contexts/AudioSettingsContext.js`, `src/components/GreetingsPanel.js`, `OnCallSoundboardStrip.js`.

### Soundboard garble — root-cause candidates (ranked)

1. **DUAL_ELEMENT default (v4.86.2)** — greeting element + live mic element both feed CABLE Input; the call app's echo cancellation/noise suppression reacts to the sudden clip → ducking/chop on patient side. `routeDiagnostics.js:67-80` warns about exactly this but only logs. `docs/soundboard/voicemod-comparison.md` already named "two elements fighting for the same virtual sink" as the garble source.
2. **Throttled `rampVolume`** — 10ms `setInterval` (`audioRoute.js:26-41`); when the browser tab is hidden (interpreter focuses the call window!), the interval throttles to ≥1s → clip plays at near-zero or mid-ramp volume. Likely matches "breaks up whenever I focus the call app".
3. **Swallowed autoplay failure** — `await passthroughEl.play().catch(() => {})` (`audioRoutePassthrough.js:99`) — silent no-op to patient, no diagnostic.
4. **Mic swap seam** — in passthrough mode `srcObject` is detached/restored around each clip with an async gap (`audioRoutePassthrough.js:73-87`, `AudioSettingsContext.js:304-361`); stale-mic restore if device changes mid-clip; the visibilitychange watchdog can rebind mic over a playing clip.
5. **Double transcode + hard splices** — MediaRecorder opus → PCM → MediaStreamDestination re-encode; `AudioEditorPanel` "remove silences" splices with **no crossfade** (`AudioEditorPanel.js:385-396`, `spliceAudioBuffer` :62-76) → clicks at every boundary.
6. **CPU contention** — clip decode + new AudioContext per clip + rAF progress + Deepgram WS on the main thread during calls.

### Other bugs

- `JSON.parse(localStorage 'catint_audio_health')` without try/catch — corrupted cache crashes GreetingsPanel (`GreetingsPanel.js:171`).
- `isAnalyzing` single-slot — concurrent analyses clear each other's spinner (`GreetingsPanel.js:441/458`).
- `OnCallSoundboardStrip` snapshots health/CALL-OK once on mount — never refreshes from Studio (`:64,71`).
- `window.__CAT_AUDIO_VOL` fabricates random mic-level telemetry during playback (`GreetingsPanel.js:545`).
- `dg-health-probe.js` browser-WS path sends the key as a WS subprotocol — always fails in browsers; verdict logic duplicated with `deepgramDiagnostics.js` (drift risk).
- `AudioRouteStatusBar.js:189` renders `Date.now()` during render (impure).
- STT pipeline itself (captionEngine, stableLiveTranscript, sensitiveDataProtector, number guards) is solid and well tested.

## 4. App shell, state, security, docs

### Security (highest priority)

- **`.env` contains live-looking `REACT_APP_DEEPGRAM_API_KEY` and `REACT_APP_AZURE_TRANSLATOR_KEY`.** Any `REACT_APP_*` value is baked into the client bundle at build time → extractable by anyone using the deployed app. Same exposure class the handoff rules ban for translation. Recommend rotating keys + proxying through the gateway.
- Firestore rules are correctly owner-scoped; deleted nty.sh sync vector is gone.

### Structure debt

- `DashboardHeader.js` **3,076 lines** (6+ components inside), `index.css` **6,721 lines**, `useDeepgram.js` 1,629, `TranscriptionBoard.js` 1,527, `GreetingsPanel.js` 1,455, `App.js` 1,012, `SessionContext.js` 967.
- `SessionContext` exposes ~60 values, **provider value not memoized** → every consumer re-renders every timer tick. Biggest perf lever.
- `ErrorBoundary` component exists but is **never mounted** in `App.js` — the v4.57 "ErrorBoundary" feature is inert.
- Prop drilling: DashboardHeader receives ~30 props, GameScoreboard ~30, mostly duplicates of SessionContext.
- Duplicated: idle-seconds interval (App.js:435 + GameScoreboard.js:507), tip-rotation 12s interval (×2), `toggleQuickNotes` (×2), quick-notes focus timeout (×2), stats-persist effect (identical twice in SessionContext :323 and :728, plus inline persists).
- Fire-and-forget `setTimeout`s without unmount cleanup in DashboardHeader celebrations (:1178-1197) and App.js (:60-64, :202-205, :252).
- Unguarded top-level `fetch` to an exchange-rate API on every load (`SessionContext.js:493-501`).
- Window CustomEvents used as an event bus (~12 listeners in App.js alone) — hard to trace.

### Docs vs code drift

- Version: docs README "v4.84.29", handoff "v4.85.15", code **4.86.8** — three-way manual bump is failing; consider single-source with script.
- ROADMAP Phase 2 says Supabase auth "Do not implement until approved" — Firebase Google auth + Firestore sync already shipped.
- `TranslationStatusBar` labels advertise engine names (deepl/azure/openai…) that no longer exist browser-side.
- Repo clutter: `console-errors-typical.txt` (91KB), `test_out.txt`, `cable.txt`, `todo.txt`, `graphify-out/`, `trash/`, `logs/`, `test_full_run.log`/`test_direct.log` (created by this audit — safe to delete).

### Build config

- `npm run build` wraps react-scripts with `build-with-local-temp.js` (TMP redirect) — a Windows workaround, not a fix.
- CRA 5 + React 19 is outside react-scripts' supported pairing; no TypeScript, no CI.

## 5. Test coverage gaps

- Zero tests: `DashboardHeader`, `SessionContext`, `App.js`, `useDeepgram`, `GreetingsPanel` (1,455 lines of gating/playback orchestration), `OnCallSoundboardStrip`, `AudioSettingsContext` (mic-restore/stop races), `audioRoute.js`, `AudioEditorPanel` PCM/splice logic, `api/translate.js` (SigV4!), `local-translate-gateway.js`, `TranslationStatusBar`, `TranslationKeysForm`.
- No timing/latency tests for the translation queue (the 54s complaint), no cache-poisoning tests, no filler-vs-short-source test, no autoplay-failure path tests.
- Batch runner masks failures (see §1).

## 6. Recommended fix order (when you green-light changes)

1. Translation latency: fix port mismatch → kill or repair `local_stt`; raise queue concurrency; blacklist on 503; don't cache weak results. (Directly addresses "54s too late".)
2. Soundboard: flip default back to PASSTHROUGH or fix dual-element muting; replace `setInterval` ramp with WebAudio ramp; un-swallow autoplay errors; add crossfade in silence splices. (Addresses "patients scream in pain".)
3. Security: rotate + proxy Deepgram/Azure keys out of the client bundle.
4. Fix the 3 failing tests + batch runner continue-on-fail.
5. Mount ErrorBoundary; memoize SessionContext value; split DashboardHeader.
6. Docs version single-sourcing + ROADMAP auth reconciliation.

— End of diagnosis. No code modified. Test logs left at repo root: `test_full_run.log`, `test_direct.log`.
