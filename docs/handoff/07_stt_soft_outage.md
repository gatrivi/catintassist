# STT Soft Outage Handoff (v4.80.2)

Use this when transcription speed, confidence coloring, live animation, or bubble flicker feels broken.

## Current Status
- Current local version: `v4.80.2 - STT render recovery`
- Build + tests should pass before push.
- Live Deepgram still needs manual call verification.

## Latest Verified Commands
```powershell
npm.cmd test -- --watchAll=false --silent
npm.cmd run build
```

## v4.80.2 fixes (this sweep)
- **STT FAST/BAL toggle** — header pill + Settings → Deepgram; default FAST; reconnects on change.
- **Latency** — FAST: 100ms MediaRecorder, 100ms interim process/flush, endpointing 150.
- **Live animation** — `ScrambleText liveMode` append-only; no shrink mid-utterance.
- **Confidence visible** — tier colors (white / slate / yellow+underline); `wordConfidenceAlign.js`.
- **Pending rail** — "Hearing audio…" bubble re-enabled during chunk→text gap.
- **Live bubble** — removed 0.6 opacity; blue border glow instead.

## Main Symptoms Seen (pre-v4.80.2)
- Deepgram receives audio chunks but sometimes returns empty transcripts:
  - `[CAT STT] 1 sound received + 2 sound sent`
  - `[CAT STT] 3 Deepgram websocket message received`
  - `[CAT STT] 4 Deepgram processed empty transcript`
- React warned about duplicate caption keys, for example `dg-en-327.31-i`.
- Word confidence coloring did not visibly appear.
- Live text animation did not visibly appear.
- Bottom status area became crowded after STT debug labels were added.

## Changes Shipped In This Sweep

### v4.78.3
- Deepgram word confidence was threaded into captions.
- Live rows track max height to reduce flicker.

### v4.79.7
- Added `window.__catintSttTrace`.
- Console logs use `[CAT STT]`.
- STT stages log sound send, Deepgram receive, text/empty result, caption commit, and render.

### v4.79.9
- Added bottom one-row STT soundbar in `TranscriptionBoard`.
- Added EN/ES socket confidence display.
- Added `words=true` to Deepgram websocket URL. This is required for per-word confidence metadata.

### v4.80.0
- `ScrambleText` now starts empty and reveals live text instead of mounting already complete.
- Caption engine now forces unique ids before returning rows.
- Added test for duplicate id normalization.

### v4.80.1
- `TranscriptionBoard` also guards render keys, because old persisted captions can still contain duplicate ids.
- Removed noisy QuickNotes state logs.

## Key Files
- `src/hooks/useDeepgram.js`: Deepgram websocket URL, MediaRecorder sends, STT trace logs, EN/ES confidence.
- `src/utils/captionEngine.js`: Deepgram event to caption rows, live draft vs sealed rows, duplicate id guard.
- `src/utils/captionEngine.test.js`: confidence metadata and duplicate id tests.
- `src/components/TranscriptionBoard.js`: bubble rendering, bottom STT soundbar, render key guard, render trace.
- `src/components/ScrambleText.js`: live text reveal/shrink animation.
- `src/index.css`: STT soundbar layout and confidence word styling.

## Console Checks
In browser console:
```js
window.__catintSttTrace
```

Read the trace like this:
- Stops at `sound received + sound sent`: audio left browser, Deepgram did not answer.
- Shows `Deepgram processed empty transcript`: Deepgram answered but heard no usable speech.
- Reaches `returned string` but not `caption engine committed`: bug is between `useDeepgram` and `captionEngine`.
- Reaches `caption engine committed` but not `string rendered`: bug is flush/session/render.
- Render log has `wordConfidenceCount: 0`: confidence coloring cannot appear.

## Current Interpretation
- Confidence coloring was partly invisible because the websocket URL was missing `words=true`.
- Animation was partly invisible because `ScrambleText` initialized with the full value.
- Duplicate caption ids were breaking React identity, which can make animation/render behavior unreliable.
- Persisted old duplicate captions may still exist until render guard or clearing transcript handles them.

## Still Open
- Manually verify live Deepgram after hard refresh on `v4.80.1`.
- Confirm `wordConfidenceCount > 0` in live traces.
- Confirm low-confidence words are visibly dim/underlined.
- Confirm duplicate key warning is gone after new captions render.
- Confirm bottom STT soundbar is one row and does not crowd transcript/footer.
- Investigate Microsoft Translator `401 Unauthorized`; unrelated to STT but visible in console.

## Do Not Regress
- Transcript/translation must own 80%+ of viewport.
- No diagnostic boxes inside bubbles.
- No auto audio from transcript messages.
- Interim updates must not shrink row height.
- Existing translations must not be destroyed on bubble split.
- EN column stays left, ES column stays right.
