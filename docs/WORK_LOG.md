# Work Log

Short operator-readable notes for recent Codex work. Use this when you want to catch up fast without reading chat history.

## v4.78.8 - STT pending rail
- Problem: audio could reach Deepgram for several seconds before any transcript appeared, especially during phone numbers.
- Change: `useDeepgram` now tracks `lastAudioChunkAt`; `TranscriptionBoard` shows a temporary "Hearing audio... / Waiting for Deepgram text..." row before text arrives.
- Why it matters: bubble rail now indicates that speech is in flight instead of appearing only after transcription.
- Verify: during a call, speak before transcript appears; a blue pending rail should show within about a second.

## v4.78.7 - call layout guard
- Problem: in-call layout could let the soundboard or notes steal most of the viewport.
- Change: `#main-transcript.notes-open` now pins the soundboard strip to a small top row, transcript to the main left cell, and notes to a constrained right column.
- Why it matters: transcription/translation remains the main work surface.
- Verify: start/reattach call, open notes; transcript must remain dominant and soundboard must stay a strip.

## v4.78.6 - transcript audio manual only
- Problem: transcript messages could make sound automatically, interfering with patient/doctor audio.
- Change: removed long-bubble auto ping and removed translation auto-play mode from transcript footer.
- Why it matters: transcript surface is silent unless the operator manually presses a play control.
- Verify: new transcript messages should never make sound by themselves; footer says `TTS:MANUAL`.

## v4.78.5 - off-call quick notes
- Problem: quick notes toggled state off-call but the notes panel was not mounted.
- Change: notes panel can render off-call, on-call, and in soundboard mode; blocked editor state now shows a visible message.
- Why it matters: the quick notes button is no longer a silent no-op.
- Verify: off-call, press quick notes; notes should appear or show why blocked.

## v4.78.4 - quick notes + usable hints
- Problem: quick notes did not focus the writing area; ElementHint copy button disappeared before it could be clicked.
- Change: notes textarea gets focus on open; tooltip is function-first and stays open on hover/tap long enough to copy selector.
- Why it matters: debug selector remains available without hiding the actual purpose of the control.
- Verify: hover/tap a hinted button; description appears first, selector row is secondary, copy button is reachable.

## v4.78.3 - STT confidence + stable rows
- Problem: transcript rows could flicker when Deepgram replaced interim text, and low-confidence words were invisible as risk.
- Change: Deepgram word confidence flows into captions; source words get subtle confidence coloring; live rows remember max interim height.
- Why it matters: risky words are visible and interim replacement should not shrink/flicker the row.
- Verify: low-confidence words appear amber/red; live row height does not jump downward.

## Queued
- Rebuild the 40-word interpreter warning safely: visual-first, per language/turn, optional quiet audio, never through patient audio, no repeated pings.
- Add 900x600 layout screenshot checks for call default, call+notes, soundboard+notes.
- Continue sensitive data protector work for phone numbers and delayed number transcription.

## Health Commands
```powershell
npm.cmd test -- --watchAll=false --silent
npm.cmd run build
```

Green tests mean core logic is likely OK. Green build means it compiles for live. Live Deepgram quality, browser permissions, and patient audio routing still require manual checks.
