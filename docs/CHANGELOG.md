# Changelog (recent)

**Version source:** `src/constants/version.js` (must match `package.json` + top-right UI pill)

## v4.133.0 - ER incident: never delete a tirade

- `stopRecording` no longer wipes captions — audio stops were clearing the whole transcript before the last-call archive could seal it (unrecoverable loss in the ER).
- `stopSession` HARD RULE: no wipe without a verified archive; billing still stops.
- Long-bubble compression policy: live + newest-2 + any medical/digit row never clip; expansion keyed by text signature (survives re-seal/id churn).
- Overlap/dedupe: clinical repeats (epinephrine, airway, mg…) are emphasis — exact-repeat only; med-cue boundaries never strip.
- Autopilot farewells: dropped mid-conversation triggers ('is there anything else'), silence 30s→120s.

## v4.132.0 - Sentence-boundary bubbles + medical prune guards

- New bubble after every sealed sentence end (`.!?…`) even mid-tirade with no silence break (`captionEngine.js`); mid-sentence fragments still merge.
- Spelled-out doses ("five hundred milligrams") now critical data — stutter-prune/dedupe/overlap-strip skip them (`sensitiveDataProtector.js`).
- Stutter-prune blocked by any med/date/money cue word; dedupe never drops `not/never/nunca/insulin/mg…`; overlap-strip skips boundaries with critical cues.
- AGENTS.md: agent replies ≤3× user prompt length.

## v4.130.2 - Re-attach banner names your route

- Zombie banner reads the configured audio route: `re-attach VB-Cable` / `re-attach mic` / `re-attach tab` (was hardcoded tab).

## v4.130.1 - Last-call seal + outage is not call end

- STOP/auto-end seals a read-only last-call transcript (IDB) — re-readable after refresh/update until next call, End Day, or 🗑.
- Ghost auto-end now requires Deepgram connected: STT collapse / update / reconnect can never end the call or wipe text.
- Live captions flush to IDB on pagehide/hide (kills the 1s debounce-loss window on reload).

## v4.129.1 - Connect = BREAK exact box

- `#header-connect-btn` + `#header-break-btn:not(.has-label)` share one ID rule: 26×26, padding 0, radius 4px (23px ≤1100px via vars); 90m BREAK label still expands via `.has-label`.
- Both off-call only (STOP replaces Connect in-call); icon 14px both.

## v4.129.0 - Small buttons, slim row

- Soundboard (🎛) + Editor (✎) are 26px squares like BREAK; Connect forced to exact 26×26 box + glow without scale.
- Full name stays in the tooltip.

## v4.128.0 - Greetings play once (sink-only caller audio)

- Caller-bound audio (on-call strip fires, Studio caller sends, editor caller tests, TTS) is sink-only by default — the parallel local copy + the Voicemeeter A1→cable loop made every greeting sound twice.
- Opt-in local monitor: "Monitor" checkbox on the on-call strip (`CATINT_CALLER_MONITOR`).
- Voicemeeter fix applied live: VAIO→B1 only, empty Strip[1] cleared; `setup-voicemeeter-mic.ps1 -Apply` now enforces both.

## v4.126.0 - Header declutter + no mid-call updates

- Update banner deferred off-call (`App.js`): no reload offers while active/zombie/on-break — the flag persists so it returns after STOP.
- STOP matches CONNECT height at double width; off-call center children shrink instead of overlapping (`index.css`).
- Mic-verify chip + DG/greetings proof spans moved to Settings → audio (live output label); compact bar keeps TAB/VB toggle + ZAP.
- Notes auto-close on STOP (`stopSession`).

## v4.123.0 - Auto-start on any speech (fix B)

- Off-call auto-start no longer needs confidence>0.4: any non-empty transcript starts the call and opens the capture gate, so mumbled openers land in bubbles instead of dropped (`shouldSpeechAutoStart` in `idleEar.js`, unit-tested).
- Confidence >0.4 stays the gate for billing/activity (`notifySpeechDuringCall`, call-detect pulse) only.

## v4.122.0 - Fractions, percent, self-pay

- foldFractions/foldPercents run FIRST on words ("one half"→1/2, "50 por ciento"→50%); stitch skips 2-part slash runs ("1/2" safe, "5/5/5/1/2/3/4" still stitches); PERCENT_RE joins critical data.
- PRICE_CUE_RE += self-pay/uninsured/deductible/deducible/sin seguro/out-of-pocket/pago privado.

## v4.121.0 - Rooms, ranges, honest yellow

- Rooms/IDs: unitRe += room/bed/po box/ext ("double room" still safe); case/claim/reference arm the ID lane; bare "number is" narrowed (room/case/MRN no longer phone-dash).
- Times: quarter past/to, o'clock/en punto, cueless H MM post-date-mask ("11 30"→"11:30", "05 12 1980" safe); "1 to 3" + "entre las 2 y las 4" schedule units.
- Yellow fix: aligner digit-run consumption (min confidence) + positional fallback removed — unmatched words stay white; lane-aware via TranscriptionBoard lang.

## v4.120.0 - Dictation words, magnitudes, NPI, vitals

- expandDictationWords: "8 oh 5"→805 (digit-gated, "oh no" safe), "double/triple five"→stitchable.
- foldMagnitudes: hundred/thousand/mil/ciento incl. "2 1000 26"→2026, "100 20"→120, cue-gated years; ES map gains cien/ciento/mil + accented numerals (veintiséis).
- NPI/DEA/NCPDP runs stay verbatim even when armed; translation ID_RE covers NPI/DEA.
- Vitals: "120 over 80"→"120/80", new vitals chip (lb/kg/ft/cm/grados/F/C/BP), critical-data + translation safety; stitch decimal/IP guards held.

## v4.119.0 - Addresses survive: split ZIPs, directional slot, whole-span chips

- repairSplitZips: "California, 93, 550" → "93550" (cue-gated; counts untouched).
- Directional slot: "3247 e/and/y + street-type" → compass letter ("3247 E Avenida").
- Street span is one address chip (click copies full line); unitRe takes "#" + letter suffixes ("apt 4B" copies "4B"); shorthand suites ("s 1") gated on address context.
- STREET_TYPE_WORD += avenida/calle/carrera/bulevar; ES street-first + EN number-first both chip.

## v4.118.0 - Greeting Editor view (one greeting at a time)

