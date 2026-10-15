# Live interpreting blackout — root-cause analysis, 2026-10-02

Written after the fact by the agent that fixed it. Everything below is backed by a
measurement or a log line taken during the session; anything I could not prove is
marked **[inference]**. No file in this repository or in `catts` was changed for a
reason that is not recorded here.

---

## 1. The two reports, and why they were different bugs

The work started from one symptom and was validated against a second one that
turned out to be a *different* failure with a similar face:

| | Report A (earlier in the day) | Report B (14:54, "3 messages with no translation") |
|---|---|---|
| Symptom | translations minutes late, some never arrive | three bubbles with source text and **no** translation |
| Root cause | self-sustaining refetch loop | local engine blacklisted client-side |
| Where | `useTranslate.js` accept/cache order | `translationEngines.js` ladder + blacklist |
| Evidence | 13,856 translate calls, 13,799 of them `es->en` cache hits for 3 fixed phrases | **zero** `/stt/translate` requests in the API log for those seconds |
| Server involved? | yes (it answered thousands of pointless calls) | **no** — the client never asked |

The lesson I would hand to the next person: *check the server log before blaming the
server.* Report B looked identical in the UI and was a pure client-side failure. Every
later conclusion came from that one habit.

---

## 2. Defect A — the identity-phrase refetch loop (Report A)

### Mechanism

The local Marian model is honest: `'Okay.'` and `'Thank you.'` are spelled the same in
English and Spanish, and for a handful of stock phrases it returns them unchanged
(verified live: `'No.' → 'No.'`; also `'Okay.' → 'Bien.'`, `'Hello.' → 'Hola.'`).

The client threw that correct answer away:

1. `acceptTranslation` (`useTranslate.js:96`) rejected any result where
   `isTranslationPassthrough` was true, and that rule fires on `src === out`.
2. The rejection happened **after** the cache read but the value was **still written to
   the cache** — so the cache could never suppress the next attempt.
3. Every later occurrence of the phrase refetched it, hit the same rejection, and cached
   the same rejected value. Forever.

Amplifiers that turned a small loop into a stall:

- A single global `asyncio.Semaphore(1)` in the API (`catts/api/routes/stt.py`, one gate
  for *both* directions, while its own comment claimed "one per direction") answered
  overlapping requests with an instant HTTP 503.
- The client answered that 503 by falling through to the remote gateway
  `POST /api/translate`.
- `TRANSLATION_MAX_SLOTS = 1` fed an **unbounded** `waitQueue` that was never purged on
  abort, so genuine speech queued behind loop entries.

Net effect: 13,799 wasted requests of the wrong direction, and real segments arriving
minutes late or never.

### Fix

- `acceptTranslation` accepts a stock identity before the passthrough rule applies.
- Segments that keep failing are quarantined (`TRANS_DEAD`, `useTranslate.js:77`) after
  3 attempts, so any *other* reason for failure can no longer loop.
- The request queue purges aborted work and caps depth at 8.

### Why the identity rule is narrower than it first looked

My first implementation accepted **any** identity of ≤3 words. That would have accepted
`Hello world → Hello world`, which is a genuine engine echo, not a translation — and the
existing suite already asserts that a 2-word identity is "stuck". The shipped rule
(`IDENTITY_STOCK_RE` + ≤3 words, `translationApplicator.js:25`) only accepts phrases that
really are their own translation: `No.`, `Okay.`, `Thank you.`, `Hello.`, … The quarantine
covers the rest.

**Second, hidden half of the same bug:** accepting the result in the hook was not enough.
`applyTranslationResult` ran the result through `isGarbageTranslation`, whose
`FILLER_ONLY_RE` matches `no` — so the *correct* `'No.' → 'No.'` was demoted to a
passthrough entry, `quality: "failed"`, and the UI showed the source text as a
"failed" bubble. Live proof, same input, before and after:

```
before: {"quality":"failed","passthrough":true}
after:  {"quality":"ok","passthrough":false}
```

A verdict can be wrong in more than one place; fixing the first rejection just moves the
failure downstream.

---

## 3. Defect B — one global gate, and refusing instead of waiting

`catts/api/routes/stt.py`

- The single `asyncio.Semaphore(1)` became `_TRANSLATE_GATES[(from_lang, to_lang)]`
  (`stt.py:68`, `_translate_gate_for` at `stt.py:75`). An `es->en` backlog can no longer
  starve `en->es`.
