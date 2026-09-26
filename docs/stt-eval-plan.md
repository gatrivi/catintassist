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

## v4.156.0 — negation guard (the visible half) · **SHIPPED**

v4.155.0 detected dropped negations but only wrote them to the console. The one
error class that can change what a patient agreed to had **no signal on screen**.

- `src/utils/negationGuard.js` (split out of the lexicon): `findNegationGaps()`
  is **read-only** — it returns `{expect, snippet}` and never edits a word. Plus
  `hasNegationCue()` and the tooltip text.
- **Precision over recall, on purpose.** "He is allergic to penicillin" is a
  normal affirmative; flagging it would fire all day and get muted. Only
  *degenerate* shapes warn: a complaint glued to the subject ("patient chest
  pain") or a bare "any …". The test file therefore carries **more
  must-not-warn sentences than must-warn ones**.
- `clinicalGuards.js` holds both switches, built by one `makeGuard` helper.
  They are independent: the read-only guard must not hide behind the rewrite.
- UI: amber ⚠ in the bubble rail **on the word-count line** — zero extra height.
- Harness: `checkNegationGuard()` returns recall, precision and `offenders[]`
  (MISSED / FALSE POSITIVE with the offending text). Gated: **recall 1.0**,
  precision ≥ 80%. Today: recall 2/2, precision 16/16 clean lines.

### The honest limit

This guard catches *degenerate* dropped negations, not every possible one. "She
is not diabetic" misheard as "she diabetic" is the same audio and leaves a
perfectly well-formed sentence — nothing in the text betrays it. That is where
the ✎ correction loop and the corpus probe remain the backstop, and where
provider-side work (Stage 3) is the only real fix.

## Stage 3 — provider-side · **v4.157.0 SHIPPED (switches OFF) · A/B still owed**

Code is in place and gated; the measurement is not.

- **Medical model (EN)** — `getDeepgramModel(lang, {medicalModel})` sends the EN
  socket to `nova-3-medical`. ES stays `nova-3-general`: the app's two-lane
  EN/ES structure fits this exactly. ~2x EN cost.
- **Keyterm bias** — `buildKeyterms(lang)` in `src/utils/sttKeyterms.js`. The list
  comes **from the domain lexicon**, so it only ever contains words already proven
  mangled. Capped 30 terms / 500 tokens, medical first. Unknown lane → empty list.
- Both default OFF and are read at CONNECT time. With both off the listen URL is
  byte-identical to v4.154.0 (locked by a test).
- Force-fitting watch: the eval already reports `INVENTED terms` (a term that
  appears when the reference has none). **If the A/B shows invented terms, the
  list is too long or too greedy — cut it, do not tune the weights.**

### The run that is still owed

1. Baseline call, both switches off. Keep the transcript.
2. Keyterm bias ON, one call. Compare drug names; check for invented terms.
3. Medical model ON, one call. Compare WER/digits; watch socket stability + latency.
4. One number decides: keep the winner, stop measuring.

- Re-test `filler_words=true`: it is not documented for Nova-3 (Deepgram lists it
  as a Nova-2 feature), and the code comment blames "medical + filler_words" for
  killing the EN socket. That comment may be the wrong culprit. **Untouched on
  purpose** — a socket-stability risk needs a live run, not a guess.

## Stage 4 — corrections → keyterms · **v4.158.0 SHIPPED (off by default)**

- `keytermsFromCorrections()` feeds the operator's own ✎ corrections into the
  keyterm list, ranked by how often each word was fixed. The human outranks the
  shipped lexicon, because a human actually heard it.
- Guards: only the **corrected** word goes out; digits are refused (a dose is not
  a vocabulary item); ≤2 words; per-lane only.
- Its own switch (`My corrections as terms`), off by default, and inert unless
  *Keyterm bias* is also on. Settings displays the exact list that would be sent.
- **Remaining:** the user is the approver in the loop already — they typed it. No
  per-term approval UI is planned; the on-panel list is the review.

## Stage 5 — the corpus of real audio (needs you, needs 10 minutes)

- Everything measured so far is text-level: provider text vs displayed text, with
  the provider text supplied by fixtures. No number here measures a *mic*.
- One-time ~10 min of self-recorded scripted sentences (no PHI, no patients) and
  the harness can score real audio WER — which is the only way to settle the
  `nova-3-medical` / `keyterm` / `filler_words` questions with evidence instead of
  a comment.

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
