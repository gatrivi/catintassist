# Caption engine v2: the "ledger" (2026-10-29 · Phase A ✅ v4.200.0 · Phase B next)

**TLDR:** Deepgram already tells us which audio every word belongs to. Store that
as an append-only ledger, then build the bubbles from it with one pure function.
That deletes about 15 text-guessing guards. Text can't vanish, because a final
is never edited after it arrives.

## Why (what v1 does wrong)

`captionEngine.reduceTranscriptEvent` (about 1000 lines) mutates bubble text on
every packet and then guesses, *from the text alone*, what went wrong. Each
guess is a guard, and each guard has caused the next bug:

| Guard | Bug it caused |
|---|---|
| overlap removal (`removeOverlapPreservingDigitSequences`) | ate repeated phrases (fixed in v4.199.0 by a timestamp patch) |
| restated / supersede (`restatedHeadWindow`) | same |
| lane digit guard | froze the bubble and lost paragraphs (v4.199.0) |
| repeat-lead-sentence drop (v4.180.0) | can drop a sentence that really was repeated |
| verbatim redelivery, draft rewrite, tail seal, 400 ms debounce, comma peel… | each one patches the ones above |

v4.199.0 patched four of these. Patching more keeps the same pattern going.

## Facts the design rests on (Deepgram streaming)

- Every Results message has `start`, `duration`, words with times and (in multi mode) `language`.
- Interims for one segment share a `start`. `is_final` freezes that segment, and the next segment starts where it ended.
- **Deepgram never re-sends finalized audio.** So "two finals overlapping" is impossible, and every guard that removes overlap is guarding against something that can't happen.
- A reconnect restarts the clock at 0, so each socket open gets an **epoch** number.

## Design

```
Deepgram msg ─► ledger (per socket epoch)          ─► bubblesFrom(ledger)  ─► rows (same shape as today)
                key = epoch:start                     pure, deterministic       └► display protections (unchanged)
                interim: replace draft at key          rebuilt each flush           └► translation (unchanged)
                final:   write once, frozen
```

1. **Ledger** (`src/utils/sttLedger.js`)
   - `{ key, epoch, start, end, words[], text, lang, final }`.
   - An interim overwrites the draft at its key. A final writes once, and a second write to the same key is ignored, which replaces verbatim-redelivery.
   - That's the whole module, about 60 lines.
2. **Bubbles** (`bubblesFrom(ledger, opts)`), one pure function. A bubble breaks on:
   - an **audio** gap > 1.0 s between segments (word times, not the wall clock), or an UtteranceEnd;
   - a language change, decided by the word vote (v4.199.0) with the neutral-chunk hysteresis (v4.198.0);
   - a sentence end once the bubble has ≥ N words, or a hard cap of 60 words.
   - The bubble id is `firstSegmentKey#n`. It's stable because finals never change, so there are no remounts.
3. **Output adapter:** rows keep today's fields (`id, text, lang, isFinal, turnId, turnWordCount, wordConfidence`), so the board, translation, supersede display and number protections don't change.
4. **✎ corrections:** an override map `{bubbleId: text}` applied when the bubbles are built. The engine-patch event from v4.196.0 goes away.
5. **Deleted:** overlap removal, restated/supersede, the lane digit guard, repeat-lead drop, verbatim redelivery, the draft-rewrite epsilon, the 400 ms debounce, and the wall-clock 2.5 s split. Stutter collapse (`hallucinationGuard`) moves to display only and logs what it removes.

## Redundancy (the safety net)

- **Raw ledger = the record.** Every final is kept for the whole call. A "Raw" toggle on the transcript shows it unfiltered, and it's saved to IndexedDB every 30 s and at call end.
- **Runtime invariant:** after each flush, final words in the ledger must equal the words in the bubbles (compared after formatting). A mismatch produces one `[CAT LOSS]` warning, the only console line in that path, so the alarm can be trusted.
- **Test invariant:** a property test on random segment streams checks that no final word is ever missing from the output.

## Rollout (no big bang)

| Phase | What | Ships as | Done when |
|---|---|---|---|
| A | ledger + `bubblesFrom` + adapter + tests; replay all fixtures and the eval through v1 and v2 | code only, not wired | v2 damage ≤ v1, and the invariant holds |
| B | **shadow mode:** v2 runs beside v1 on live calls, logs only "words v1 lost / v2 lost" | switch OFF, no UI change | 1–2 real shifts show v2 loss = 0 |
| C | Settings → "Engine v2" switch, A/B on real calls | OFF by default | you prefer it |
| D | v2 becomes the default, v1 deleted (~800 lines) | default ON | one week without regressions |

**Scope note:** v2 targets the default one-socket `multi` mode. Two-socket mode stays on v1 until Phase D, then either gets ported or is retired.

**Cost:** Phase A is one session. B and C need real calls from you, and no extra Deepgram spend.
