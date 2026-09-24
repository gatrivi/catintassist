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
- Auto-scroll anchored to latest transcript — **rule (v4.145.0): follow unless the operator scrolled away.**
  Only a real gesture (wheel up / drag / scrollbar) pauses it; every other scroll event —
  browser scroll-anchoring, late layout, our own scroll — means "snap back to the newest line".
  Pane scrolls directly (`pane.scrollTop = pane.scrollHeight`), `overflow-anchor: none`,
  settle passes at 120/400 ms. Logic: `src/utils/stickyScroll.js` · paused state shows `⬇ N new` in amber.
- Inactivity detect: Silence Guardian monitors this view for active audio flow

## 12) No Vanishing Text / StableTextMorph (v4.84.1+) — **rendering invariant**
Standing rule (also in `AGENTS.md` MAINVIEW + `handoff/00_global_rules.md`):

- Never destroy readable text **A** and remount blank **B**.
- Morph **A→B** on the **same mount**: stable prefix stays visible; only changed spans cue; **no blank frame**.
- Protected tokens (phones, dates, doses, money, digit runs) **never vanish** during interim→final or correction morphs.
- Continuity keys by `turnId` so live id flips do not remount readable text.
- **ScrambleText ≠ critical live transcript** — keep for non-critical UI only.
- Code: `StableTextMorph.js` · `diffWordsStable.js` · `stableLiveTranscript.js` · live path in `TranscriptionBoard.js`

Manual smoke: long correction only changes the span; prefix stays; phone does not vanish; seal/split does not blank the line.

### 12b) Supersede presentation model (v4.140.0)
Deepgram rewrites interim wording for the same speech. Reported symptom: the words
being read vanish mid-read, so the interpreter cuts off mid-sentence.

- **Old wording is dimmed, not deleted**: superseded words stay on screen at
  **≥70% visual weight** (`#94a3b8`, no strike-through) while the replacing
  wording gets a **bright frame/edge** (`stm-arriving`). The floor was raised
  from ~25% in **v4.142.0** (see §12d) — the dim copy must stay readable.
  Protected tokens (numbers/doses/money) hold at readable weight
  (`stm-superseded--protected`). Superseded wording keeps **no copy chip** — a
  stale phone/dose must never be one click away (it stays selectable and
  readable, just not "click to copy").
- **Episode base**: the first revision freezes the wording you are reading; every
  later revision re-diffs against THAT, so dimmed text neither flickers back to
  full brightness nor accumulates as duplicates.
- **Bounded lifecycle** (defaults; override per call via props):

  | Phase | Default | Prop |
  |---|---|---|
  | hold — dimmed wording stays readable | **1500 ms** | `supersedeHoldMs` |
  | retire — exit fade (derender is eased) | **320 ms** | `supersedeRetireMs` |
  | hard cap per episode | 4000 ms | `SUPERSEDE_MAX_EPISODE_MS` |

- **Quiet adopt** (no dim, no frame): rewrites whose new words are *equal or
  lower* confidence, plus any revision arriving after the episode cap. Two
  live-looking versions of one phrase confuse more than a clean in-place update.
- **Reduced motion** (`prefersReducedMotion`): animations off, hold 120 ms,
  retire 0 ms; non-protected superseded words leave at once, digits still hold.
- Decision logic is pure: `src/utils/textSupersede.js` (`classifySupersede`,
  `presentOpParts`, `resolveSupersedeTiming`) with colocated tests; the component
  owns only timers (one pending stage at a time).
- Telemetry: `morph_supersede` plus the existing `morph_word_diff` in the vanish trace.
- Fixture: `src/fixtures/transcription/interim-rewrite.json` — same row id
  rewritten in place, and a phone rewrite refused by the v4.136.0 digit guard.
- **No duplicate wording (v4.141.0)**: a *reorder* diffs as
  `delete(old) + equal(middle) + insert(new)`, so the dimmed copy used to print
  words the current line already contains ("…for?Yourself, Anna?"). The dim copy
  is dropped only when `isRedundantSupersededPart(text, currentText)` is true —
  its words are a **contiguous run of the wording on screen** and it carries no
  digit. A real retraction ("take 5 mg daily" → "take 5 mg") keeps its dim copy,
  so nothing absent from the current wording is ever hidden.

### 12c) Restarted segment rule (v4.141.0) — **one line, one copy**
Deepgram sometimes re-delivers a segment it already finalized on the same lane
(audio re-cut, reconnect replay, re-segmentation). The overlap guard only cleans
a repeat that starts at the base's **tail** (`addition prefix ≡ base suffix`) and
it cancels itself near digits/clinical words, so a restart that re-states a
phrase from the **head or middle** of a line used to be appended to that line
(`captionEngine.js`: `merged = finalized + " " + cleaned`) → the fragment printed
**twice inside one row**, then sealed, persisted and translated.