- New off-call **Greeting Editor view**: master/detail workspace for a single soundboard clip — script, inline waveform editor, record/upload, legibility + loudness + choppiness, and a caller test.
- Entry points: ✎ **Editor** button on the header chips row, and ✏️ on any Studio tile (opens pre-selected on that clip). `← Exit` / Escape returns to the scoreboard; `🗂 Studio` returns to the soundboard overview.
- Navigation: ◀ ▶ buttons or ←/→ keys walk every clip (time-slot variants included); the left rail shows saved/empty counts per greeting family.
- Safety: **CALL OK** is only offered when a caller test plays to the end; a stopped, cancelled or failed test raises a visible error instead of arming the patient path.
- Failures (storage, mic, route, Deepgram) now render inside the view — no silent console-only errors. Delete asks in-view, never via `window.confirm`.
- Studio cleanup: the old per-clip edit **modal** was removed (one editor, one place); the Studio stays the catalog. Shared clip logic extracted to `src/hooks/useGreetingClip.js`.

## v4.117.0 - Request memory: phone/SSN format across bubbles

- New expectedDataContext: "can I have your phone number/SSN" arms formatting for 45s; later-bubble digits group correctly (full override: armed SSN beats ZIP shape, armed phone groups 8 digits, armed DOB/address stay verbatim).
- collapseAdjacentDigitRepeats: exact straddle dupes ("555 123 123 4567") → one copy; single-digit runs never collapse ("9 1 9 1" kept — caught eating HIPAA digits in testing).
- Sentinel gaps: bare request phrasings EN/ES, birth/born/dob/age/how-old, "me puede dar su número".

## v4.116.0 - Doubt shows both, numbers never destroyed

- Ambiguous all-digit dates copy both ISOs ("05/12/1980" → 1980-05-12 / 1980-12-05); display verbatim.
- Phone fallback dashes only 9/10/11; other lengths stay as dictated unless explicit phone/SSN sentinel.
- Overlap near digits requires exact raw-word repeat ("1234" vs "12 34" no longer strips).
- Morph protects any digit token + currency; translation pure-digit compare exact + new ZIP class.

## v4.115.0 - Sensitive data round 2: DOB/dose/money/email survive

- Spaced DOB "05 12 1980" masks as one date unit (ISO copy); dotted "05.12.1980" too; "v1.2" untouched.
- Compounds/decimals: "eighty two"→82, "ochenta y dos"→82, "two point five mg"→2.5 mg; stitch no longer eats decimals ("2.5"→"25" fixed); IPs not phones.
- ZIP+4 stays verbatim; 8-digit MRN/chart runs undashed (9/10/11 keep SSN/phone/member behavior).
- Money thousands ("$1,234.56") one unit; pills/gotas/puffs dosage units; spoken email highlight + reconstructed copy; "Calle 45" address unit.
- Word times: "half past two"→2:30, "at 3 30"→"at 3:30", 24h + "3pm" highlight; translation safety covers times/money/MRN.
- Corrections gain word boundaries ("ana" can't rewrite "Juana", "212" can't rewrite phones). Caught live bug: translation `dobs` extracted with dosage regex — fixed.

## v4.114.0 - Greeting Editor view + clerk slot times survive

- Clerk shorthand "we have 1 1 30, 2 2 30" expands to 1:00, 1:30, 2:00, 2:30 (1 1 30 = TWO slots, never 1130); times highlight + click-to-copy, phone colon backstop, translation digit-loss safety covers times.
- Greeting Editor focused view (see in-app release notes).

## v4.113.0 - Goal Tracking view: dial + month calendar, live need/day

- New off-call Goal Tracking view: dial selector + month calendar side-by-side; live pace card shows banked vs goal, remaining over workdays, and need/day with an on-pace verdict (updates live as the dial changes, before saving).
- Open from the goal button, income card, calendar button, or daily-targets chip; cat or Escape returns to transcription. Transient view: refresh lands back on the scoreboard.
- Month calendar requirement math moves to a workday basis (remaining goal / remaining workdays) reacting to the live dial preview; click a past day to edit minutes.
- Separate heatmap overlay removed (calendar lives in the view); workdays/month lifted to session context so header catch-up strip and view never disagree.

## v4.112.3 - Greeting scripts visible before Record

- Clip cards render script `<details open>` (was collapsed until Record); ✏️ edit modal shows script under header. Recording keeps live teleprompter.

## v4.112.2 - Passive ElementHint tooltips retired

- `ElementHintTarget` is a pass-through (native titles back); ⌖ HudInspector picker is the single element-select path. No behavior change for wrapped controls.

## v4.112.1 - Soundboard dock fills the rail

- Dock gallery drops to full-width grid row below header (was squeezed to 1-tile column beside toggle+slider in the 180–240px rail).

## v4.112.0 - One-tab local translator watch (no more 5-min popup)

- **Retired:** `\CatTS-API-Watchdog` scheduled task (console flash every 5 min; `-WindowStyle Hidden` still flashes on interactive logon) — disabled. Re-enable: `schtasks /change /tn "CatTS-API-Watchdog" /enable`.
- **New:** `scripts/watch-local.ps1` + `npm run local` — one persistent tab checks `127.0.0.1:59200/health` every 30s and lifts hidden uvicorn inline if down. Zero new windows, ever.
- **Gotcha fixed while here:** PS 5.1 fails to parse BOM-less `.ps1` with non-ASCII chars (spurious "string missing terminator") — script is pure ASCII now.
- **Next:** app lifts its own backend — options in `docs/development/local-translate-watch.md`.

## v4.108.3 - Voicemeeter Input is not In 1

- Fixed incorrect endpoint matching: In 1–5 are optional VAIO extensions, not the normal VAIO input. Auto-pick skips them; existing explicit picks stay put with a routing warning.
- Explicit Studio 📡 Caller tests now send to the selected greeting output even in Mic mode; previously neither output played. Ordinary Mic-mode playback stays local.
- Settings now explain the separate greeting, transcription and call-site microphone routes.

## v4.108.2 - Greeting output binding and cancellation

- Direct greeting playback now resumes and binds the selected output before rendering (includes the unshipped v4.108.1 fix).
- Stop, Restore Mic, output changes and replacement clips cancel pending playback; cancelled requests cannot restart through fallback or clear a newer clip.
- Mixer inspection: Standard B1 is `Bus[1]`, not `Bus[2]`; corrected Potato strip indexes. No automatic live mixer changes.
- Hardware delivery remains unverified; browser playback success cannot prove an endpoint reaches the caller.

## v4.108.0 - Quieter vault lock + hidden local servers

- **Deepgram vault:** "Lock (Clear Session)" red alarm button → quiet underlined text link; key copy stays, menace gone.
- **Agent rule:** lifting local (`npm start`, servers) must run hidden — never a visible cmd window while the user reads live transcriptions on calls (`docs/handoff/00_global_rules.md`).