- "Gate busy → 503 immediately" became "wait up to `CATTS_TRANSLATE_QUEUE_WAIT_SEC`
  (`config.py:119`, default 3 s), then 503".

Measured on the running API, same script before and after:

| Case | Before | After |
|---|---|---|
| 6 concurrent `en->es` | 1×200 + 5×503 in 0.28 s | **6×200 in 1.07 s** |
| 1×`en->es` + 1×`es->en` | 503 + 200 | **200 + 200** |
| 12 concurrent long | — | 2–6×200 + rest 503 "Translation engine busy" **at ~3.05 s** (bounded, not a hang) |

---

## 4. Defect C — a timed-out decode released its own gate

`asyncio.wait_for` stops *awaiting*; the `asyncio.to_thread` decode keeps burning a core.
The old code then released the semaphore, so the next request started a **second**
concurrent decode — precisely the pile-up the gate exists to prevent.

Now each decode reports completion through a `threading.Event` and the gate is released
only after the worker thread really ends, bounded by `TRANSLATE_TIMEOUT_SEC + 5` so the
endpoint can never wedge (`stt.py:83`, `stt.py:100`).

Proof, with a throwaway instance on `CATTS_TRANSLATE_TIMEOUT_SEC=0.3`:

```
A (long, deadline 0.3s): 503 after 1.23 s   ← withheld until the orphan thread ended
B (short, right after):  200
```

If the gate had been freed at the deadline, the 503 would have arrived at ~0.3 s.

---

## 5. Defect D — the real cause of the 14:54 blackout (Report B)

### What I found

The API log for 14:54:30–14:55 contained **no** `/stt/translate` entries. The client had
stopped calling the local engine. A reproduction of the operator's own sentences showed:

```
chain before: ["local_stt","gateway"]
…one caption later…
second HITS: ["/stt/translate 200 1818ms"]
META: {"failures":[{"id":"local_stt","reason":"timeout"}], "tried":["local_stt","gateway"]}
```

`translationEngines.js:306` gives the **first** engine the first rung of
`ENGINE_TIMEOUT_LADDER_MS = [1200, 2000, 4000]`. The local API answered **HTTP 200 in
1818 ms** — a turn legitimately queued behind the previous decode (Defect B made queueing
normal) — and the client declared the engine dead. `blacklistEngine` then blocked
`local_stt` for **90 s** in memory *and* `sessionStorage`.

From that moment every segment skipped the local engine: Spanish arrived via the Azure
gateway, or not at all when the gateway failed. That is precisely "some bubbles have no
translation".

### This was my regression

The 1200 ms rung predates this session. What changed is that I made the server *queue*
(3 s) instead of refusing instantly — so a legitimate local answer can now take longer
than the client's first rung. **Server queue wait and client ladder budget are one
system; I sized half of it.** The old behaviour (instant 503) masked the mismatch by
failing loudly instead of answering slowly.

### Fix

- `LOCAL_ENGINE_TIMEOUT_MS = 6000` (`translationEngines.js:66`) for the local attempt —
  covers the API's 3 s gate wait plus a decode. A refused connection still fails in
  milliseconds, so a genuinely down API costs nothing.
- A local timeout now blocks for `LOCAL_TIMEOUT_BLACKLIST_MS = 15 s`, not 90 s
  (`translationEngines.js:60`): the local engine is on this machine, so slow ≠ dead.

Replay of all six reported sentences after the fix: **6/6 translated locally,
`quality: "ok"`, zero `/api/translate` calls.**

---

## 6. Defect E — the segmenter orphaned one-word fragments (the stray `15` / `23`)

Same session, separate bug. `segmentLongMonologue` (`translationApplicator.js:126`) splits
comma-less sentences at exactly `DEFAULT_MAX_SEGMENT_WORDS = 14`:

```
SPLIT: ["And there's also a part of the heart that I've not seen a 100%", "either."]
OUT:   "…no he visto un 100% - ¿Qué?"
```

The remainder went out as its own one-word request, came back as junk, and was glued onto
the sentence. A bubble whose orphan fragment was a number renders as a bare number —
which matches the reported stray `15` / `23`. **[inference]** on the specific two values:
I never saw those bubbles; the mechanism is proven, the mapping is inferred from the shape.

Fix: comma-less runs now split into **near-equal** parts
(`Math.ceil(len / Math.ceil(len / cap))`, `translationApplicator.js:163`), so no segment is
a 1-word orphan and nothing is lost or duplicated at the seam. Two regression tests pin
both properties.

