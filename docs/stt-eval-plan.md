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

## Stage 2 — v4.155.0 · domain lexicons + display-side repair

- `src/utils/domainLexicon.js`: medical EN/ES + legal EN/ES terms, each with the
  spellings they actually get mangled into. Seeds: the 20 terms in
  `medicalTermLexicon.js` (whose `applyMedicalBias` is a **no-op** today), the
  user's ✎ corrections store (`transcriptCorrections.js` — real, human-labelled
  misrecognitions, already local), plus a curated starter list.
- `applyDomainRepair()`: display-side safety net when the provider still misses a
  term. Hard rules: **known terms only**, **never touches digits**, and **every
  repair is logged** (catLog + inspector) so it is auditable and revertible.
- Priority order: drug names → negation/meaning flips → doses & vitals → legal terms.

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
