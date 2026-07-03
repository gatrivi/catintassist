# Changelog (recent)

**Version source:** `src/constants/version.js` (must match `package.json` + top-right UI pill)

---

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
