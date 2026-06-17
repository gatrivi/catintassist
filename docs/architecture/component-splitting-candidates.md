## Component Splitting Candidates (v4.48.9)

Use this doc when you want to answer interview prompts like:
- “How would you break up a large component without breaking behavior?”
- “Where would you extract pure logic?”

### `src/App.js` (app shell / orchestration)
Current mix (examples):
- workspace/view selection (off-call vs in-call)
- attach/connect/start/recovery handlers
- app-level UX (idle vignette, hotkeys, background loading)

Suggested split (logic vs presentational):
- Extract handlers into a hook:
  - `useAppCallActions()` (wraps calls to `useDeepgram` + `useSession`)
- Extract pure UX state machine helpers:
  - `getAppStateClass()` (call/break/idle class decision)
- Keep render as “layout only” (header, panels, workspace selection).

### `src/contexts/SessionContext.js` (God context)
Current mix (examples):
- call/break/avail timers + rollover + stats
- caption persistence
- HIPAA disconnect grace state machine + clear/finalize flows

Suggested split:
- Keep one provider, but internally split by “slice” modules:
  - `sessionSliceTimers` (timer state + tick logic)
  - `sessionSliceStats` (daily/monthly rollover)
  - `sessionSliceCaptions` (IndexedDB load/save + clear)
  - `sessionSliceHipaaGrace` (request/finalize + side-effects)
- Prefer pure reducers for the slice transitions (testable logic).

### `src/hooks/useDeepgram.js` (STT pipeline)
Current mix (examples):
- stream acquisition (tab vs mic)
- Deepgram websocket lifecycle + reconnection
- transcript sealing algorithm (sentence peel + comma chunking + overlap protection)

Suggested split:
- Extract pure transcript helpers to a module (deterministic):
  - `transcriptSealer.peelCompleteSentences()`
  - `transcriptSealer.peelCommaChunks()`
  - `transcriptSealer.buildSealedBubble()`
- Create layered modules:
  - `deepgramSocketManager` (open/close/reconnect + send audio chunks)
  - `audioStreamManager` (capture/stop tracks + tab stream ready key)
- Leave the React hook mainly as “wiring” between managers and SessionContext.

### `src/components/TranscriptionBoard.js` (transcript rendering)
Current mix (examples):
- bubble rendering layout + rail UI
- bubble split/collapse UX
- pinned captions + scroll behavior
- number protection/copy (phone/SSN/digit sequences)
- translation/TTS wiring per bubble

Suggested split:
- Extract pure helpers:
  - `bubbleHeuristics` (split/flow/tail remainder math)
  - `displayTextTransform` (spelling formatting, number word conversion)
- Extract small presentational components:
  - `BubbleRail` (already conceptually present)
  - `InteractiveText` → `InteractiveText.js`
  - `TranslatedBubble` → `TranslatedBubble.js`
  - `PinnedCaptions` section → `PinnedCaptions.js`
- Keep `TranscriptionBoard` as the list “orchestrator” only.

### `src/hooks/useTranslate.js` (translation policy + engine race)
Current mix (examples):
- translation triggers / throttling rules
- segmentation
- engine pool and race/fallback
- caching + sticky language pair

Suggested split:
- Extract pure policy:
  - `translationPolicy.shouldTranslate({normText, wordCount, mood, lastTranslated})`
- Extract engine clients:
  - `translationEngines.deepl()`, `translationEngines.openai()`, `translationEngines.googleGtx()`
- Keep `useTranslate` as orchestration:
  - debounce/abort + call policy + call engine pool + set state.

### `src/hooks/useTTS.js` (playback)
Current mix (examples):
- stop/play orchestration
- speech synthesis fallback
- sink routing + volume modulation

Suggested split:
- Keep the hook as orchestrator, but extract routing helpers into `utils/audioRoute`.
- If needed, extract browser synthesis into a small helper:
  - `tts/browserSpeechFallback(text, lang)`.

### `src/components/DashboardHeader.js` (sticky header)
Current mix (examples):
- session controls, timeline/heatmap UI, overlays (celebration particles)
- mixes audio/reward side effects, modals, and view switching

Suggested split:
- Extract presentational “layout widgets”:
  - `HeaderOverlays` (heatmap/time edit/particles)
  - `ProgressTimelineBar`
- Extract state machine / derived values:
  - `useHeaderViewModel()` (pure derived values from SessionContext + hook outputs)
- Keep side effects in hooks (`useRewardAudio` / `useProgressiveAudio`) so render is mostly static.

### `src/components/GreetingsPanel.js` + `src/hooks/useGreetingsPanel.js` (soundboard studio)
Current mix (examples):
- clip loading + storage export/import
- recording + audio processing graphs
- health checks + playback routing

Suggested split:
- Ensure most logic lives in the hook; keep `GreetingsPanel` as “studio UI renderer”.
- If the hook is still too large:
  - extract `soundboardStorageService` (load all blobs, export/import)
  - extract `greetingHealthCheck` (Deepgram request + scoring heuristic).

### `src/components/AudioEditorPanel.js` (audio editor)
Current mix (examples):
- waveform canvas + selection drag math
- silence detection and splicing flows

Suggested split:
- Extract pure DSP helpers already present in `useGreetingsPanel`/`utils` style:
  - silence detection, buffer splicing, peak building
- Create `useAudioEditor()` hook that owns:
  - selection state, playback state, edit actions
  - leave the panel as canvas + button layout.

