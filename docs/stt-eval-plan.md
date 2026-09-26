# STT eval — medical + legal transcription quality

**Why:** interpreting is medical and legal. A wrong drug name, a wrong dose or a
dropped "denies" changes what the doctor ordered and what the patient agreed to.
Today **no metric exists** in the repo (no WER, no term accuracy), so every
"improvement" is a guess — and the worst bug class is *Deepgram right, app wrong*
(the app damaging correct text, e.g. digits scattering across bubbles).

**How:** score through the **real** pipeline, twice per case — the raw provider
hypothesis *and* the text the user actually reads. The difference between them is
**pipeline damage**, our own contribution to the error.

---

## Stage 1 — v4.154.0 · eval harness (no audio, $0 Deepgram)

- `src/utils/sttEval.js` (pure, no React): normalization policy, word-level
  Levenshtein + backtrace, `wer`, `termAccuracy`, `digitRunRecall`,
  `criticalPhraseRecall`, `scoreEvalCase`, `summarizeEval`, `renderEvalReport`,
  `collectConfusions` (which word got mangled into which).
- `src/fixtures/eval/*.json`: cases with `reference` + `kind: medical|legal|general`,
  optional `criticalPhrases` / `terms`, and **optional Deepgram-shaped `events`**
  which are replayed through the live engine (`replayFixtureEvents`).
