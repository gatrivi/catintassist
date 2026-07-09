# Transcription Pane (v4.84.8)

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
- `src/components/TranscriptionBoard.js` (bubbles + columns + corrections UI)
- `src/components/BubbleCorrectionEditor.js` (floating fix panel)
- `src/utils/transcriptCorrections.js` (STT + glossary store)
- `src/hooks/useDeepgram.js` (captions, `lang`, dual sockets, tie-break)
- `src/hooks/useTranslate.js` (per-bubble translation + glossary)
- `src/utils/transcriptFormat.js` (copy chips, spelling consolidate)
- `src/utils/sensitiveDataProtector.js` (phone/SSN, dates, dose/money, sentinels)

## 8) Copy chips + sensitive highlights (v4.75.6+ / v4.84.8)
- Names / spelled: trailing `CopyChip` on **sealed** only; spoken spelling paragraph stays (no `\n` remount)
- Weak cues (`I'm` / `I am` / `soy`): Capitalized name required — `I'm sorry` / `soy alérgica` ≠ name
- Strong ES: `me llamo` / `mi nombre es` (lowercase OK); accents via `tokenStem` (v4.84.8)
- Highlight units (click-copy): phone/SSN digits · full **date** (ISO when year) · **dosage** (`500 mg`) · **money** (`$25`)
- Sentinels gate stitch/phone format on address/email/spelling/date/dosage cues
- Plan: [`../development/sensitive-data-approach.md`](../development/sensitive-data-approach.md)

## 9) Teach corrections (v4.76.0) — **read this**
Full guide: [`corrections.md`](corrections.md)

TLDR:
- Double-click white column → fix transcription → future phrases auto-correct
- Double-click gray column → fix translation → exact sentence uses your text next time
- ✎ on hover · Ctrl+Enter save · green edge = user-corrected

## 10) Quick self-test (Mic Test)
1. `npm start` → localhost:3000
2. 🎤 on → Connect → allow mic
3. Speak English → white EN left, gray ES right
4. Speak Spanish → gray EN left, white ES right

## 11) Zero-waste main view (UI constraints)
Goals:
- Flush alignment: transcription bubbles reach the bottom of the screen.
- Chrome buffer: keep a ~24px (1 line) safety spacer at the absolute bottom to prevent UI labels from hiding the latest line.
- No redundant vertical margins inside `TranscriptionBoard` container.
- Bubble overlays: language badges can render as faint overlays on bubbles (saves vertical space).

Core interaction features:
- Pinning: important messages can be pinned
- Auto-scroll anchored to latest transcript
- Inactivity detect: Silence Guardian monitors this view for active audio flow

## 12) No Vanishing Text / StableTextMorph (v4.84.1+) — **rendering invariant**
Standing rule (also in `AGENTS.md` MAINVIEW + `handoff/00_global_rules.md`):

- Never destroy readable text **A** and remount blank **B**.
- Morph **A→B** on the **same mount**: stable prefix stays visible; only changed spans cue (`from ⇢ to`); **no blank frame**.
- Protected tokens (phones, dates, doses, money, digit runs) **never vanish** during interim→final or correction morphs.
- Continuity keys by `turnId` so live id flips do not remount readable text.
- **ScrambleText ≠ critical live transcript** — keep for non-critical UI only.
- Code: `StableTextMorph.js` · `diffWordsStable.js` · `stableLiveTranscript.js` · live path in `TranscriptionBoard.js`

Manual smoke: long correction only changes the span; prefix stays; phone does not vanish; seal/split does not blank the line.


