# Greeting Editor view (v4.118.0) — tldr

Focused per-greeting workspace. **One greeting at a time**, no giant panel.

## Shape
```
┌ 32px micro-header: ← Exit · ✎ Greeting Editor · EN/ES · ◀ ▶ · 🗂 Studio · version ┐
├───────────────┬──────────────────────────────────────────────────────────────────┤
│ rail (168px)  │ main pane                                                        │
│ per family:   │  title + slot + CALL OK / LOCAL ONLY badge                        │
│ name  n/m     │  script (the Deepgram scoring reference)                          │
│ AM/PM/Eve     │  🎙 Record/Re-record · 🔊 You · 📡 Caller ·  Upload · 🗑 Delete    │
│ pills or      │  health pills: legibility (click = paid check) · loudness · chop  │
│ ○ empty       │  inline AudioEditorPanel (waveform crop / silences / re-record)   │
│               │  ▸ Advanced: beep sink · mic monitor · route debug                │
└───────────────┴──────────────────────────────────────────────────────────────────┘
```

## Entry / exit
- **In:** ✎ Editor on the header chips row (`audio-route-greeting-editor-btn`), or ✏️ on any Studio tile → `cat_open_greeting_editor` event with `clipKey` (App.js listens, opens pre-selected).
- **Out:** `← Exit` or Escape → scoreboard. `🗂 Studio` → soundboard overview.
- Transient view: never persisted (`saveWorkspaceView` untouched), so a refresh lands on the scoreboard.

## Safety rules (do not regress)
1. **CALL OK only after a caller test runs to the end.** Raised by the playback tick, never by an effect on "stopped".
2. A cancelled / failed / unbound sink test shows a red message and clears playback — it can never arm the patient path.
3. Failures (storage read, mic, route, Deepgram) render **in the view**. No console-only errors, no `window.confirm`.
4. Deepgram health checks are **explicit only** (paid) — never automatic on upload/record.
5. Recording never saves on unmount; mic tracks + AudioContext always released.

## Files
- `src/components/GreetingEditorView.js` (+ `.css`, `.test.js`) — the view.
- `src/hooks/useGreetingClip.js` (+ `.test.js`) — shared clip data (blobs, waveform, loudness, chop, health) + `useGreetingRecorder`.
- `src/components/GreetingsPanel.js` — Studio stays the catalog; per-clip edit modal retired.
- `src/App.js` — `GREETING_EDITOR_VIEW` mount + event listener.

## Deferred
- Migrating GreetingsPanel onto `useGreetingClip` (it still has its own copy) — later cleanup pass.
- Scoreboard "✎ Edit" dock tile → opens the editor on that clip.