# Transcription Pane (v4.48.2)

## 1) The one table to memorize (columns are fixed)
Columns never swap.

| Speaker | Left (EN) | Right (ES) |
|---|---|---|
| English | transcription (white) | translation (gray/italic) |
| Spanish | translation (gray/italic) | transcription (white) |

Mnemonic: `EN left, ES right always.`

## 2) What the app DOES NOT do
- It does not “swap columns” as a design choice.
- `toggleLanguage()` / `sttLanguage` is an STT preference override, not column swap.

## 3) Hidden STT override (important)
- `sttLanguage` cycles: `auto → en → es → auto`
- Hotkeys (when not typing in an input): `Space`, `Alt+Space`, `Esc`
- Effect: `langModeRef` in `useDeepgram.js` overrides tie-break behavior
- Does not change: `left=EN`, `right=ES`

## 4) Visual styling (so you can read fast)
- Transcription: `#ffffff` white (normal)
- Translation: `#a1a1aa` gray (italic in `.bubble-line-translation`)

## 5) Bug symptom you saw (EN lands on the right)
Symptom: English speech, white text on the right (Spanish column).

Likely cause chain:
1. Two Deepgram sockets (EN + ES) both hear the stream
2. Early ES packet wins tie-break → bubble gets `lang: 'es'`
3. Layout uses `reverse`/CSS logic → thinks Spanish speaker
4. Transcript (still English) renders white on the right

Planned fix direction (documented):
- safer tie-break in `useDeepgram.js`
- refactor bubbles to explicit EN/ES column placement (no CSS-grid swap magic)

## 6) Mic Test vs tab audio
- 🎤 OFF (default): browser tab audio capture
- 🎤 ON: your microphone (`getUserMedia`)

Mic Test mode persists in `localStorage` (`catint_mic_test_mode_v1`).

## 7) Key files (when debugging layout)
- `src/components/TranscriptionBoard.js` (bubbles + columns)
- `src/hooks/useDeepgram.js` (captions, `lang`, dual sockets, tie-break)
- `src/hooks/useTranslate.js` (per-bubble translation)

## 8) Quick self-test (Mic Test)
1. `npm start` → localhost:3000
2. 🎤 on → Connect → allow mic
3. Speak English → white EN left, gray ES right
4. Speak Spanish → gray EN left, white ES right

## 9) Zero-waste main view (UI constraints)
Goals:
- Flush alignment: transcription bubbles reach the bottom of the screen.
- Chrome buffer: keep a ~24px (1 line) safety spacer at the absolute bottom to prevent UI labels from hiding the latest line.
- No redundant vertical margins inside `TranscriptionBoard` container.
- Bubble overlays: language badges can render as faint overlays on bubbles (saves vertical space).

Core interaction features:
- Pinning: important messages can be pinned
- Auto-scroll anchored to latest transcript
- Inactivity detect: Silence Guardian monitors this view for active audio flow