---

## 7. What I changed, file by file

**`catts` (server)**

| File | Change |
|---|---|
| `api/routes/stt.py` | per-direction gate (`:68`, `:75`); bounded acquire (`:108`); `_decode` wrapper with `threading.Event` + active-decode counter (`:83`); release in `finally` |
| `config.py` | `CATTS_TRANSLATE_QUEUE_WAIT_SEC`, default 3 (`:119`) |
| `CATINTASSIST_TRANSLATION.md` | gate semantics; the client-budget coupling rule; corrected privacy claim |
| `docs/SESSION_CONTEXT.md` | two dated handoff entries with all measurements |

**catintassist (client)**

| File | Change |
|---|---|
| `src/utils/translationEngines.js` | `LOCAL_ENGINE_TIMEOUT_MS = 6000` (`:66`), local timeout block 15 s (`:60`), local attempt bypasses the ladder (`:350`) |
| `src/utils/translationApplicator.js` | `IDENTITY_STOCK_RE` + `isShortIdentityTranslation` (`:25`); identity skips the garbage/too-short guards (`:324`); balanced chunking (`:163`) |
| `src/utils/translationQuality.js` | re-exports the helper (no import cycle); `isTranslationStuckForRetranslate` no longer calls a settled stock phrase stuck |
| `src/hooks/useTranslate.js` | identity-aware `acceptTranslation` (`:96`) and `isSourceEcho` (`:107`); `TRANS_DEAD` quarantine (`:77`); `withTranslationSlot(fn, { signal })` (`:460`) |
| `src/utils/translationRequestQueue.js` | abort-aware queue entries, `MAX_QUEUE_DEPTH = 8`, cancelled promises reject with `AbortError` |
| `src/App.js`, `src/components/TranscriptionBoard.js` | 2 props (`isNotesOpen`, `onToggleNotes`) — see §9 |

---

## 8. Verification actually performed

Server, against the running API on :59200: 6-way burst, cross-direction pair, 12-way
overload, orphan-gate probe on a second instance with a 0.3 s deadline.

Client: the real pipeline (hook → queue → engine chain → live HTTP) driven in jest with a
`node:http` fetch shim, recording every URL. Results quoted above are from those runs.

Regression discipline: the new hook tests were run against the **stashed** source files to
prove they fail before the fix (`2` calls instead of `1`; `4` instead of `3`), then pass
after. Full suite: **1491 passed**, with two failures that reproduce identically on the
untouched tree (`useDeepgram.sttLive`, `goalAnchor` — date-dependent and unrelated).

---

## 9. Things found but not mine to fix

- **The app did not compile.** `TranscriptionBoard.js` referenced `isNotesOpen` /
  `onToggleNotes`, which do not exist in that component — an eslint *error*, so `npm start`
  never rebuilt and none of the fixes above could reach the browser. I wired the two props
  from `App.js` (which already had both values) because the operator could not otherwise
  test anything. This is the operator's in-progress feature; the change is additive and
  can be dropped if they wire it differently.
- **`useTranslate.js:424` reassigns a `const`** (`sourceForTranslate`) in the
  glossary-phrase branch. A warning today; it **throws** the moment a glossary phrase
  matches, killing that turn's translation. One-character fix, not applied — it is their
  code path.
- **Privacy, still open:** with the local API down the client silently succeeds through
  `POST /api/translate`, forwarding the text to Azure/DeepL/Google/AWS/MyMemory. Verified
  live (`engineId: "gateway"`, correct Spanish returned). Whether the fallback should be
  gated behind an explicit operator setting is a product decision, not an engineering one.
  It is now documented truthfully instead of the old claim that nothing leaves the box.

---

## 10. If this happens again

1. **Read the API log first.** Zero `/stt/translate` lines = client-side. Thousands of
   `es->en` lines for one phrase = the refetch loop.
2. **`tried:` in the translation meta is the fastest diagnostic.** `["gateway"]` alone
   means the local engine was blocked; `["local_stt","gateway"]` with a `timeout` failure
   means the ladder budget was too small for the queue wait.
3. **Any change to `CATTS_TRANSLATE_QUEUE_WAIT_SEC` must move
   `LOCAL_ENGINE_TIMEOUT_MS` with it**, or the local engine will be declared dead at
   exactly the moment it starts working.
4. **A bare number or a stray word on a bubble means an orphan segment**, not a
   translation bug — check `splitLongForTranslation` output for that source first.