Rule — **route, never delete**:

- `restatedHeadWindow(base, addition)` (exported from `captionEngine.js`) returns
  the longest run of **leading** words of the arriving segment that occurs
  anywhere in that lane's finalized text; `RESTART_MIN_WORDS = 4` is the bar.
- It only fires on a boundary the overlap guard **cannot** clean on its own
  (`guardStripped === false`); a boundary the guard already cleans is left alone.
- When it fires, the finalized row is kept **verbatim** (marked sealed, it can
  never grow again) and the restart opens a **new bubble** — the same primitive as
  the sentence-boundary split, on both lanes (`enFinalized` / `esFinalized`).
- Telemetry: `caption_restart_split` in the vanish trace (`restatedWords`, lane).
- The sentence-boundary split (`startsAfterPeriod`) only considers **sealed** lane
  text: a live draft plus its own final used to leave two rows with the same
  sentence (the draft was never sealed, a sealed copy opened beside it).
- Guards that must never regress: no transcribed token deleted, digit runs
  intact, the overlap guard's code and `DEDUPE_NEVER_DROP` / clinical-repeat /
  tirade rules untouched, and translation never sees duplicated row text.
- Fixture: `src/fixtures/transcription/interim-restart.json` (the reported
  screenshot sequence). Tests: `captionEngine.test.js` › "restarted segment
  split", `fixtureReplay.test.js` › "interim-restart".

### 12d) Repeated wording net (v4.142.0) — **dim, never remove**
The v4.141.0 rule routes a *restarted* segment to its own bubble, but a duplicate
can still reach the pane (a mid-line re-cut the overlap guard cannot clean, rows
persisted by an older session, the supersede presentation). Reported: one bubble
printed the same ~22-word sentence twice and became "impossible to read".

Rule (the operator's own proposal): **a simple string compare; if a sequence of
words is repeated, dim the later one — but leave it at least 70% visible.**

- Pure detector: `src/utils/repeatedWordRuns.js` → `findRepeatedWordRuns(text,
  {minWords, maxChars})` returns the **character ranges of the LATER
  occurrences** of a word run that already appeared earlier in the same text.
- **Only later copies are marked**; the first occurrence keeps full brightness.
  Matching is case/punctuation-insensitive ("names," ≡ "names"), but the ranges
  map back onto the **original characters** — matching is normalized, rendering
  is not.
- **Minimum run: 4 words** (`MIN_REPEAT_WORDS`) — "no no", "you you" and other
  ordinary speech are untouched. Configurable per call.
- Ranges come back sorted and non-overlapping (`mergeRanges`); work is capped at
  `MAX_SCAN_CHARS` (6000) — past the cap the scan simply stops (no dimming is
  better than dimming the wrong words).
- Render: `src/components/RepeatDimText.js` wraps a dim chunk in
  `<span class="repeat-dim">` and hands every chunk to the call site's own token
  renderer (sensitive-data chips, number highlights, confidence tints keep
  working; `part.wordOffset` keeps word-indexed tinting aligned). Split points are
  at whitespace between words, so no token is ever cut.
- Call sites: live line `StableTextMorph.js` (+ `StableLiveTranscriptText`), and
  `TranscriptionBoard.js` sealed source **and** translation line (`InteractiveText`,
  non-scrambling paths only).
- **Display-only invariant**: the concatenation of the rendered chunks is
  byte-identical to the text that was already on screen. Nothing is deleted,
  hidden, reordered or normalized; digits/doses/phones stay fully present (a
  repeated phone is dimmed like any other repeat, never removed). `textContent`
  equality is asserted in `RepeatDimText.test.js`.
- **Visibility floor**: `.repeat-dim { opacity: 0.72 }` in `src/index.css` — no
  strike-through, no blur, no color override, no font shrink. The floor (0.70,
  `REPEAT_DIM_MIN_OPACITY`) is asserted **from the stylesheet** in
  `RepeatDimText.test.js`, together with the same floor for `.stm-superseded`
  (which also lost its strike-through in v4.142.0).

## 13) Reload / hot-reload mid-call = transcript gap (incident 2026-09-08)
What happened: dev-server hot-reload restarted the app during a live 911 call.
Deepgram sockets + tab audio died with the reload; speech during the gap was
never transcribed, and post-reload text is a new session (no backfill).

Rules:
- **Never run `npm start` (hot-reload) during live calls.** Dev edits can
  recompile at any moment and kill the call session.
- Live shifts: use the **production build** (`npm run build` / deployed URL).
- If dev must stay up alongside: **code-freeze while on a call** — hot-reload
  fires on file save, so no saves/edits until STOP.
- After any reload mid-call: expect the yellow **Re-attach** banner; re-attach
  or reconnect, and note the gap — anything said while down is unrecoverable
  unless the call recording exists elsewhere.