## v4.107.0 - Twin-endpoint disambiguation (ghost Voicemeeter Input)

- **Root cause of silent no-needle:** Voicemeeter Standard + Potato leftovers register identically-labeled outputs. Picking the ghost twin plays into nothing — no error, no needle. Every VB-out picker (Settings, I/O strip, header, Mic Verify) now appends an id tail (`· #a1b2`) when 2+ entries share a label, so the live twin can be told apart.
- **Success proof:** sink test fires now confirm `📡 Into X ✓ — if no needle moved, re-pick the other same-named entry`.
- Tests: twin-suffix cases in `audioDeviceLabels.test.js`.

## v4.106.0 - Quiet sink test (no more "no needle" mystery)

- **Studio sink test, quiet by design:** clip-card 📡 Caller + Check-panel 📡 Send now play the real recorded clip into VB out capped at 0.4 (ignores a 100% slider); footer beep is a soft fixed-0.2 tone, sink-only — never your speakers. Judge voice quality safely by watching the VAIO strip meter.
- **Quality gate no longer blocks testing:** 📡 Send enables with clip + sink picked (was disabled on quality fail) — the gate still guards on-call tiles; Studio is for diagnosis.
- **Visible failures:** sink bind/play errors now name the sink in a persistent notice (`Sink play failed into X — re-pick 🔊 in header`) instead of console-only.
- Tests: `capSinkTestVolume` clamp tests in `audioSelfTest.test.js`.

## v4.99.3 - Soundboard dedup (one Opener–Client)

- **Retired:** `open_client` ("Client Open") — byte-identical script to `greeting_en`. Canonical survivor is `greeting_en` ("Opener – Client"), which keeps the AM/PM/Eve recording variants. Tile count 26 → 25.
- **Relabeled (no deletions):** openers in call order (Opener–Client / Opener–LEP / Opener–LEP (ES) / Opener–Direct dial); closers grouped (Closing–More help? / Closing–Sign off / Closing–LEP bye); old generics tagged Legacy (Anyone? / Callout / Louder).
- **Carry-over, never delete:** on Studio load, if all 3 Opener–Client slots are empty and an `open_client` clip exists, it copies to `greeting_en_morning` (+ legibility health + CALL OK fingerprint). Old blob stays in IndexedDB as a recoverable orphan (Storage panel → Export backup).
- **Meta migration (seed 2→3):** stored `open_client` entries drop out; untouched tiles relabel automatically; user-renamed labels preserved.
- On-call strip unchanged (7 tiles). Tests: soundboardMeta + cloudSync + releaseNotes green, build clean.

## v4.98.0 - Call Autopilot (phrase-driven auto start/end)

- **New (`callAutopilot.js` + `SessionContext` + `useDeepgram`):** 🤖 Call Autopilot (Settings → Behavior, default OFF). One CONNECT press arms it; after that the platform's own announcements run the session — a bridge phrase ("call is being bridged") STARTS the call, a disconnect phrase ("the caller has disconnected") opens a **10s cancellable banner** then ends it (same stop path as SilenceGuardian: audio pipeline + session).
- **Strict start:** with autopilot ON, any-speech auto-start (v4.92.0) is suppressed — queue-wait announcements ("please continue to hold…") can no longer start billing. Speech auto-start behavior is unchanged when autopilot is OFF.
- **Safety gates:** 25s cooldown after any auto-end/cancel (no bounce-start from trailing "thank you for using…"); end phrases ignored while on hold and during the first 60s of a call (echo window); end detection only on final transcripts.
- **Editable phrases:** Settings → Behavior → "Phrase lists" — start/end lists are one-per-line textareas (defaults shipped, stored in `catint_autopilot_phrases_v1`).
- **Ring/bell listener (experimental, LOG-ONLY):** while armed, `toneWatch.js` samples the preserved tab stream's FFT and records narrow-band bursts (`AutopilotSettings` panel shows tone frames + dominant Hz). Nothing acts on tones yet — data first, thresholds later.
- **Header:** green `🤖 AUTO` chip next to the app logo while armed; hover shows the last autopilot action.
- Tests: 18 new (`callAutopilot.test.js`, `toneWatch.test.js`).

## v4.95.1 - Meter-only HUD mode

- **New:** 3rd HUD mode during calls — 📊 button (top-right, next to ⌃) toggles meter-only: sticky timers hidden, big workday timeline (ON/OFF/LEFT, larger font, static layout) + 💵⏱☕ targets strip. Persisted `catint_hud_meter_only_v1`.
- **Fix:** off-call — metrics strip and I/O bar now have hard separation (border + z-index), no overlap.

## v4.94.1 - CPU freeze fix (blank caption row)

- **Root cause:** an empty live-draft caption row (created when the overlap cleaner emptied the first transcript of a turn) could never seal and stayed in state forever. Every board render skipped it and fired a forced `console.warn` (`ui_blank_caption_skipped`) — 4×/sec all call long × full-board render + layout reads = 100% CPU freeze. NOT the translation API changes.
- **Fix 1 (`captionEngine.js`):** `mergeCaptionsForUi` never merges a blank live draft; the `overlap_empty_freeze` branch drops a freshly appended all-empty draft instead of keeping it (also stops blank rows persisting to IDB / resurrecting on reload).
- **Fix 2 (`TranscriptionBoard.js`):** blank-caption vanish log deduped by id — once per session, not per render.
- **Fix 3 (`sensitiveDataProtector.js`, pre-existing red tests):** ssn/phone sentinels now override the address/date guards in both `stitchSingleDigitSequences` and `formatPhoneAndSSNDigits` — "Medicaid ID 1013159516, Madison Avenue May 8" groups to `101-315-9516` again.
- Release notes entry added (4.94.1) and 4.93.0's empty `highlightElementIds` fixed. All 71 test files green, build clean.

## v4.94.0 - Tiny translate chunks (one sentence/comma per local API request)

- **Fix (user request):** translation requests to the local model were up to 40-word chunks — paragraphs stalled it and translations arrived minutes later. Requests are now **one sentence or one comma-clause at a time, max 14 words**; hard ceiling 24 regardless of what a caller passes.
- `segmentLongMonologue` (`translationApplicator.js`): sentence peel → comma/semicolon split → clause groups ≤14 words. `useTranslate.js` no longer overrides with `maxWords: 40`.
- Regression tests added; 52 translation tests pass, build clean.

## v4.93.1 - CPU sink fix (inspector + mic meter + transcript tick)

