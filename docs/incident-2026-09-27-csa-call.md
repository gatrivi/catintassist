# v4.169.0 — a CSA call, and what it exposed

Source: a real interpreter session, pasted mid-call. This is the record of what
was wrong and what this release does and does not fix.

## What the transcript showed

| observed | what it means |
|---|---|
| Spanish text sitting in the **English** column | the EN socket transcribed Spanish and stamped it `en` |
| `EN 65% / ES 0%` on the sound rail | per-socket **last-message** confidence; `0%` ≠ `--` means the ES socket was alive but returning nothing |
| `I went to face my husband and my` → 24 words of Spanish with two clauses nobody said | a translation built for a **different, longer** text was composed onto a short tail bubble |
| `My`, `In`, `1`, `24`, `4` as standalone bubbles | the sentence-peel has no minimum length |
| `dónde yo a dónde yo llevé` | no repetition guard anywhere in the translation path |
| `comprobante` appended to a Spanish sentence | a provider hallucination from the mislabelled socket — the string exists nowhere in the repo (0 hits) and no code path can insert a word |

## The three causes (all verified, none is a race)

### 1. The socket label is trusted unconditionally

`useDeepgram.js:1335` decides a payload's language from the language the socket
was **opened with** — a closure constant. The text is never inspected. Then
`captionEngine.js:608-626` re-decides the *displayed* language by a word-count
race, and with the ES lane empty, `leftW >= 0 + 2` always picks English.

Blast radius is wider than the column: `cap.lang` also drives the bubble colour,
`applyDisplayProtections`' number-word map, and the **translation direction** —
so that Spanish got sent to the engines as EN→ES.

**Not fixed here.** The guard is a text sniffer at the payload choke point and
it must ship OFF — a wrong sniff would be worse than the current bug, because it
would mislabel correct English.

### 2. A split bubble inherits its parent's translations, then claims to be done

Four deterministic defects stack:

- `useTranslate.js:190` — on mount, the translation is composed from **all** keys
  in the map, with no filter for the current text.
- `useTranslate.js:204-208` — hydrate then records the **current** text as
  "already translated", using text it never translated.
- `useTranslate.js:324` — the auto-gate therefore **skips** the correct
  translation.
- `useTranslate.js:561` — the freeze rule makes the wrong one **permanent**.

Plus `captionEngine.js:293, 779`: a split copies `translations` into every child
row, still keyed by the **parent's** id, and nothing clears it when the text
changes.

**And the guard that exists for this is dead code:** `sourceHash` and `requestId`
are both built from the same `segText` (`:471-477`), so the `stale` check at
`translationApplicator.js:278-281` compares a value with itself. It has a
passing test; it is only reachable from a fixture.

**Not fixed here.**

### 3. No minimum length on the sentence peel

`transcriptFormat.js:214` `peelCompleteSentences` splits on any `[.!?…]` and has
no floor, so `"I told them I was not well. My"` yields the remainder `"My"` as
its own bubble. `captionEngine.js:422` (the v4.160.0 "Yeah." fix) seals any
non-empty live draft with no floor either.

**Not fixed here.** The chosen fix is to **merge fragments forward, never drop
words** — losing a word is worse than a noisy bubble.

## What this release DOES change

**It makes the failure visible.** Neither cause is fixed, but neither can now
eat an interpreter's trust silently.

1. **Per-socket health** (`socketHealth.js`, 16 tests). The rail says
   `EN 412w · 2m ago` / `ES silent 2m14s`, and raises a red
   `⚠ ES socket silent — the EN socket is transcribing everything.`
   The counters are **cumulative** because `lastSocketEnConfidence` is a
   last-message value that one Zap resets to `null`, which renders `--` and is
   indistinguishable from "not connected yet".
   - A socket that has never spoken is `no words`, **not** `silent` — otherwise
     it cries wolf on every call.
   - The escalation ladder must ascend: the hint threshold sits *below* the alert
     threshold. A first pass had it at 45s vs 30s, which made the early warning
     unreachable dead code. There is a test asserting the ordering.
2. **Translation-surplus warning** (`translationSurplus.js`, 12 tests + 6
   component tests). An amber ⚠ on the bubble rail, sharing the word-count line
   so it costs **zero** height — the same trick as the negation guard. Report
   only: it never rewrites, and it never guesses which part is wrong.
   - Direction-aware ceiling (EN→ES grows legitimately; ES→EN compresses).
   - Independent second signal: the surplus must be *structural* (extra clause
     boundaries) or extreme, so a long source of doses cannot trip it.
   - `isTruncatedTranslation` cannot see this class at all: it handles drops, and
     its Signal B requires terminal punctuation on the source — which an
     unterminated live caption, the exact shape that overruns, never has.

## The eval is blind to this class, by construction

`damage` = display WER − provider WER (`sttEval.js:261`). Nothing was
re-transcribed here; the text was only **misfiled and mis-attached**. So
`damage 0.00` is not evidence of anything on this failure, and must not be
trusted as reassurance until the eval grows counters for it.

## Still to do

- **v4.170.0** — the deterministic four (cause 2) + make the `stale` guard real
  + the `langMode: left` landmine, where an ES-lane payload sets
  `cap.text = ''` and text silently vanishes for 30s (`captionEngine.js:643`).
- **v4.171.0** — fragments merge forward, never dropped.
- **v4.172.0** — the lane sniffer, OFF by default.
- **v4.173.0** — the async races: no request-sequencing token,
  `translationBumps` keyed on a mutable `cap.id`, `withTranslationSlot`'s
  `waitQueue` never purged on abort, and aborted rounds still writing results.
- Orphan repetition guard (`dónde yo a dónde yo`).