- Report: `npm run eval:stt` (jest runner that prints a markdown table and gates
  thresholds; warn before fail so ordinary refactors don't go red).
- Report script is jest-based on purpose: `src/` is ESM inside a CJS package, so a
  plain `node scripts/*.js` cannot import it without a build step. The table
  builder is a pure function (`renderEvalReport`) so a real CLI can be added later.

### Metric definitions (frozen — do not silently change)

| Metric | Meaning | Why it matters |
|---|---|---|
| `werRaw` | word error rate, provider text vs reference | Deepgram's own quality |
| `werDisplay` | word error rate, text the user reads vs reference | the number that decides if I can trust the app |
| `damage` | `errorsDisplay − errorsRaw` | words our pipeline added/removed/destroyed. **Must be ≤ 0** in healthy state |
| `termAccuracy` | critical terms present in display text | drug names, legal terms |
| `digitRunRecall` | digit runs from the reference present in display | doses, vitals, IDs, phone |
| `criticalPhraseRecall` | negations/critical phrases kept | "denies", "no", "negative for" — meaning flips are the dangerous ones |
| `repairGain` (v4.155.0) | words the domain lexicon saved vs. the unrepaired text | is the lexicon worth switching on? |
| `mix` row (v4.155.0) | the same metrics weighted by how often the case really happens | a deposition must not outvote a dose |

### Normalization policy (documented, part of the metric)

1. lowercase + strip punctuation, collapse whitespace.
2. `filler_words` are stripped from **both** sides (Deepgram's filler output is
   not an error; `cleanFillerWords` already removes them in the app).
3. Number words are folded on **both** sides via `convertEnglishNumberWords`
   ("five hundred milligrams" → "500 milligrams") so formatting is not scored.
4. Phone/SSN **grouping** is undone on both sides (555-123-4567 → 5551234567):
   our formatting is a display choice, not an error.
5. Everything else (`formatTranscriptForDisplay`, splits, chips) is **display only**
   and is scored separately through the pipeline replay.

---

## Stage 2 — v4.155.0/v4.155.1 · domain lexicons + display-side repair · **SHIPPED**

- `src/utils/domainLexicon.js`: ~40 rules `{term, lang, kind, mishears[], context[]}` —
  medical EN (drugs + clinical), medical ES, and the legal 3% (exhibit/deposition/
  objection/affidavit/subpoena + insurance billing words). `SAFE_DOMAIN_REPAIR_RULES`
  drops any rule containing a digit **at load time**.
- `applyDomainRepair(text, lang) → {text, repairs[], reverted, negated[]}`.
- `findNegationGaps(text, lang)`: **report-only**. A dropped "denies" is
  indistinguishable from an affirmative statement, so auto-inserting it would
  invent a diagnosis. Logged, never written.
- `src/utils/displaySourceText.js` → `resolveDisplayText()`: the single pure
  place that decides what a bubble shows (user ✎ > corrections store > lexicon).
- `src/utils/domainRepairSetting.js`: the Settings → Deepgram **Term repair**
  switch. **Ships OFF** — with it off the transcript is byte-identical to
  v4.154.0, and that promise is a test.
- New metric `repairGain` + gate `checkRepairSafety` on **every** case, forever:
  the lexicon may never make the text worse and may never move a digit run.
  (Not per-fixture configurable on purpose: a lexicon that *sometimes* moves a
  digit eventually hands a patient the wrong dose.)
- Harness now weights cases by how often they really happen
  (`KIND_MIX_WEIGHT`: medical 1, legal 0.2) so a deposition cannot outvote a dose.

### The house rules this file obeys (all unit-tested)

| # | Rule | Enforced by |
|---|---|---|
| 1 | only spellings literally in the table | no fuzzy matching anywhere |
| 2 | never touches a digit | filter at load + final digit-run equality check (`reverted`) |
| 3 | if the right word is already there, do nothing | idempotent, no double-correct |
| 4 | a context word must be nearby | `context[]` gate |
| 5 | never inserts a missing negation | `findNegationGaps` returns data, never text |
| 6 | every repair is logged | `repairs[]` → `catLog('[domain-repair]')` |

### v4.155.1 — the false alarm

`vanishTrace.lostWords` compared raw whitespace tokens, so Deepgram's
re-punctuation on finalize (`82` → `82,`) reported `lost: ['82','96']` on
**every call**. The alarm meant to catch a vanishing phone number was crying
wolf constantly. Now words compare by letters+digits only.

## Stage 3 — provider-side, only if the harness proves the win

- `keyterm` biasing on both sockets (Deepgram supports it on `nova-3`; 500-token
  hard cap, Deepgram's own guidance is 20–50 terms; force-fitting is a documented
  failure mode, so the list stays short and high-precision). Opt-in toggle.
- EN socket → `nova-3-medical` (**English only** — the app's EN/ES two-lane
  structure fits exactly; ES stays `nova-3-general`). ~2x EN cost while testing.
- Re-test `filler_words=true`: it is not documented for Nova-3 (Deepgram lists it
  as a Nova-2 feature), and the code comment blames "medical + filler_words" for
  killing the EN socket. That comment may be the wrong culprit.
- Before/after report from the same corpus + live probe (latency, socket health).

## Stage 4 — later, needs explicit OK

- Corrections → "teach Deepgram" candidate list (user approves each; only the
  single word leaves the machine, never the sentence).
- A ~40-sentence self-recorded audio set (one-time 10 min, no PHI) for true audio
  WER and future model A/Bs.

---

## Open decisions (defaults if not answered)

| Question | Default |
|---|---|
| Corpus source | user records ~40 scripted sentences once; until then the shipped synthetic corpus is the baseline |
| Deepgram A/B spend | one run, then pick a winner and stop measuring |
| Biggest pain | drug names → negation → doses/vitals → legal terms |

## Cost / risk

| Item | Cost | Risk |
|---|---|---|
| Stage 1 | none | none (offline, no audio, no network) |
| Stage 2 | none | wrong repair could alter text — hence known-terms-only + logged + reversible |
| Stage 3 | Deepgram minutes (EN ~2x) | force-fitting (invented terms), socket instability, latency |
| Corpus of real audio | none | PHI — must be self-recorded or fully synthetic |

## Related

`docs/ROADMAP.md` (Phase 0) · `docs/transcription-pane/corrections.md` (the ✎
loop that Stage 2 reuses) · `src/fixtures/transcription/` (pipeline fixtures)
