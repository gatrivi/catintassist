# Changelog (recent)

**Version source:** `src/constants/version.js` (must match `package.json` + top-right UI pill)

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
