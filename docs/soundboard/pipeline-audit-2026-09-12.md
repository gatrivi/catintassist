# Soundboard greeting pipeline — full audit (2026-09-12, v4.108.1)

Purpose: single document a senior reviewer (or higher-level model) can use to
diagnose **"recorded greetings don't reach the patient correctly"** without
re-crawling the repo. Facts only; hypotheses are labeled as such in §15.
Verified against working tree at v4.108.1 (see §0.1 for dirty-tree caveat).

## 0. TLDR + how to use this doc

### Follow-up corrections (v4.108.2)

- **App defect confirmed:** the direct context needed `resume()` and `setSinkId()` before playback. The pending v4.108.1 sink-change guard still fell through to the old output; v4.108.2 cancels across all fallback callers, including Stop/Restore during decoding. Provider regression tests added.
- **Inspection defect:** Standard has two mix buses: A=`Bus[0]`, B1=`Bus[1]`. A1/A2 are physical selectors sharing A, not separate mix buses. The old script's `Bus[2]` reading did not verify B1. Potato virtual strips start at 5, not 3. [Official API, pp. 11–14, 23–24](https://download.vb-audio.com/Download_CABLE/VoicemeeterRemoteAPI.pdf).
- **Live read-only observation (corrected inspector):** Realtek mic and VAIO both route to B1; mic, VAIO and actual B1 (`Bus[1]`) are unmuted at 0 dB. Preferred/mic/A1 rates report 48000 Hz. A1 still selects CABLE Input. With VAIO→A enabled, greetings can feed the transcription cable. Change A1 to the headset off-call. These settings do not prove signal delivery.
- **Evidence limits:** duplicate labels alone do not prove a ghost endpoint; successful `setSinkId` cannot prove audible delivery. Sample-rate differences alone do not establish a garble cause. The claims below that ghosts must fail loudly or 44.1 kHz must garble are hypotheses, not established facts.
- **Target selections for this rig:** app greeting output = Voicemeeter Input; app transcription input = CABLE Output; call-site microphone = Voicemeeter Output / Out B1. Using B1 for transcription would capture outgoing speech/greetings.
- Still pending: off-call greeting → VAIO meter → B1 recording → call-site microphone verification. No patient-side success claimed.

- Signal chain: **mic → MediaRecorder (webm/opus) → IndexedDB → Deepgram
  health score → manual CALL OK → VB-out picker → direct-sink 48 kHz render
  (v4.104+) → Voicemeeter Input → B1 → call-app mic**. Passthrough-element
  swap and dual-`<audio>` are fallbacks only.
- Patient-side proof is **human attestation everywhere** — no automated
  remote verification exists. `SINK PLAYED` = browser rendered; `CALL OK` =
  user said the caller heard it.
- Biggest known code defect (fixed v4.108.1, this tree): `playClipToSink`'s
  direct path never called `resume()` + `setSinkId()` — clips rendered to
  default speakers instead of Voicemeeter. Verify the fix on hardware (§15.1).
- Biggest remaining structural risks: ghost-twin endpoints (silent no-needle),
  A1=CABLE Input STT-echo, `playClipToSink` hook has zero unit tests, external-
  mic mode (09 safeguards) is **not implemented**.
- Review entry: §1 map → §15 hypotheses → §16 repro/checklist.

### 0.1 Tree state when audited

- `src/constants/version.js:2` = `4.108.1`; `package.json:3` = `4.108.1`
  (`package-lock.json` stale at 4.96.5 — repo norm, not synced per release).