- **HUD inspector:** mousemove storm (60-120 setStates/sec + layout thrash per pixel) → rAF-coalesced, same-element short-circuit, per-element selector cache. Same feature, ~zero idle cost.
- **Mic meter:** 60fps analyser + DOM writes → ~10Hz analysis, rounded values, identical writes skipped. Quiet frames still tick so the 3s no-signal timer fires.
- **Transcript:** in-call freshness tick 250ms → 1000ms (4 full-board renders/sec → 1; windows are 1400/4500ms so indicators stay correct).

## v4.93.0 - No more [⚠ Check: …] badges in transcripts

- **Fix (user request):** removed the `[⚠ Check: …]` salvage markers that made translations unreadable. Root cause: the "address" regex treated ANY `number + word` ("7 minutes", "1 of", "5 to") as a sensitive address, flooding every sentence with badges.
- **Safety kept:** digit-loss still flags `weak_digit_loss` and preserves the previous good translation (`translationApplicator.js`); only the text injection is gone. Legacy persisted text with markers is stripped on display (`composeCaptionTranslation`).
- **Tests:** `translationSensitiveTokens` regression — time phrases yield zero tokens; real addresses ("123 Main Street") still detected.

## v4.92.0 - Always-on ear (speech detection between calls, zero cost)

- **New:** after STOP the Deepgram sockets stay warm (KeepAlive pings only — NO audio is sent, so zero Deepgram usage) and a local VAD (WebAudio RMS on the preserved tab/cable stream) watches for speech. Speech ~0.3s → recorder resumes → transcript → existing speech auto-connect starts the call by itself. No CONNECT press between calls anymore.
- **Rules:** `src/utils/idleEar.js` (tested). Falls back to full disconnect when Speech Auto Connect is OFF or the stream is gone. Sockets died while idle → wake rebuilds them from the preserved stream (no tab picker, no gesture). One CONNECT press per browser session remains (browser gesture rule for tab capture).
- **Fix:** `startSession` now cancels the 15s HIPAA finalizer — an auto-started call inside the grace window no longer wipes its own transcript. Call-detect toggle now also disables speech auto-start.

## v4.91.0 - Smart tooltips on daily-targets chip

- **New:** hover the 💵 ⏱ ☕ chip → instant floating panel, all USD: earned/target today (%), on-call minutes to go ≈ $, break taken + what still fits by 18:00 + cost per break minute, month vs $1200, 5500m floor, 18:00/23:00 overtime slack. Replaces the slow native `title` tooltips. `src/components/DailyTargetsChip.js`.
- **Move:** chip lives in `session-controls-center` now (off-call under status line, in-call beside micro-bar grid, bar stays 32px) — moved out of the I/O strip.
- **Tighten:** metrics summary + quick buttons share one line (`header-metrics-strip` row-wrap, bars drop below); I/O strip contents forced single-line scroll (`audio-route-status-main` nowrap).
- **Fix:** compact goal meter no longer overlays the I/O bar — in-flow second row (`dashboard-header--call-compact`).
- **Space:** 4px padding on every item in the header rows (strip, quick, I/O, micro-bar).
- **CPU:** `[CAT STT]` per-chunk console spam now opt-in (`localStorage catint_stt_verbose=1`); dead translate gateway (502) backs off 90s instead of refiring per segment.

## v4.90.0 - Auto break (counts ALL no-transcription time)

- **New:** break timer runs itself — 3s with no transcription detected → ☕ ticks (off-call idle AND mid-call dead air). Hold (provider keywords: "one moment", "please hold", "put you on hold"…) pauses break — that's work. Speech resumes → break banks itself into ☕ taken.
- **Rules:** `src/utils/breakState.js` (tested). Grace 3s; ≥5 min idle restarts the "working without break" nudge; STOP BREAK suppresses auto-break 10 min (desk-work grace); no auto-break before 9am or during zombie calls.
- **Note:** ☕ taken now includes waiting-between-calls idle — the 90m break budget and compensated log-off (18:00 + late + break) consume it accordingly.

## v4.89.2 - Inspector ON by default

- **Fix:** ⌖ HUD inspector now defaults ON — hover anything, get name + selector, click copies. No toggle hunt. Off persists via ⌖/Alt+I.

## v4.89.1 - Hold auto-resume (click-outside + speech)

- **Fix:** study hold overlay no longer traps you — click outside the card (or Enter/Escape) resumes; any detected speech (<2s silence) auto-lifts hold. Rules in `src/utils/holdState.js` (tested); overlay click in `App.js`.

## v4.89.0 - HUD inspector (hover any element, click to copy selector)

- **New:** ⌖ toggle bottom-right (or Alt+I): hover ANY hud element — incl. plain container divs — shows name + unique CSS selector; click tooltip (or press C) copies `name :: selector` for bug reports. Works during calls. `src/components/HudInspector.js`.

## v4.88.4 - De-duplicated timers/earnings

- **Cleanup:** the `$ 📞 📡` block no longer renders twice (center idle slot emptied; sticky row keeps it). Header metrics summary trimmed to `X% mo` — mins/$/📞📡 live in the sticky row and the status-bar targets strip.

## v4.88.3 - Readable status-bar targets strip

- **New:** status bar center shows 3 readable current/target pairs: `💵 $earned/$target · ⏱ done/target · ☕ break taken/max`. Break max = total break for today that still lets you hit the $1200-pace minutes by 18:00; hover adds the 5500m fallback and 23:00 overtime slack. Chip turns orange when 18h is no longer reachable.

## v4.88.2 - Endgame plan in scoreboard

- **New:** line under the ⏱️ mins cell: `🏁 need XhYYm on call · off≤18h: … · off≤23h: …` — on-call time still needed today for the $1200/mo pace, plus slack time if you finish by 18:00 / 23:00 (`computeEndgamePlan` in `DailyTargetsChip.js`).

## v4.88.1 - Daily targets in status bar

- **New:** always-visible chip in the I/O status bar: minutes + USD needed TODAY for the $1200/mo goal, plus minutes left this month. Hover shows the 5500m fallback floor numbers.
- **Goal tiers:** primary $1200/mo (~9231m @ $0.13/min); fallback 5500m/mo (rate floor). `src/components/DailyTargetsChip.js`.

## v4.88.0 - Study cue cards (between calls + on hold)

