# Changelog (recent)

**Version source:** `src/constants/version.js` (must match `package.json` + top-right UI pill)

---

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
