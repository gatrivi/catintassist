# Graph Report - .  (2026-07-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 924 nodes · 2777 edges · 35 communities (28 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `60526323`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34

## God Nodes (most connected - your core abstractions)
1. `GreetingsPanel()` - 37 edges
2. `useDeepgram()` - 36 edges
3. `Dashboard()` - 34 edges
4. `useSession()` - 32 edges
5. `useTranslate()` - 28 edges
6. `SettingsPanel()` - 25 edges
7. `TranscriptionBoard()` - 25 edges
8. `DashboardHeader()` - 18 edges
9. `useProgressiveAudio()` - 18 edges
10. `reduceTranscriptEvent()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `CelebrationParticles()` --calls--> `useProgressiveAudio()`  [EXTRACTED]
  src/components/DashboardHeader.js → src/hooks/useProgressiveAudio.js
- `DashboardHeader()` --indirect_call--> `loadLanguagePair()`  [INFERRED]
  src/components/DashboardHeader.js → src/utils/languageConfig.js
- `SettingsPanel()` --indirect_call--> `loadSttLatencyMode()`  [INFERRED]
  src/components/SettingsPanel.js → src/utils/deepgramListenConfig.js
- `SettingsPanel()` --indirect_call--> `loadLanguagePair()`  [INFERRED]
  src/components/SettingsPanel.js → src/utils/languageConfig.js
- `useDeepgram()` --indirect_call--> `readMicTestMode()`  [INFERRED]
  src/hooks/useDeepgram.js → src/utils/micMode.js

## Import Cycles
- None detected.

## Communities (35 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (65): ACTIONS, buildWaveformPeaks(), getActionClipKeys(), getActionCompletion(), getActionSlotPills(), getSetupStats(), GreetingsPanel(), isCallerReady() (+57 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (54): focusQuickNotesSoon(), CHORES, ChoreTrackerWidget(), getTodayStr(), loadState(), saveState(), DashboardHeader(), DeskExerciseWidget() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (64): StableLiveTranscriptText(), processDisplayText(), renderTokenText(), SensitiveSpan(), StableTextMorph(), diffWordsStable(), isAppendOnlyMorph(), isProtectedToken() (+56 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (50): AudioRouteStatusBar(), BubbleCorrectionEditor(), GameScoreboard(), NewcomerIdleGuide(), OffCallWorkspace(), commonWordPrefixLen(), getBubbleStyle(), InteractiveText() (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (54): isTestHarnessEnabled(), tabBtn, TestHarnessPanel(), getTranscriptionFixture(), TRANSCRIPTION_FIXTURE_LIST, TRANSCRIPTION_FIXTURES, deepgramKeyRejectedMessage(), isLikelyMobile() (+46 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (52): TranslatedBubble(), TRANSLATION_FIXTURES, acceptTranslation(), emptyMeta, getCached(), pruneStorage(), resolveTranslateDebounceMs(), setCached() (+44 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (49): Dashboard(), CATEGORY_LABEL, ConnectionDiagnosticsBar(), mk(), base64ToBuffer(), bufferToBase64(), decryptToken(), DeepgramKeyVault() (+41 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (33): MOOD_LABELS, MOODS, SettingsPanel(), tabBtn, clearBtn, inputStyle, saveBtn, TranslationKeysForm() (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (25): App(), ErrorBoundary, ReleaseNotesModal(), mockNote, UI, getCopyForLang(), getReleaseNoteForVersion(), RELEASE_NOTES_CATALOG (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (34): ENGINE_LABEL, REASON_LABEL, TranslationStatusBar(), BLACKBOX, BLACKBOX_REASONS, BLACKBOX_TTLS, blacklistEngine(), buildEngineChain() (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (31): DevSimulatePanel(), fire(), tabBtn, useDevSimulate(), appendCaption(), attachDevSimConsole(), createDevCaption(), DEV_SIM_PRESETS (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (30): AuthPanel(), btn, input, firebaseConfig, isFirebaseConfigured(), AuthContext, AuthProvider(), useAuth() (+22 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (28): Dot(), dotColor(), selectStyle, useAudioSource(), acquireAudioStreamForSource(), buildVirtualCableFailureUiState(), buildVirtualCableGetUserMediaConstraints(), canUseTabCapture() (+20 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (21): CelebrationParticles(), SessionControlsSticky, ChevronDownIcon(), ChevronUpIcon(), CoffeeIcon(), EditIcon(), FocusIcon(), FocusOffIcon() (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.23
Nodes (20): btnStyle, CorrectionsBackupPanel(), applySttCorrections(), clearCorrections(), CORRECTION_KIND, emitChanged(), escapeRegex(), exportCorrections() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (14): commonPrefixLen(), ScrambleText(), SplashScreen(), DEFAULT_BG_FILES, getNextDefaultBackgroundUrl(), peekDefaultBackgroundUrl(), publicBgUrl(), readDefaultBgIndex() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (13): AppGuideButton(), AppGuideOverlay(), getGuideSteps(), GUIDE_STEP_IDS, GUIDE_UI, STEP_DEFS, GuideHostContext, GuideHostProvider() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (8): StateIndicators(), KeyIcon(), PlayIcon(), StopIcon(), formatTime(), SessionStatusTimers(), SlotMicroValue(), TimeEditModal()

### Community 18 - "Community 18"
Cohesion: 0.36
Nodes (12): btn, Phase0SmokeDashboard(), statusColor, emptyState(), isPhase0SmokeEnabled(), loadPhase0SmokeState(), PHASE0_SMOKE_ITEMS, probePhase0LiveStack() (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.32
Nodes (9): audioBufferToBlob(), AudioEditorPanel(), buildPeaks(), detectSilences(), formatTime(), pcmToWavBlob(), spliceAudioBuffer(), createNoiseGate() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (6): CalendarIcon(), GridIcon(), SettingsIcon(), SunIcon(), SettingsButton(), StatNumber()

### Community 21 - "Community 21"
Cohesion: 0.31
Nodes (9): buildElementSelector(), buildHintPayload(), clamp(), ElementHintContext, ElementHintPanel(), ElementHintProvider(), ElementHintTarget(), placementStyle() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.32
Nodes (6): ConnectInterpretButton(), modeIconFor(), BookmarkIcon(), HeadsetIcon(), MicIcon(), RobotIcon()

### Community 23 - "Community 23"
Cohesion: 0.46
Nodes (6): applyMedicalBias(), lexiconForLang(), MEDICAL_TERMS_EN, MEDICAL_TERMS_ES, normalizeToken(), scoreTermPriority()

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): StudioIcon(), hasSeenStudioHint(), markStudioHintSeen(), VIEW_META, WorkspaceViewSwitcher()

### Community 25 - "Community 25"
Cohesion: 0.40
Nodes (3): HEIGHT_BY_SIZE, LiveRollingNumber(), RollingNumber()

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (3): DOW, MonthHeatmap(), TIERS

## Knowledge Gaps
- **82 isolated node(s):** `selectStyle`, `btn`, `input`, `CATEGORY_LABEL`, `btnStyle` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useSession()` connect `Community 1` to `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 10`, `Community 13`, `Community 17`, `Community 18`, `Community 26`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `loadLanguagePair()` connect `Community 3` to `Community 1`, `Community 4`, `Community 5`, `Community 7`, `Community 10`, `Community 13`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `useTranslate()` connect `Community 5` to `Community 9`, `Community 10`, `Community 3`, `Community 14`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useDeepgram()` (e.g. with `readTabStreamReady()` and `readMicTestMode()`) actually correct?**
  _`useDeepgram()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `selectStyle`, `btn`, `input` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07438271604938272 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08181126331811263 - nodes in this community are weakly interconnected._