- **New:** rotating study cards in the off-call idle pane (supersede the rotating tip) and as a fade-in overlay over the transcript during HOLD — dead hold time becomes study time.
- **Cards:** EN→ES glossary, NO-SAY warnings (aseguranza→seguro, enrolarse→inscribirse, always usted, first person), acronyms, QA reminders. Tap to reveal, auto-rotate 10s, skip.
- **Domain picker:** chips on the card (auto/insurance/education/utilities/financial/social/medical/all), persisted `catint_study_domain_v1`. QA cards show in every domain.
- **Data:** `src/utils/studyDecks.js` — seeded starter deck (~55 cards). Full LanguagesCX glossary: paste cleaned rows into `STUDY_CARDS`; jest validator (`validateDecks`) fails the build on duplicate EN terms (airbag/appointment/license dupes) or empty fields.
- **Toggle:** Settings → Display → "Study cue cards" (`study_cue_cards`, default always).

## v4.87.5 - Vertical paste hardening

- **Bug:** v4.87.4's vertical regrouping required an exact-match date line — NBSP / odd line endings from the client app copy made it bail (49 skipped, 0 rows).
- **Fix:** normalize NBSP-family spaces + CR line endings before parsing; tolerant date/money token matching; vertical grouping only when no line parses as a full row on its own.
- **Diagnosis:** "No valid rows" now shows the first skipped line so the next paste failure is self-explanatory.

## v4.87.4 - Call-log import: one-field-per-line paste + today is authoritative

- **Bug:** pasting the client app's list copy (each field on its own line — id, date, time, mins, Yes, No, $) parsed 0 rows. Parser now regroups vertical pastes into records (closes on `$` token or new date after 6+ fields).
- **Bug:** today's import used `Math.max(prev, imported)` — correcting to a lower value was a no-op. Import now OVERWRITES `dailyMinutes`/`callsToday` (up or down); monthly/weekly absorb the signed delta (floored at 0). Today also writes `dailyLog` + `historyTimeline` so the progress-bar timeline repaints.
- **Removed:** `devStatsSeed.js` (localhost 09/08 59m seed) — it masked import corrections.
- **Panel flash:** now shows `Today: old m → new m` + version tag.

## v4.87.2 - Speech auto-start: call state sticks (stale closure fix)
- **Bug:** when a call auto-started from speech (audio attached, no call yet), the Deepgram socket handler held a stale `isActive=false` closure — `startSession()` re-ran on EVERY confident transcript, resetting the call timer to 0, spamming timeline `work` events + purse-open sound. ON-call tracking looked broken.
- **Fix:** live refs in the Results handler (`isActiveLiveRef`, `isZombieCallLiveRef`), `trySpeechAutoStart` guard now ref-based (`isActiveStateRef`), and `startSession` refuses double-start while active (recovery exempt).
- On/off-call detection itself is unchanged: transcript confidence > 0.4 → ON call; silence watchdog (3 prompts + 7 min, hold-exempt) → OFF call.

## v4.87.1 - Call-log paste actually works + 09/08 seed

- **Settings → Data:** paste now accepts space-separated rows (chat/monitor copy with no tabs) + space header, not just TSV/CSV — your 4-row paste previews 59m/4 calls instead of "No valid rows".
- **Today import:** seeds via max() (never clobbers live-banked minutes), monthly/weekly absorb the seeded delta, re-import is a no-op — counter keeps going up, hot-reload safe (localStorage + apply-once seed).
- **Localhost seed:** 2026-09-08 hardcoded — 4 calls = 59m (09:02 13m, 09:35 10m, 10:29 7m, 10:41 29m) so 📞 shows 59m on fresh :3001.
- **Soundboard Studio:** 14 verbatim handbook scripts (`scripts.txt`, "By the Book") preloaded as recording texts — openers, direct dial, repeat/segments/interrupt/static, ghost, stay/leave, blocked, voicemail, operator 12241, closing, LEP bye. `greeting_en/es` + `sign_off` updated to verbatim. One-time reseed overwrites stale stored texts only (recorded audio untouched; stale legibility health cleared for reseeded keys).
- **VB-out picker selectable:** remembers device labels across origins, explicit hand-pick never auto-overridden, blank slots show stable names + one-Allow guidance, Voicemeeter sink strictly means Standard input.

## v4.87.0 - Daily income bar + editable month target
- **Status bar:** big orange `$ earned today` (live) next to 📞 on-call / 📡 off-call totals (both header spots: side timers + center idle block).
- **Scoreboard ($ MONTH cell):** shows `month minutes / target` pill — click ✎ opens the goal dial to edit the monthly target (default 5500m).
- **Soundboard:** default route back to `passthrough` — the v4.86.2 switch to `dual_element` put two elements on the same virtual sink (patient-side garble; see `docs/soundboard/voicemod-comparison.md`). If your Studio ever set the mode explicitly, it stays as set (`localStorage CATINT_ROUTE_MODE`).
- **Voicemeeter script:** `scripts/setup-voicemeeter-mic.ps1` now takes `-MicName` (default `Realtek`) instead of hardcoded HS-220U, and enables Strip[2]→B1 for app greetings per `docs/soundboard/voicemeeter-mic-plan.md`.
- Tests: 61 suites / 410 tests all pass (fixed 3 stale failures); production build verified.
- **Settings → Data:** company call-log paste import (`CallLogImportPanel`) — paste client-app rows (TSV/CSV), preview per-day on/off minutes, apply overwrites day totals + timeline and seeds today/monthly so scoreboard, progress bar + heatmap follow.
- **VB-Cable attach:** saved CABLE Output ID is validated against live devices (old cross-origin IDs re-picked by label), blank-label origins get one permission prompt, and `OverconstrainedError` retries once — no more silent stuck-on-tab.
- **VB-out picker selectable:** remembers every real device label, so CABLE Input / Voicemeeter Input stay readable on fresh origins; an explicit hand-pick is never auto-overridden (persistence fix); blank-label slots show "Output N · names hidden" + one-Allow guidance; Voicemeeter sink strictly means Standard input (AUX/VAIO3/numbered rejected).

## v4.86.8 - Pins persist across calls
- **Bug fix:** pinned messages were auto-wiped at call start, call end, AND end-of-day — "unpinning themselves". Pins now persist across calls and days.
- Kept: explicit HIPAA wipe-all still clears pins (via `catint_pinned_cleared`); clear-log dialog behavior unchanged ("Pinned messages stay").

## v4.86.7 - Auto-start on speech default ON
- Speech auto-start (`speechAutoConnect`) now defaults to **on** for fresh profiles — if a listening stream detects speech while off-call, the session starts automatically (existing toggle in Settings still respected: `'0'` stays off).
- Auto-stop verified: SilenceGuardian ends ghost calls after 3 silence prompts + 7 min, and trailing silence >30s is deducted from billable time at STOP.
- Total-mins editing: 📞/☕ edit buttons → TimeEditModal (live timer / ±add / set total; fixes daily+monthly together).

