Fix CPU freeze from permanent blank caption + render-path logging (v4.93.2)

**1. Never emit blank rows — `src/utils/captionEngine.js` (root fix)**
- `mergeCaptionsForUi` (line ~65): only merge `liveDraft` if it has non-empty `text`:
  `const merged = liveDraft?.text?.trim() ? [...finals, liveDraft] : [...finals];`
- Also make the `overlap_empty_freeze` early-return (~line 242-254) strip the blank draft it just appended instead of keeping it, so the blank row can't persist to IDB / be resurrected on reload.

**2. Stop logging from render — `src/components/TranscriptionBoard.js:1326-1341`**
- Dedupe: keep a `Set` ref of already-flagged blank caption ids; each blank id logs once per session, not once per render. (Keep `return null` skip logic.)

**3. Keep / confirm the 1s interval** (`TranscriptionBoard.js:800`, already in working tree) — verify the dev server is serving the patched file; optionally isolate `sttNow` into the small status subcomponent later if 1Hz full-board renders still cost too much.

**4. Tests + verify**
- Add/extend captionEngine test: overlap-empty input must not leave a blank row in `mergeCaptionsForUi` output.
- Run existing test suite (`translationFixtureReplay`, captionEngine-related tests) + build.
- Bump version (v4.93.2), show version number in message; update docs/CHANGELOG.md. Push only if tests+build green (via safe-push script).