- Dirty/unrelated at audit time (NOT this audit's changes, do not attribute):
  modified `docs/push-log.md`, `docs/soundboard/voicemeeter-mic-plan.md`,
  `scripts/setup-voicemeeter-mic.ps1`, `src/hooks/useDeepgram.js`;
  untracked `src/utils/ringSignature.js` + `.test.js` (1 unrelated test failure,
  §13.4), stray media `a9y3dgm_460sv.mp4`, `ae9X3ZB_460sv.mp4`,
  `double-session-notes-bug.png`.
- This audit's own change set: `src/contexts/AudioSettingsContext.js`
  (v4.108.1 resume+setSinkId+stale-sink guard), `src/constants/version.js`,
  `package.json`, `src/content/releaseNotes.js` (4.108.1 entry). **Not pushed.**

---

## 1. End-to-end stage map

| # | Stage | Code | Stores / keys |
|---|-------|------|---------------|
| 1 | Record / upload | `GreetingsPanel.js:675-748` `startRecording/stopRecording`, `:614` `handleFileUpload`, `AudioEditorPanel.js:406-477` re-record | `CATINTASSIST_REC_MIC_ID`, `CATINTASSIST_MIC_ID` |
| 2 | Persist | `storage.js:18-36` IDB `saveFile/loadFile`, `recordingFileNaming.js` | IDB keys = clip keys (§3); `thumb_<id>`, `bg_app` |
| 3 | Backup / restore | `:411-511` JSON export/import, v4.105.0 disk Download/Upload | filenames ARE keys (`greeting_en_morning.webm`) |
| 4 | Edit | `AudioEditorPanel.js` (live) vs `exports/audio-greeting-editor/` | save → mono 16-bit WAV, re-runs health check |
| 5 | Catalog / slots | `ACTIONS:148-175`, `TIME_SLOTS:39`, `resolvePlayableClip:68-76`, `OnCallSoundboardStrip:22-48` | `greeting_en/es_{morning,afternoon,evening}` |
| 6 | Legibility gate | `audioSelfTest.js:142-161`, `GreetingsPanel:627-657` | `catint_audio_health`, `catint_audio_health_heard` |
| 7 | Route gate (CALL OK) | `routeVerification.js`, gates in both fire paths | `catint_manual_call_ok_v1` (family fp) |
| 8 | Sink pick | `audioSourceManager.js`, `audioDeviceLabels.js`, `AudioRouteStatusBar.js` | `CATINTASSIST_SINK_ID`, `CATINTASSIST_SINK_EXPLICIT` |
| 9 | Fire → patient | `AudioSettingsContext:344-448` → `audioRouteDirect` → fallback `audioRoutePassthrough` → fallback dual `<audio>` | `CATINT_ROUTE_MODE(+_MIGRATED)`, `CATINTASSIST_SINK_VOL` |

Target acoustic path (Voicemeeter Standard):
`physical mic → Voicemeeter Strip[0] → B1 → "Voicemeeter Output" (call-app mic)`;
`app greetings → "Voicemeeter Input" (VAIO Strip[2]) → B1 → same`;
`call audio → CABLE Input → CABLE Output → app STT + Windows Listen` (unchanged).
Source: `docs/soundboard/voicemeeter-mic-plan.md:9-21`.

---

## 2. Recording (capture)

File: `src/components/GreetingsPanel.js:675-748`.

- Constraints (`:683-690`): `{ deviceId: exact recMicId?, echoCancellation:false,
  noiseSuppression:false, autoGainControl:false }`. **No `sampleRate` /
  `channelCount`** — browser default. Raw-mic policy (v4.95.1: browser DSP
  chops speech, tanks legibility).
- Mic select (`:682`): `selectedRecMicId || selectedMicId`
  (`AudioSettingsContext.js:32`, `:497-499`; UI `SettingsPanel.js:734-751`,
  `""` = same as call mic).
- Stale-mic retry (`:691-698`, v4.103.0): exact-id fail → one retry on default
  mic; no id → real permission error thrown.
- Format (`:700-701`): `{ mimeType:'audio/webm;codecs=opus',
  audioBitsPerSecond:128000 }` if `isTypeSupported`, else browser default.
- Blob (`:732-733`): `new Blob(chunks, {type: recorder.mimeType ||
  'audio/webm'})` → `handleFileUpload` → `saveFile` → `reloadData` → auto
  `analyzeHealth` (non-bg/thumb keys).
- Level meter (`:705-726`): throwaway `AudioContext` + `Analyser fftSize=256`,
  `#record-vol-bar` width%. Not persisted.
- Errors (`:743-746`, v4.103.0): `NotAllowedError` → "Microphone access
  denied…"; else `Could not open microphone (${name})… Pick another mic…`.
- Editor re-record (`AudioEditorPanel.js:406-477`) DIFFERS: `{ EC:true,
  NS:true, AGC:false, sampleRate:{ideal:48000}, channelCount:{ideal:1} }`
  (`:412-419`), `AudioContext({sampleRate:48000})` + speech graph + noise gate
  (`:422-428`), `webm/opus @256000` (`:430-432`), splice-in via decode
  (`:456-463`). Open question: Studio-128k-DSP-off vs editor-256k-DSP-on —
  which wins legibility? Unresolved.

## 3. Storage, naming, backup, orphans

File: `src/utils/storage.js` (idb-keyval, raw keys, no quota handling —
`saveFile:18-26` returns false on `QuotaExceeded`, no UI).

- `saveFile/loadFile(+normalizeStoredBlob:4-16)/deleteFile/listStorageKeys`
  (`:18-55`); `getAllFileEntries:58-71` (v4.105.0 disk-backup feed);
  `getStorageSummary:73-87` (counts only); `exportStorageBackup:89-102`
  (`{v:1,exportedAt,items:{key:{type,data:[u8]}}}`); `importStorageBackup:104-116`;
  `generateObjectUrl:118-121`.
- Naming `recordingFileNaming.js:46,49`: `fileNameForBlob(key,blob)=key.ext`,
  `keyFromFileName` strips path + ONE ext. Map `:7-32` webm/ogg/mp3/m4a/wav +
  png/jpg/webp/gif; unknown → `bin` (`:37`). `greeting_en_morning.v2.webm` →
  wrong key, silently skipped on upload. Open question, not a crash.
- `reloadData (GreetingsPanel:292-319)`: `thumb_<action.id>` ×25 +
  `${id}_${slot}` (dynamic) or `${id}` + `bg_app`. `getExpectedStorageKeys
  (:402-409)` = same set. Orphans listed `storageSummary.keys - expected`
  (`:1332-1341`).
- Disk backup v4.105.0 (`:450-511`): Download = one `a.click()` per
  `getAllFileEntries` (300 ms gap); Upload accepts only known-or-existing keys
  (`:486-489`), repairs MIME via `extToMime` (`:493-494`), junk → `skipped[]`.
  `getAllFileEntries` downloads orphans too — re-upload resurrects retired
  `open_client/open_lep`. Flagged, desired-or-not unknown.
- Retired carry-over (never deletes): `open_client → greeting_en_morning`
  (`:320-358`, iff no `greeting_en_*`) and `open_lep → greeting_es_morning`
  (`:359-397`), each copying health/heard stores + rewriting CALL OK
  fingerprints (`open_client|` → `greeting_en_morning|` etc.).
  Canonical map `soundboardMetaService.js:22-23`:
  `RETIRED=[open_client,open_lep]`, `CANONICAL={open_client:greeting_en,
  open_lep:greeting_es}`.

## 4. Editing + gain

- Live editor wired `GreetingsPanel:1149-1173` (`editingKey && blob` → modal;
  `onSave:1161-1164` = `handleFileUpload` → re-runs health check).
- Live `src/components/AudioEditorPanel.js` vs export pack
  `exports/audio-greeting-editor/`: decode/peaks/silence-detect
  (`thr=0.015,min=0.25s,20ms RMS`) identical; **crossfade differs — live
  `:62-84` 8 ms fades both seams, export `audioEditorCore.js:60-74` plain
  splice** (drift or un-backported fix, unknown).
- Save (`:86-94`): `OfflineAudioContext(1,len,sr)` → mono 16-bit WAV
  (`pcmToWavBlob :6-33`), keeps edit-ctx rate. So an edited clip changes
  container (webm→wav) + channels (→1) + rate (→edit rate).
- Gain: `normalizePeak(buffer, -1 dBFS)` (`audioRoutePassthrough.js:59-77`)
  mutates the **playback buffer only** (`playBufferViaPassthrough:149`,
  `playBufferDirect:117` in audioRouteDirect). Stored file is NOT normalized —
  health score may not equal patient level. Open question.
- Speech chain (editor play + re-record): `audioProcessing.js`
  HP80 + peak 2.5k + 4dB/4k + 2dB + comp (export copy `:3-50` same).

## 5. Clip catalog + time slots

- `ACTIONS (GreetingsPanel:148-175)`: 25 ids — `greeting_en/es dynamic:true`
  + 23 static (`intake, hold_policy, hold_exc_en/es, sign_off, anyone,
  callout, closer_louder, limit_40_en/es, direct_dial, repeat, segments,
  interrupt, static_cover, ghost, disengage_offer, blocked_intake, voicemail,
  operator_12241, closing, signoff_lep`). Retired ids live only in comments
  (`:161-162`).
- Slots: `TIME_SLOTS=[morning,afternoon,evening] (:39)`,
  `TIME_SLOT_META (:40-44)`, auto by hour `<12/<17/else (:266-276)`.
- `resolvePlayableClip(action,timeOfDay,blobs) (:68-76)`: prefer
  `${id}_${slot}` → else first saved variant → else null. Used by Studio tiles
  (`:1706`) and preflight (`:1370`).
- On-call `ON_CALL_SLOTS (OnCallSoundboardStrip:22-30)`: 7
  (`greeting_en/es` dynamic + `hold_exc_en/es, sign_off, closer_louder,
  intake`); `resolveClipKey (:39-40)`, `resolveFireKey (:43-48)` same fallback
  (static → preferred even if missing). Strip loads only current-slot keys +
  `thumb_<actionId>` (`:122-125`) — fallback can miss other-slot blobs until
  `timeOfDay` ticks / after Studio save. Flagged staleness.
- Scripts/teleprompter `soundboardMetaService.js`: 22 items (`:36-80`),
  slot-aware `slotText` for EN/ES openers (`:42-55`), `getScriptForClip(:211)`,
  reseed (`ensureHandbookSeed :120-177`), store `catint_soundboard_meta_v1`.

## 6. Legibility gate (Deepgram health)

File: `src/utils/audioSelfTest.js`.

- Tiers `classifyHealthScore (:89-95)`: `≥0.9 PEACHES / ≥0.75 GOOD /
  ≥0.5 PASSING / else UNACCEPTABLE`; null → `UNTESTED`. Display
  `formatHealthDisplay (:105-113)`, `CLIP_HEALTH_MIN=0.5 (:175)`,
  `isClipHealthOk (:178)`.
- Probe `analyzeClipLegibility(blob, apiKey, expectedText) (:142-161)`:
  `POST api.deepgram.com/v1/listen?model=nova-3-general&smart_format=true&
  language=${lang}`, lang sniffed from script diacritics (`:144`); `score =
  confidence × recall` (`:159`); `<3 chars → {score:0.1} (:157)`.
  `scoreTranscriptRecall (:126-134)` order-insensitive vs script.
  `analyzeHealth (GreetingsPanel:627-657)` persists score + `{text, recall,
  confidence, at}`, dispatches `catint_gates_updated (:645)`.
- `explainHealth (:185-219)`: barely-heard / script-mismatch / unclear /
  borderline branches; shown on UNACCEPTABLE cards + preflight fail.
- Preflight pure (`:225-247`): `getPreflightSteps({hasClip, healthScore,
  callPathOk, awaitingConfirm})`, `isPreflightReady = quality==ok &&
  caller==ok`.
- Stores: `catint_audio_health (:211)`, `catint_audio_health_heard (:212-214)`;
  on-call strip re-reads + refreshes on `storage|focus|catint_gates_updated`
  (`OnCallSoundboardStrip:72-78,101-114`).
- v4.103.0 policy (user agency): weak/failed legibility **warns, never
  blocks** — interpreter decides (e.g. afternoon take scored vs wrong script).
  CALL OK stays the hard gate.

## 7. Route gate (manual CALL OK)

File: `src/utils/routeVerification.js` (v4.71.0; slot-family v4.104.0).

- Fingerprint (`:9-14`): `routeFamilyKey` strips `_(morning|afternoon|evening)`;
  `buildRouteFingerprint = family|sinkId|micId`. Changing VB-out or mic
  invalidates; slot rollover does NOT (morning/afternoon/evening share one
  proof).
- Store `catint_manual_call_ok_v1 (:3)` `{fp: {at, clipKey, sinkId, micId}}`;
  `isManualCallOk (:35-38)`, `setManualCallOk (:40-53)`;
  legacy `catint_call_path_verified` ignored (`warnLegacyCallPathStorage
  :56-66`).
- Studio enforcement `playAudioBlock (:858-879)`: `sendToCaller =
  routeToVirtualMic && !localOnlyPlayback`; `!callOk` → persistent
  `📡 LOCAL ONLY — run Call Test + CALL OK…` + `sendToCaller=false`; weak
  health → `⚠ …firing anyway` + `PLAY_START{healthBypass:true}` (auto-clear
  4.5s). `bypassGate:true` (Call-Test Send) skips the gate for the test fire.
- On-call enforcement `fireClip (:217-237)`: `!callOk` → `📡 CALL OK required
  — test off-call first` + return (no bypass param); weak health → warn-only;
  `!selectedSinkId` → `⚠️ Pick VB out…` + return.
- Badges `getRouteBadge (:548-565)`: `CALL OK ✓` vs `SINK PLAYED` (pending
  confirm `{clipKey, fingerprint, playedAt}`). Confirm UI
  (`:567-581`, settings-mode banner): `Yes, mark CALL OK` / `No`.
- **CALL OK is human attestation, not automated verification** (README `:95`).

## 8. Device selection (the Voicemeeter naming maze)

File: `src/utils/audioSourceManager.js`; labels `audioDeviceLabels.js`;
picker `AudioRouteStatusBar.js`.

- Sink matchers: `isVbCableSinkLabel (:79-93)` — `cable input` / `cable in`
  true; `cable output` false; Voicemeeter full-OK **only**
  `/^voicemeeter (input|in 1)(\s*\(.*\))?$/` (Standard VAIO incl. newer `In 1`
  naming + vendor suffix). AUX/VAIO3/numbered (`In 2+`, `Input 1`) are
  recognized (`isVoicemeeterInputLabel :97-100`) but warn-tier side buses.
- STT matchers `isVbCableSttInputLabel (:67-76)`: `cable output` /
  `voicemeeter output` / `voicemeeter out b[12]` true (v4.104.0 buses);
  `cable input` false; A1-A5 excluded.
- Auto-pick `pickVbCableSinkDevice (:141-153)`: Voicemeeter Input/In 1 →
  CABLE Input → `cable in`; each excluding `/16\s*ch/`; AUX/VAIO3 never
  auto-picked. STT pick `:136-139` first label match.
- Explicit-pick guard (v4.87.0): `CATINTASSIST_SINK_EXPLICIT`
  (`read/persistSinkExplicit :107-128`); `shouldAutoFixSink (:131-134)` —
  explicit + present = hands off. `needsVbCableSinkAutoFix (:156-165)` =
  missing or `diagnose…!ok && code sink_*`. Auto-fix runs in cable mode on
  enumerate (`AudioSettingsContext:94-107`).
- `diagnoseVbCableRoute (:173-273)` codes (picker chip `{ok,code,level,short,
  tip}`): `sink_missing/err`, `sink_is_cable_output/err` (Input↔Output flip),
  `sink_other_bus/warn` (AUX/VAIO3), `sink_is_speakers/err` vs
  `sink_not_cable/err` (`/speaker|headphone|headset|realtek|default|
  dispositivo|altavoz/i`), `stt_is_cable_input/warn`,
  `stt_not_cable_output/warn`, `stt_missing/warn`, `ok/ok` (recipe string
  differs CABLE vs Voicemeeter).
- Labels `audioDeviceLabels.js`: memory merges non-blank (MAX 60,
  `rememberDeviceLabels :27-53`); `displayDeviceName (:65-88)` =
  live > remembered > `Output N · names hidden`; v4.107.0 twin suffix —
  identical base names get `· #a1b2` (deviceId tail) so Standard vs Potato
  ghosts can be told apart. `hasHiddenLabels (:90-92)` fresh-origin hint.
- Picker (`AudioRouteStatusBar.js:553-601` `#audio-route-sink-select`):
  truncate 36, red border on `sink_*`, warn chip, `Fix → VB out (:602-629)`.
  Compact `🔊 {outLabel} (:384-391)` amber when empty. STT badges/mic
  meter/Test buttons `:631-862`.

## 9. Playback engines + fallback chains

### 9.1 Primitives (`audioRoute.js`)

- `bindAudioToSink(el, sinkId) (:3-12)`: missing `setSinkId`/sink → false;
  throw → console + false.
- `primePlaybackElements (:14-23)`: `preload=auto, volume=0` both elements.
- `rampVolume (:32-62)`: 0→target over ~50 ms; v4.95.0 hidden-tab guard —
  `document.hidden` → jump straight to final (interval throttle ≥1 s used to
  play greetings at near-zero when the call app is focused).

### 9.2 Direct sink (`audioRouteDirect.js`, v4.104.0 default engine)

- Persistent `AudioContext({sampleRate:48000})` per sink (`ctxBySink :17-20`,
  `getDirectSinkContext :31-43`); `isDirectSinkSupported (:22-25)` =
  `AudioContext.prototype.setSinkId` exists (Chrome/Edge 110+).
- `decodeBlobOnContext (:65-68)` (resamples to 48 k ctx);
  `playBufferDirect (:75-149)`: `BufferSource → Gain(0) → ctx.destination`,
  `normalizePeak`, 50 ms linear ramp (`RAMP_MS :15`), rAF progress, `onended`
  resolve; missing args reject.
- `playBlobToSinkDirect (:156-162)`: `getCtx → resume → setSinkId → decode →
  play`. Stateless one-shot (no ducking, no logs, no guards).

### 9.3 Passthrough injection (`audioRoutePassthrough.js`, v4.75.0)

- `ROUTE_MODE (:3-8)` passthrough/dual_element/direct_sink; pref
  `read/writeRouteModePreference (:18-39)`; v4.95.0 one-time migration
  dual→passthrough (`CATINT_ROUTE_MODE_MIGRATED`) — the v4.86.2 dual default
  put two elements on one sink = patient-reported garble.
- `decodeBlobToBuffer (:46-52)` (caller closes ctx); `normalizePeak (:59-77)`
  in place to −1 dBFS, silence early-return.
- `playBufferViaPassthrough (:83-181)`: `BufferSource → Gain(0) →
  MediaStreamDestination`; `setSinkId` on the **shared mic element**,
  `srcObject = dest.stream`, `volume=1/muted=false`; `play()` —
  `NotAllowedError` → throw `autoplay_blocked`, other errors warn + continue
  (`:140-147`); normalize + 50 ms ramp + `source.start`; `onended` → restore
  `srcObject=savedMic`, `pause`, `ctx.close`. Missing args reject; bind/play
  failure rejects (no speaker fallback by design).

### 9.4 Orchestrator (`AudioSettingsContext.js:344-448`)

- Entry (`:344-348`): `!blob||!sink → {ok:false, reason:'no_sink_or_blob'}`;
  `stopClipToSink()`.
- Passthrough mic rail (`:127-271`): element `setSinkId(selectedSinkId)`;
  physical mic `getUserMedia` DSP-off (`:142-144`); live bind + meter loop
  (every 6th frame, 100 ms throttle, clip/no-signal states, `#top-mic-bar`
  DOM). `setSinkPlaybackActive (:57-64)` ducks (`volume 0 + muted`).
- Direct first (`:358-390`, incl. **v4.108.1 fix**): `entrySink` →
  `getDirectSinkContext` → **`await ctx.resume()` + `await
  ctx.setSinkId(entrySink)` on EVERY fire** (was missing pre-4.108.1: clips
  rendered to default speakers) → decode → stale-sink guard
  (`localStorage CATINTASSIST_SINK_ID !== entrySink` → throw `sink_changed`)
  → re-assert `setSinkId` → duck → `playBufferDirect` → `DIRECT_INJECT` →
  await → `PLAY_END{direct_sink}` → `{ok:true}`. Catch: log
  `PLAY_FAIL{direct_sink}` (except `direct_sink_unsupported`, silent
  fallback), reset ducking.
- Passthrough fallback (`:392-447`): `decodeBlobToBuffer` →
  `playBufferViaPassthrough(el, …, sinkId, savedMic)` → `PASSTHROUGH_INJECT`
  → await → restore mic rail → `PLAY_END` → `{ok:true}`; catch → console +
  restore + `PLAY_FAIL{passthrough}` → `{ok:false, reason}`.
- `stopClipToSink (:322-338)`, `restoreLiveMic (:278-295)` (panic: stop clip,
  rebind mic, `{ok:!!(el&&mic)}`), watchdog (`:298-319` pagehide +
  visibilitychange; skips while clip playing — earlier version stomped clips).
  `changeSinkId (:481-485)` persists + marks explicit.

### 9.5 Studio fire (`GreetingsPanel.playAudioBlock :832-1021`)

- Args `(key, routeToVirtualMic, {bypassGate, callerOnly, testCap})`;
  toggle-off if same key playing (`:838-849`).
- Gate (§7) → `playLocal=!callerOnly`, `playSink=sendToCaller`,
  `usePassthrough = playSink && pref===passthrough (:885-886)`;
  `PLAY_START + STT_LOAD_WARN (:888-902)`.
- Dual pre-bind (`:907-921`): `bindAudioToSink`; fail → callerOnly: `fail` +
  return; else downgrade to local + `LOCAL ONLY`.
- `onEnd (:931-947)`: clear + `PLAY_END`; Call-Test success →
  `pendingRouteConfirm + sink_played` + `📡 Into ${sinkLabel} ✓ — if no
  needle moved, re-pick the other same-named entry` (10 s, ghost-twin proof
  v4.107.0).
- Fire (`:957-1007`): local `play()` always (unless callerOnly); sink via
  `playClipToSink(blob, effSinkVol)` (eff = `testCap ?
  capSinkTestVolume(sinkVolume) : sinkVolume :962`) → `!pt.ok` →
  `FALLBACK_DUAL` → dual-element bind + play + ramp (`:971-982`); pure-dual
  branch otherwise (`:988-990`); ramps (`:995-1007`).
- Catch (`:1008-1020`): console + `PLAY_FAIL`; callerOnly → named
  `⚠️ Sink play failed into ${sinkLabel} (${message})…` + `clearPlayback`.
- Call sites: `🔊 You → (key,false) (:1080)`; `📡 Caller →
  (key,true,{bypassGate,callerOnly,testCap}) (:1086)` (quiet, sink-only);
  preflight Hear/Send (`:1572/:1593` same shapes); slot fire
  `(activeKey,!micTestMode,{bypassGate:false}) (:1753)` — full `sinkVolume`,
  no cap.

### 9.6 On-call fire (`OnCallSoundboardStrip.fireClip :179-291`)

- `resolveFireKey + blob` else `No clip (:180-185)`; toggle-off (`:187-191`).
- micTestMode early return (`:193-215`): local speakers only, ramp, own
  `PLAY_START/END{local_speakers}`.
- Gates (§7) → `!sink → Pick VB out (:234-237)`.
- Chain (`:240-285`): local `play()` + ramp **always** (`:257-259`); sink via
  `playClipToSink(blob, sinkVolume)` (**no testCap — full volume**);
  `!pt.ok` → `FALLBACK_DUAL` → dual bind+play+ramp (`:261-274`); pure-dual
  branch (`:275-285`); catch → console + `PLAY_FAIL` + `clearPlay`.
  Notices via `flashNotice` (3.5 s).

### 9.7 TTS fire (`useTTS.js:40-159`)

- Inworld prefetch stubbed null (`:32-38`, 402) → browser `speechSynthesis`
  fallback = **local speakers always** (`:54-69`).
- URL path: local + sink `<audio>`s; passthrough branch fetches blob →
  `playClipToSink(blob, sinkVolume, {clipKey:'tts'}) (:108-119)` →
  `!pt.ok` → `FALLBACK_DUAL` → dual bind (`:115-119`); dual branch (`:120-124`);
  fake meter `__CAT_AUDIO_VOL` interval (`:126-132`).

## 10. Volumes, ramps, ducking

- Sliders `CATINTASSIST_LOCAL_VOL / SINK_VOL` (default 1;
  `AudioSettingsContext:34-43`); Studio syncs element volumes (`GreetingsPanel
  :606-612`, clipped ≤1).
- Test caps (v4.106.0 quiet-by-design): `SINK_TEST_CLIP_CAP=0.4`,
  `SINK_TEST_TONE_VOL=0.2` (`audioSelfTest:12-13`); `capSinkTestVolume
  (:16-20)`; beep `playTestToneSink(sink, 0.2)`; header quick tones default
  0.6 (uncapped) — Studio card/Send capped, header not.
- Ramps: 50 ms everywhere (`audioRoute:33`, `audioRoutePassthrough:10`,
  `audioRouteDirect:15`); hidden-tab jump-to-final (`audioRoute:41-44`).
- Ducking: `setSinkPlaybackActive(true)` mutes passthrough mic element during
  clip (same-sink mix avoidance); watchdog never stomps a playing clip.
  External-mic mode would remove ducking need — **not implemented** (§14.3).

## 11. UI surfaces

- Studio `GreetingsPanel` (1788 lines): play/settings modes; 3-step `Will
  callers hear it?` — ① Check (Deepgram) ② 🔊 Hear (speakers) ③ 📡 Send
  (sink-only capped) → CALL OK (`:1502-1640`); tiles gallery (`:1702-1785`,
  variant chip, LIVE/▶, health pill click = re-check); clip cards
  (`renderClipCard :1023+`, waveform `:99-119`, Why/Fix/Robot-heard/script on
  UNACCEPTABLE); volumes + mic monitor + route debug (`:1614-1698`: mode, STT,
  sink/mic, last test + last 6 diag lines); `LIVE to patient` banner
  (`:1413-1427`); `safetyNotice (:249, :1407-1411)` strings enumerated §9.5.
- On-call strip: collapsed `▸ Greetings` default; 7 tiles
  (`is-playing/is-missing/is-blocked/has-thumb`, bg thumb, progress, lang
  badge); thumb-size slider (`catint_oncall_sb_size`); `▶ LIVE/local` +
  version in toggle title.
- I/O (`AudioRouteStatusBar`): `🔊 VB out` picker + warn chip + `Fix → VB
  out`; `🎤 Mic`, `📥 Cable in` pickers; STT badges; mic meter; `Test local /
  Test VB out`; `🎤 Restore Mic`; `⚡ Zap`. Mic-mode `🎤` button forces
  local-only (`:467-477`).
- Version visible upper-right per AGENTS.md (`DashboardHeader`,
  `AudioRouteStatusBar:371`, strip toggle title).

## 12. Diagnostics, events, globals

- `routeDiagnostics.js`: `ROUTE_EVENT (:6-16)` = play_start/play_end/
  play_fail/sink_bind/passthrough_inject/passthrough_restore/direct_inject/
  stt_load_warn/fallback_dual; `logRouteEvent (:37-53)` ring 40 →
  `window.__CAT_ROUTE_DIAG`; `assessSttLoadRisk (:68-81)` (dual-while-STT,
  unbound-while-STT); `formatRouteDiagLine (:83-89)`.
  Emitters: GreetingsPanel `:888-901,909,936,939-940,971,973,1010`;
  OnCall `:195,211,243,252,264,288`; context `:293,337,377,384,389-393,
  413-417,430,441-445`; useTTS `:57,80-81,89,103-104,115`.
- Globals: `__CAT_AUDIO_VOL` (fake `(40+rand*60)*sinkVolume` during patient
  play — meter theater, not measured output), `__CAT_MIC_LEVEL` (real meter),
  `__CAT_STT_ACTIVE`, `__CAT_ROUTE_DIAG`.
- `micVerify.js:100-165 summarizeProbe` → `{tone,headline,hints,pinned,
  edgeDefaultMismatch,hzWarning(sampleRate!==48000)}`; chip `:172-186`.
- Tones `audioSelfTest:22-86`: 440 Hz 900 ms WAV (`createTestToneUrl`,
  44.1 kHz synth); `playTestToneLocal(0.6)`; `playTestToneSink(sinkId,vol)`
  (`!sink → throw`; `setSinkId` throw surfaces).

## 13. Tests — what passes, what is NOT covered

- Suites green at audit except **1 pre-existing unrelated failure**:
  `ringSignature.test.js:61` (`matchRingSignature` all-tones-must-appear —
  untracked `ringSignature.js`, not part of this pipeline).
- Per-file: `audioSelfTest` (tiers, recall, mocked Deepgram, explainHealth,
  caps — NOT real Deepgram/tones); `routeVerification` (fp format,
  slot-family sharing, sink/mic invalidation — NOT legacy path/corrupt JSON);
  `routeDiagnostics` (STT flag, risk, format — NOT 40-cap/clear); `audioRoute
  Direct` (unsupported, 48 k persistence, `playBlobToSinkDirect`
  resume+setSink+resolve — NOT the context orchestration); `audioRoute
  Passthrough` (pref only — NOT decode/normalize/play); `audioSourceManager`
  (constraints, picks incl. `In 1`, never-AUX/VAIO3, all diag codes,
  explicit-pick — NOT live enumeration); `audioDeviceLabels` (memory, twin
  suffix — NOT picker wiring); `soundboardMetaService` (texts, reseed,
  retired-drop, slotText — NOT Firestore sync, NOT CALL OK carry-over);
  `micVerify` (7 verdicts incl. 48 k warn — NOT live probe);
  `AudioRouteStatusBar` (compact buttons only); `releaseNotes` (presence +
  bilingual only).
- **Zero unit coverage (flagged since DIAGNOSIS-2026-09-07):**
  `AudioSettingsContext.playClipToSink` (direct→passthrough→dual,
  `sink_changed` abort, per-fire resume+setSinkId, watchdog, stop/restore,
  mic-monitor), `GreetingsPanel.playAudioBlock`, `OnCallStrip.fireClip`,
  `rampVolume/primePlayback`, `useTTS` route logging, cloud sync,
  `playTestToneSink` on a real sink.

## 14. Docs, history, scripts

- `docs/soundboard/README.md` (v4.84.33): passthrough default, 3-step table,
  tiers, fingerprint, `CALL OK is human attestation`.
- `voicemod-comparison.md`: injection-point table, dual-element garble
  history, `CATINT_ROUTE_MODE` values, repro checklist.
- `voicemeeter-mic-plan.md` (PLAN ONLY + live 2026-09-12 §60-66): Standard
  has only B1; Potato `Out B2/B3` are ghosts (client-mic pill was pinned to
  dead `Out B3`); good = `Strip[0]→B1`, VAIO→A1+B1, B1 unmuted @0 dB; wrong =
  **A1 output = CABLE Input** (VAIO self-monitor feeds STT — Deepgram
  transcribes every greeting; fix in Voicemeeter UI, remote-API stepping
  broken); Windows default input must be `Voicemeeter Out B1`; 48 k checklist
  (mmsys 3× 24-bit/48 k, VM 48 k, pin mic explicitly, monitor on headphones).
- `docs/handoff/09_voicemeeter_safeguards.md`: external-mic executor spec
  (`CATINTASSIST_EXTERNAL_MIC_ROUTING`, `Mic: Voicemeeter (unverified)`,
  Standard-Input-only sink, effective-vs-requested sink, no auto-enable).
  **NOT implemented — zero `CATINTASSIST_EXTERNAL_MIC*` hits in `src/`.**
- `docs/DIAGNOSIS-2026-09-07.md:49-66` garble candidates ranked: ① dual
  default ② throttled ramp under hidden tab ③ swallowed autoplay ④ mic-swap
  seam + watchdog ⑤ double-transcode/splices w/o crossfade ⑥ main-thread CPU;
  plus unguarded health JSON, single-slot `isAnalyzing`, strip snapshot,
  fake meter.
- `scripts/setup-voicemeeter-mic.ps1`: inspect default, `-Apply` (XML backup,
  mic match-first, never cycle bus WDM, A1-VB warn, Strip0 A1=0/B1=1,
  VAIO→B1, B1 unmute/0 dB), `-Restore`, Standard/Banana/Potato layouts.
- CHANGELOG arc v4.75.0→v4.108.1: passthrough inject → health rail/gallery/
  LIVE → VB-out=CABLE tip → scripts+reseed → passthrough-default + Strip2→B1
  → slots/warn-not-block/dedup → direct-sink 48 k buffered → disk backup →
  In-1/Out-B1 naming + slot-shared CALL OK + LOCAL ONLY → quiet caps + named
  failures → twin `#tail` + `Into X ✓` → **v4.108.1 per-fire resume+setSinkId
  + stale-sink cancel**.

## 15. Failure hypotheses (ranked, for the reviewer)

1. **H1 — Direct ctx never bound to the sink (FIXED v4.108.1, verify on
   hardware).** Pre-fix `playClipToSink` skipped `resume()+setSinkId()`;
   persistent ctx rendered to *default output*. Symptom: you hear it,
   patient hears nothing (or room speakers). Confirm: VB-out = Voicemeeter
   Input → 📡 Caller → VAIO strip needle moves + recorder on `Voicemeeter
   Output` captures it. Ghost-twin variant: bound to a same-named dead
   endpoint — post-fix this fails loudly + falls back instead of silent
   speakers.
2. **H2 — Ghost-twin endpoint picked.** Standard mixer + Potato endpoint set
   co-registered: two `Voicemeeter Input` entries, one dead. Symptom: no
   error, no needle. Check: `· #xxxx` tail in picker; fire → `Into X ✓` yet
   no needle → re-pick the other twin (Studio tells you this verbatim).
3. **H3 — Sink is speakers / CABLE Output / side bus.** `diagnoseVbCableRoute`
   codes distinguish (`sink_is_speakers`, `sink_is_cable_output`,
   `sink_other_bus` for AUX/VAIO3). Side buses may never reach B1.
4. **H4 — A1 = CABLE Input STT-echo.** Greeting reaches patient AND is
   transcribed by Deepgram (A1 self-monitor feeds the cable). App-side
   invisible; fix in Voicemeeter UI (A1 → headset). Live diagnosis confirms
   this was the actual rig state.
5. **H5 — Sample-rate mismatch garble ("can of tuna" / robotic).** App
   renders 48 k; any 44.1 k virtual device = Windows resampler garble. Check
   mmsys 3× 24-bit/48 k + VM 48 k + `micVerify` hzWarning. Old element-swap
   path also chopped (kept only as fallback).
6. **H6 — Hidden-tab throttle / autoplay block.** Ramp guard (v4.95.0) +
   `autoplay_blocked` surfacing addressed the known instances; a fresh
   `NotAllowedError` still fails the fire loudly (good) — needs one user
   gesture per session.
7. **H7 — Stale gates (health/CALL OK) misread as routing failure.**
   Fingerprint invalidates on sink/mic change (by design); slot rollover
   does not. `LOCAL ONLY` / `CALL OK required` notices mean gate, not
   broken audio. Untested/weak-health clips warn but fire.
8. **H8 — Throttled/duplicated live mic rail.** Passthrough element +
   direct ctx both feed one sink; ducking mutes the mic element — if ducking
   desyncs (rapid re-fire, watchdog race), mix garbles. External-mic mode
   would remove this class; spec exists, code does not.
9. **H9 — Clip-level defects.** DSP-mismatched re-record, missing crossfade
   clicks (export pack), un-normalized store vs normalized playback,
   webm→wav edit conversions, `v2`-filename key misses, orphan resurrection.
   Deepgram `Check` scores the *file*, not the patient path.

## 16. Repro + verification checklist (hand to the reviewer)

Off-call, Voicemeeter Standard running:
1. I/O: 📥 = CABLE Output (or `Voicemeeter Out B1/B2`); 🔊 = `Voicemeeter
   Input` (or `In 1` + `#tail` = live twin, not ghost); mic = physical.
2. Studio per clip: Check (≥PASSING) → Hear (speakers) → Send (watch VAIO
   meter, capped 0.4) → CALL OK → tile armed.
3. `scripts/setup-voicemeeter-mic.ps1` (no `-Apply`): Standard kind; Strip0→B1;
   VAIO→B1 (+A1 only to headset, never CABLE); B1 unmuted 0 dB; default input
   = `Voicemeeter Out B1`.
4. Windows recorder on `Voicemeeter Output`: speech + greeting both present.
5. On-call: fire opener → patient confirms; kill app mid-call → patient still
   hears you (hardware mic path).
6. In-app evidence: `window.__CAT_ROUTE_DIAG` (last 40: PLAY_START →
   DIRECT_INJECT → PLAY_END, no FALLBACK_DUAL/PLAY_FAIL); Studio route debug
   + `Into X ✓` notice; meter theater (`__CAT_AUDIO_VOL`) is NOT evidence.
7. Negative probes: ghost twin (no needle, no error pre-fix / loud fail
   post-fix), speakers sink (`sink_is_speakers`), CABLE Output sink
   (`sink_is_cable_output`), AUX/VAIO3 (`sink_other_bus`), mid-decode sink
   swap (`sink_changed` cancel), hidden-tab fire (ramp guard).

## 17. Appendices

### A. Key files

| Area | Files |
|------|-------|
| Orchestration | `src/contexts/AudioSettingsContext.js:46-64,127-271,278-339,344-448,481-499` |
| Direct | `src/utils/audioRouteDirect.js` (+`.test.js`) |
| Passthrough | `src/utils/audioRoutePassthrough.js` (+`.test.js`) |
| Primitives | `src/utils/audioRoute.js` (no test) |
| Studio | `src/components/GreetingsPanel.js` (no test) |
| On-call | `src/components/OnCallSoundboardStrip.js` (no test) |
| TTS sibling | `src/hooks/useTTS.js` |
| Gates | `src/utils/audioSelfTest.js`, `src/utils/routeVerification.js`, `src/utils/routeDiagnostics.js` |
| Devices | `src/utils/audioSourceManager.js`, `src/utils/audioDeviceLabels.js`, `src/components/AudioRouteStatusBar.js`, `src/utils/micVerify.js` |
| Data | `src/utils/storage.js`, `src/utils/recordingFileNaming.js`, `src/services/soundboardMetaService.js`, `src/components/AudioEditorPanel.js`, `src/utils/audioProcessing.js`, `exports/audio-greeting-editor/` |
| Docs | `docs/soundboard/README.md`, `voicemod-comparison.md`, `voicemeeter-mic-plan.md`, `docs/handoff/09_voicemeeter_safeguards.md`, `docs/DIAGNOSIS-2026-09-07.md`, `docs/CHANGELOG.md` |
| Ops | `scripts/setup-voicemeeter-mic.ps1` |

### B. Persistent keys

IDB: clip keys (`greeting_en_morning`…), `thumb_<actionId>`, `bg_app`,
orphans/retired (`open_client`, `open_lep`). localStorage:
`CATINTASSIST_SINK_ID/_MIC_ID/_REC_MIC_ID/_LOCAL_VOL/_SINK_VOL`,
`CATINTASSIST_SINK_EXPLICIT`, `CATINTASSIST_AUDIO_SOURCE_MODE(+_VIRTUAL_CABLE_
INPUT_DEVICE_ID)`, `CATINT_ROUTE_MODE(+_MIGRATED)`,
`catint_audio_health(+_heard)`, `catint_manual_call_ok_v1`,
`catint_soundboard_meta_v1`, `CATINTASSIST_DEVICE_LABELS`,
`catint_sb_show_chrome/_tile_size`, `catint_oncall_sb_size`.

### C. Events / globals

`catint_gates_updated`, `cat_soundboard_meta_changed`, `cat_bg_changed`,
`catint_mic_device_changed`; `window.__CAT_ROUTE_DIAG/__CAT_STT_ACTIVE/
__CAT_AUDIO_VOL/__CAT_MIC_LEVEL`.

### D. Open questions carried forward

1. Studio-128k-DSP-off vs editor-256k-DSP-on — unify? 2. Backport 8 ms
   crossfade to export pack? 3. Normalize at Save so health = patient level?
   4. Multi-dot filenames (`v2`) key miss — accept? 5. Orphan download/
   resurrect — desired? 6. On-call strip other-slot staleness — reload on
   `catint_gates_updated`? 7. IDB quota UX — what shows on QuotaExceeded?