## v4.86.6 - Center timers + localhost call-history seed
- Off-call center of the sticky row shows `📞Xm 📡Ym` instead of "Disconnected" (error/connecting/zombie states keep status text).
- `src/utils/devStatsSeed.js` (called from `index.js`): localhost-only apply-once seed of 2026-09-03 call history — 15 calls = 172m — into `catintassist_stats` before first load. Monthly absorbs only the delta.

## v4.86.5 - Draggable scoreboard + sticky-row timers
- Grab bar at the bottom of the expanded scoreboard (portal mode): drag to resize height 18–80vh, persisted in `catint_scoreboard_max_vh`.
- 📞/📡 today timers now also live next to the Connect button in the sticky row (visible even when it says Disconnected).
- Smart tooltips (ElementHint) added for the timers chip; grab bar has title/aria.

## v4.86.4 - Strip de-clutter (low-hanging fruit 1-2)
- Metrics toggle hidden in full-HUD mode where it had no effect (dead button).
- Strip summary drops `% mo · AR$` when the expanded income HUD already shows them; day progress + 📞/📡 timers always visible.
- Audit notes + revert paths: `docs/development/scoreboard-ux-notes.md`.

## v4.86.3 - On/off-call timers + connect width
- Header strip summary now shows today's `📞Xm` (on-call) vs `📡Ym` (off-call = avail+break) next to the daily/monthly summary — glanceable slack/hustle tracker.
- Connect button widened to exactly 2× button cell (two emojis read as two glued buttons).

## v4.86.2 - 12-grid fit fix
- Expanded scoreboard panel cap raised to `min(38vh, 260px)` — 4th grid row (switcher row) no longer clipped.
- Scoreboard grid cells compacted (min-height 56→42px, tighter padding/gap, smaller value font) to reduce padding waste.


## v4.86.1 - Local dev translation gateway
- `npm run gateway` serves `api/translate.js` on `127.0.0.1:59210`; `src/setupProxy.js` routes dev `/api/translate` to it. Translation now works under `npm start` without the Vercel gateway (falls through Azure/DeepL/Google/AWS/MyMemory using `.env` server keys).


## v4.86.0 - Scoreboard de-dupe + 20/80 → guideline
- Off-call expanded Metrics no longer duplicates bars/quick-row where the card, progress stack, or outer controls already show them.
- Flip-panel card can now be opened by the Metrics toggle outside portal mode (never alongside the expanded income HUD).
- 20/80 space rule relaxed to a guideline (docs/scoreboard/README.md): scoreboard may grow off-call; transcription must always stay visible.


## v4.85.17 - Locked-key critical-call recovery
- If a saved Deepgram key is locked, Connect now opens the Deepgram vault directly. Press **Unlock**; if the password is already present, one click restores transcription.
- Missing/locked-key failures now say what broke and show the immediate recovery instead of attempting audio capture first.

## v4.85.16 - Deepgram console outage logs
- Console now logs Deepgram startup, socket open/error/close, API-key failures, and final connection failures.

## v4.85.15 - Ghost-call close
- After the existing three warnings and 7 minutes without Deepgram speech, the app now stops both the work session and Deepgram.
- Holds are excluded. This preserves the conservative threshold while preventing forgotten STOP from skewing time or leaving STT open.

## v4.85.14 - Quiet local translation
- Browser translation now calls the local `127.0.0.1:59200/stt/translate` service first, one mouthful at a time.
- Azure, Google GTX, and MyMemory are no longer browser requests, so their 401/CORS errors cannot pile up in DevTools. The Vercel gateway remains the fallback.

## v4.85.13 - One-click VB work route
- `VB` now auto-selects detected `CABLE Output` for STT and saves it for the shift.
- If CABLE Output is missing, VB refuses to start rather than capture the default physical mic.

## v4.85.12 - Translation browser safety
- Browser no longer calls Azure, DeepL, OpenAI, or Google GTX directly. This stops invalid-key 401s and Google CORS request noise.
- Translation uses the server gateway first, then one rate-limited free fallback; no translation result still falls back visibly rather than blank.

## v4.85.11 - Translation request guard
- Auto translation waits for at least two words, then sends on a final/sentence, split, or each 10 new live words.
- Translation requests are serialized: one active request at a time across bubbles.

## v4.85.10 - Simple translation fallback
- Translation tries the server gateway first, keeping any provider keys off the browser.
- If no server provider is ready, it falls through to Google GTX, then MyMemory; a failed gateway cannot leave the translation pane blank.

## v4.85.9 - Status cat
- Header cat is gray while ready, blue while connecting, green when both STT lanes are live, amber when attention is needed, and red on STT error.
- Silent patients do not turn the cat red; status is based on connection health, not speech volume.

## v4.85.8 - Active-call TAB/VB switcher
- The fixed 30px call row now exposes `TAB`, `VB`, and concise Deepgram/text proof at 900×600.
- Source switches acquire first and persist only after success; failed TAB/VB acquisition leaves the current captions and stream live.
- Work-call connection now selects only Tab or VB-Cable. Physical Mic remains for off-call/testing tools.

## v4.85.7 - Tab-only work calls
- Disabled the inverted physical-mic fallback and stopped persisting mic-test mode into later calls. Tab failure now stays a visible Tab failure.
- If an active call is on Mic, the compact HUD now exposes `USE TAB` to reopen the tab picker immediately.

## v4.85.6 - Bounded scoreboard grid
- Metrics now opens the 12-cell number grid directly, inside a capped 28vh/180px scroll area; it cannot take over the transcription workspace.
- Hovering the CatIntAssist icon now always shows the build version.

## v4.85.5 - Scoreboard restore at 900px
- Restored the off-call scoreboard strip at small-screen widths. Its Metrics button, 12-cell grid, and three progress bars are reachable again; call-mode chrome remains compact.

## v4.85.4 - Clear compact call HUD
- During a call, the I/O strip now shows only Tab proof and Deepgram state; device dropdowns and setup controls are hidden until off-call.
- Removed duplicate slot-style daily timers and normalized all HUD duration inputs to whole seconds, fixing the floating-point OFF value.

## v4.85.3 - Disconnected shift totals
- The disconnected I/O strip now shows daily ON-call and OFF-call workday totals. Deepgram remains closed between calls because streaming is billed by processed audio duration, not recognized words.

## v4.85.2 - Stop keeps Tab ready
- Stop now closes Deepgram between calls while retaining the selected Tab MediaStream. The next Connect reuses it without the tab picker; explicit source switch or browser sharing stop still releases it.

## v4.85.1 - Always-visible workday line
- Compact call mode now shows the 09:00-18:00 timeline: blue calls, orange available time, red breaks, a white current-time line, and literal ON / OFF / LEFT totals.

## v4.85.0 - Translation outage gateway
- Translation tries the private Vercel gateway first: Azure, DeepL, Google Cloud, then Amazon Translate. Browser-only Google/MyMemory remain last-resort legacy fallbacks.

## v4.84.49 - Live bilingual translation
- Translation runs at each 10 new live words, on sentence completion, and on splits. Source-language echoes are rejected.

## v4.84.48 - Cached translation echo guard
- Old cached source-language echoes are discarded before rendering; they cannot appear as a translation.

## v4.84.47 - No duplicate source text
- A failed translation leaves its pane empty; the center rail turns amber while retrying instead of repeating the source language.

## v4.84.46 - Small-screen call chrome
- STT status is a single compact row; Greetings becomes a bottom drawer; the always-visible goal line is blue banked time plus orange current-call time.

## v4.84.45 - Spanish release-note encoding
- Spanish release notes use Unicode escapes so accented characters cannot render as mojibake.

## v4.84.44 - Translation state is explicit
- A source fallback in the translation column is labeled `SOURCE · RETRYING`; it cannot be mistaken for a valid translation.

## v4.84.43 - Softer live text cues
- Only arriving or corrected words softly fade in; already-readable transcript text stays fixed and visible.

## v4.84.42 - Tab proof at a glance
- Persistent Tab proof chip shows: pick tab, attached/opening Deepgram, packets reaching Deepgram, then live text.

## v4.84.41 - Work-safe silence
- Disabled all synthetic reward and alert sound effects. Call audio, TTS, and soundboard clips are unchanged.

## v4.84.40 - Always-visible STT route
- The compact I/O strip remains visible during calls: selected Tab/Cable/Mic route plus Deepgram state.

## v4.84.39 - Tab fails closed
- Tab STT never automatically switches to the physical microphone. Bad tab sharing remains a visible Tab error.

## v4.84.38 - Stop rapid sound loop
- Removed the 150ms celebration coin loop. Audio only plays on explicit call/day events or once per minute.

## v4.84.37 - Tab STT route recovery
- Selecting Tab or VB-Cable clears the saved Mic STT override before Connect.

---

## v4.84.28 — Fix STT: drop medical model (filler_words conflict)
- Root cause: EN socket used `nova-3-medical` + `filler_words=true` — Deepgram only allows filler words on **general** models → EN lane dies / garbles
- Both lanes → `nova-3-general` + numerals; keep filler_words
- Also: arm caption capture before Connect auto-starts call (was dropping early finals until React painted `isActive`)
- Hard refresh + reconnect STT after call (or between calls)

## v4.84.27 — Soundboard “can’t hear myself” routing UX
- Root tip: **VB out = CABLE Input** (not speakers). Windows Listen only hears greetings on the cable.
- I/O strip: detects wrong sink / swapped Input↔Output → ⚠ chip + **Fix → CABLE In**
- Smart ElementHints on 📥 STT in · 🎤 Mic · 🔊 VB out · 🧪 Test · Mic Monitor
- Studio banner when VB out is speakers/wrong

## v4.84.26 — STT accuracy + truthful health rail
- ~~Deepgram: Nova-3 Medical for English~~ — **reverted in v4.84.28** (medical + filler_words unsupported)
- Bottom STT rail turns amber on repeated empty Deepgram replies or an active-call render gate block
- `npm test` runs fresh-memory batches so the full suite does not die midway on Windows

## v4.84.25 — Soundboard picture gallery
- Studio play grid = photo gallery; labels on hover (toggle **Labels** = always on); size slider
- On-call greetings = thumbnail tiles + size slider (was text chips)
- **▶ LIVE to patient** banner + progress while greeting plays (studio + on-call)

## v4.84.24 — Sticky bottom transcript follow
- Default-on **⬇ sticky** toggle; follows live bubble growth (was only new/final)
- Scroll-up still pauses; re-enable via toggle

## v4.84.23 — Connect button mode + robot icons
- Green Connect shows STT mode SVG (bookmark / headset / mic) matching I/O strip
- Robot SVG after mode icon when Deepgram key is unlocked/available

## v4.84.22 — STT route toggle: 🔖 tab · 🎧 VB · 🎤 mic
- Mic joined Tab/VB in the I/O strip 3-way toggle (header mic button removed)
- Emoji labels; picking one clears the others; hotkey M still toggles mic

## v4.84.21 — Off-call tips respect audio mode
- Idle pane / status / scoreboard tips check tab vs VB-Cable vs mic — no more “Tab mode” copy while on VB
- Mode-filtered rotating tips + checklist; newcomer guide step 1/2 matches mode
- VB + mic stay separate (playback differs) but share “device input / no tab picker” tip framing

## v4.84.20 — Release notes modal (ES default) + VB-Cable shine
- Bilingual what's-new modal on first load per version (`ReleaseNotesModal`, `src/content/releaseNotes.js`)
- ES default, EN toggle; **Entendido** / **Ver después** (24h) / **No mostrar de nuevo**
- Post-dismiss: header buttons shine (`catint-ui-shine`) — VB Cable, Tab, → Tab, VB out
- Docs: `docs/onboarding/release-notes.md`

## v4.84.19 — VB-Cable route toggle + tab fallback
- I/O strip: Tab | VB Cable toggle, → Tab backup, cable device pickers
- Tab picker cancel → disconnected (no red error spam)
- Docs: `docs/development/audio-routing-no-spof.md`

## v4.84.17 — Unified button sizing
- Continuity keys by seal ordinal (`g{n}`): live bubble keeps its DOM node when it seals or splits — only the tail mounts new. Kills the vanish/reappear-elsewhere mid-read
- Height lock releases on text shrink (was re-locking at inflated height — the "void" after splits): `liveBubbleHeight.js`
- Repro: `[CAT VANISH] caption_bubble_split` + `caption_split_or_append` on `dg-es-152.82-i` (training video 2026-07-09)

## v4.84.9 — DOM vanish net
- `observeDomVanish`: MutationObserver flags `dom_bubble_removed` / `dom_bubble_relocated` even when no words are lost

## v4.84.8 — Name chips: ES cues + accent fix
- `mi nombre es Maria Lopez` → strong cue (lowercase OK); bare `soy Josefina` → weak cue (Capitalized required)
- ES role/condition stopwords: `soy la intérprete` / `soy alérgica` / `Soy Diabética` never chip
- Accented letters no longer truncate captures (`Diabética` ≠ `Diab` chip)
- Brief acceptance tests added: `I'm here`, `me llamo Josefina`, `Dr. Perez`

## v4.84.7 — Phase E dosage / money units
- `500 mg`, `2.5 ml`, `$25.00` highlight/copy as one unit (not lone digits)
- Phones/dates still separate; overlap unchanged

## v4.84.6 — Phase D spelling soften
- Display keeps spoken spelling paragraph (no `\n` mono remount cliff)
- Sealed trailing **Spelled** chip still consolidates (SMITH); `formatSpellingText` opt-in only
- Removed InteractiveText spelling-branch layout swap

## v4.84.5 — Phase C sentinels wired
- `detectSentinelContext` gates display stitch/phone format
- Skip stitch: date · address · email · spelling
- Skip phone format: those + dosage · medication · price
- phone/ssn modes still format; overlap guards unchanged

## v4.84.4 — Phase B date units
- Date spans (`May 8 1990`, `8 May 1990`, `3/15/26`) highlight/copy as **one** unit (ISO when year present)
- Mask dates before digit stitch/phone format; skip stitch near month/year
- `8 mg` stays a lone number; phones still group
- Plan: `docs/development/sensitive-data-approach.md`

## v4.84.3 — Phase A name chips
- `I'm sorry` no longer → Name chip (stopwords + weak-cue Capitalized gate)
- Chips: sealed bubbles only; trailing under text (not slab above)
- Plan + diagram: `docs/development/sensitive-data-approach.md`

## v4.84.2 — Vanish / derender console flags
- `window.__catintVanishTrace` + `[CAT VANISH]` logs when words/segments shorten, remount, or derender
- Wired: overlap strip, hallucination prune, digit stitch/phone reformat, spelling layout flip, live→sealed, morph diff, caption split
- Mute: `window.__catintVanishOn = false`
- Protector audit note: dates/dosage/address are detect-only (no formatters); spelling ≥3 “as in” flips sealed layout

## v4.84.1 — Continuity-preserving StableTextMorph
- Live source: word-level `diffWordsStable` + `StableTextMorph` (A→B without blank remount)
- Changed spans: brief `from ⇢ to` cue; protected tokens (phones/doses) never vanish
- Reduced motion: instant highlighted patch (no typewriter)
- ScrambleText remains for non-critical UI only

## v4.84.0 — Stable transcript display
- Live STT source: no ScrambleText; single `StableLiveTranscriptText` path (committed prefix + uncertain tail)
- Continuity keys by turnId so live id flips do not remount readable text
- Sealed bubbles: no typewriter/scramble; translation column isolated from source reflow
- Helpers/tests: `stableLiveTranscript.js`

## v4.83.1 — Phase 0 viewport / Azure blockers
- Azure status: missing / unauthorized·key-region mismatch / error / ok (success-only) / paused; fallback-chain banner
- Live bubble height: anti-jitter only; release on shrink/seal/split (no historic max slab)
- On-call soundboard: `grid-column: 1 / -1` above transcript+tools
- STT: single bottom status rail (removed top absolute + pending bubble)

## v4.83.0 — Phase 0 Smoke Dashboard
- Settings → Behavior → Phase 0 Smoke: operator checklist + live stack probes
- Does not re-implement v4.81/v4.82; proves them on the real stack
- `npm run test:phase0-smoke` · docs: `development/phase0-smoke-dashboard.md`

## v4.82.0 — Translation safety ledger
- Pure `applyTranslationResult` — keyed `captionId::segmentId::sourceHash::targetLang`
- Invariant: weaker never overwrites stronger (`preserved: true` / strength rank)
- Filler-only target (`bueno`…) rejected; blank/fail → source passthrough (never silent blank)
- Sensitive-token salvage / `weak_digit_loss`; reformatted phones count as present
- Long monologue → ~40-word chunks (removed >80 hard reject)
- Persist sealed translations on `caption.translations` in IDB; hydrate on refresh
- `stopSession` clears revenant/zombie re-attach gate
- `npm run test:translation` + fixtures
- Docs: [`development/translation-reliability-harness.md`](development/translation-reliability-harness.md)

## v4.81.0 — Transcription test harness
- `applyDeepgramTranscriptPayload` — live WS + fixtures share one reducer path
- Fixtures (fake PHI only): phone, dosage, DOB, address, bilingual, low-confidence, disconnect-reconnect
- Settings → Behavior → Test Harness (`REACT_APP_DEV_TEST_HARNESS` for prod unlock)
- `npm run test:fixtures` / `test:transcription`
- Docs: [`development/transcription-test-harness.md`](development/transcription-test-harness.md)

## v4.78.0 — Corrections backup + export pack
- Settings → **Data** tab: export/import/clear taught corrections
- `exports/audio-greeting-editor/` — spin-off waveform editor (documented)
- Compliance docs: `docs/compliance/`
- Tests for exported `audioEditorCore`

## v4.77.0 — Production readiness (a11y + PWA)
- Fixed broken PWA manifest (missing icon 404s)
- Clear-log confirm; footer a11y; skip-to-transcript link
- Reduced-motion support (CSS + ScrambleText)
- Modal focus trap; dev-only Deepgram console noise
- Docs: [`development/production-readiness.md`](development/production-readiness.md)

## v4.76.0 — Bubble corrections (teach STT + glossary)
- Double-click / ✎ on source or translation → floating editor → **Save & teach**
- STT corrections auto-replace misheard phrases; glossary skips API for exact sentences
- Docs: [`transcription-pane/corrections.md`](transcription-pane/corrections.md)

## v4.75.8 — Debug ingest cleanup
- Removed `127.0.0.1:7891` debug probes from hot paths (`useDeepgram`, `TranscriptionBoard`, `App`, etc.)
- Tail preview render tighten; dead CSS removed

## v4.75.7 — Blue tail + render tighten
- Stable `resolveTailHighlight()` for split rollover
- `MemoInteractiveText` + plain-text tail (no scramble on tail)

## v4.75.6 — Transcript copy + digit stitch
- `CopyChip` rows for names / spelled text above bubbles
- `stitchSingleDigitSequences()` — phone digits copy without spaces
- `collectCopyableEntities()` in `transcriptFormat.js`

## v4.75.5 — ElementHint tooltips
- Rich hover tooltips: unique name + **copy selector** button
- Wired on header, scoreboard strip, 12-grid metrics, I/O strip
- Docs: [`development/element-hint.md`](development/element-hint.md)

---

*Older releases: see collapsible **Completed Tasks** in root `AGENTS.md`.*
