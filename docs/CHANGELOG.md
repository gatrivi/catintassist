# Changelog (recent)

**Version source:** `src/constants/version.js` (must match `package.json` + top-right UI pill)

## v4.164.0 - CONNECT self-heal, finally wired (it was written in v4.153.0 and never called)

- Reported: "I press it and I have to zap it to work." Zap is a full rebuild: bump attempt id, `closeConnections()`, `clearWatchdog()`, wait 400 ms, reuse the warm stream. The first press had no equivalent — so the operator was doing by hand exactly what the app already had code for.
- **Root cause found by reading, not guessing:** `shouldHealConnect()` was written, documented and unit-tested in v4.153.0 ("1.5 s after a press with no audio it self-heals once") and then **never called**. The build's own `no-unused-vars` warning had been saying so on every build since: `'shouldHealConnect' is defined but never used`. There was no self-heal on the first press at all.
- Wired `armConnectHeal()` into `startRecording`: one timer per press at `CONNECT_HEAL_DELAY_MS`, which calls the existing `reconnectStreamRef` — the same rebuild Zap performs, so no new failure mode is introduced. Cleared in `closeConnections()` so a stopped stream can never be resurrected.
- **Blast radius on a working call is zero:** a healthy press has `sttLive` true 1.5 s in and the whole path does nothing.
- The test caught a real bug in the first draft of the wiring: `pressedAt: Date.now()` read *inside* the timer always yields `age === 0`, so the heal could never have fired. The press time is now captured when arming. Worth remembering: this is why the reproduction was written before the fix, not after.
- `connectHeal.test.js`: a healthy press heals nothing, a dead press heals exactly once, and it never becomes a Zap loop. 1396/1396 green, build clean, and the `shouldHealConnect` unused warning is now gone.

## v4.163.0 - phrase-level glossary with an OFF/EXACT/PHRASE choice

## v4.163.0 - the goal wheel is reachable and drivable without a mouse

- **Bank Goal was below the fold at 900×600.** The pane is ~520px and the content ~600px, so saving a goal meant scrolling inside a scrolling column. `.dial-actions` is now `position: sticky; bottom: -1rem` with a gradient so content scrolls *under* the buttons. Anything new added to the panel must go above that block.
- **The wheel is a real `role="slider"`** with `aria-valuemin/max/now` and an `aria-valuetext` that says what matters: *"40 hours per week · 370 minutes a day · 7400m a month"*. It was a `<div onClick>`: unreachable by keyboard, no role, no value.
- **It takes focus when the panel opens**, so the arrow keys work on arrival. `tabIndex={0}` existed on the wrapper but nothing ever focused it, so you had to Tab there blind. PageUp/PageDown jump four rows, Home/End the ends.
- The wrapper's key handler now **skips events coming from the wheel** — otherwise the arrows moved it twice.
- The pace box and the Pro Ladder card are `aria-live="polite"`; both changed silently on every dial move.
- Both number fields have real `<label for>` instead of relying on `aria-label` alone.
- **Mid-call 🎯 used to do nothing, in five places.** The header button, the targets chip, the `m7` metric cell, the DAILY income card and the 📅 all called `onOpenGoalsView`, which early-returned. One fix in the handler they all share: a top-of-screen `.goals-blocked-notice` saying "off-call only", auto-dismissing in 4s. Top of screen on purpose — the reading column is never covered.
- Layout moved from inline styles to `.dial-wheel`, `.dial-field`, `.dial-ladder`, `.dial-catchup`, `.dial-actions`, `.dial-mini-btn`. Only the wheel's row padding stays inline, because it derives from `itemHeight`.
- **7 new tests.** Not one goal value or line of the dial maths changed.

## v4.162.0 - the goal wheel can no longer wipe your month by accident

- **The worst bug found in this pass:** clear the `banked/mo` box to retype it, press `Set`, and it wrote **0** — `Number('') === 0` passed the old `>= 0` check. Your month went to zero. `parseMinuteCorrection()` now refuses an empty, negative or junk field, and the test pins the empty case.
- Both destructive buttons now do what the call-log paste does: **show the change, ask once, undo afterwards.** `↻ re-sum` (which can *lower* the month) and `Bank Goal` (5 stat fields at once) print `1000m → 300m (−700)` and commit on the second press. New **↩ Undo it** restores the exact previous `catintassist_stats`, and survives a reload.
- Snapshots are taken inside `SessionContext.bankGoal` / `reconcileMonthTotal`, not in the panel, so every caller is covered. `src/utils/statUndo.js`, one level deep by design.
- **`Cancel` was a lie** — it called `onExit`, so it left the whole view and discarded every edit. The button is now **`Discard`**: drop the changes, reset the dial to what is actually banked, stay put. The header's `← Back to work` is still the way out.
- **The ARS rate is a live feed, not a setting.** It was an editable box that was never persisted, was clobbered by the API fetch on every reload, and made every `$` in the app read `$0` the moment you cleared it. Now read-only with the fetch time and a manual ↻ (`refreshArsRate`).
- **↑/↓ no longer erase the number you are typing.** The dial's key handler sat on the wrapper and `step()` clears the custom override, so arrowing inside `Monthly mins` moved the dial and wiped the field. Arrow keys are now ignored while an input has focus.
- **Escape no longer fires twice** — both the dial and `App.js` listened for it. The App comment claiming the dial stopped propagation was wrong; it does now.
- **14 new tests**, all on paths that had zero coverage. **Zero lines of the dial maths changed** — `goalAnchor.js` and `catchUpPlan.js` keep their 42 tests.
- Spec: [`goal-configurator.md`](goal-configurator.md)

## v4.161.0 - settings you can actually find

- Ten identical tabs in a strip that wrapped onto three rows was why the drawer felt like a maze. `src/utils/settingsRegistry.js` is now the single source of truth: ids, labels, hints, search words, groups, order — replacing a nested ternary whose labels fell through to `else 'Display'`.
- **Search** matches label + hint + keywords + id, AND across terms, ranked. "minutes", "key", "theme", "colour" (es spelling), "soundboard" all land on the right panel.
- **Four groups** (Today · Speech · Output · App), and **★ pins** with the call log pinned by default. A pinned panel leaves its group so it is listed once — which is why the panel is called "Call log" and the group "Today".
- Opening the ⚙ with no target returns to the panel you were in, instead of dumping you on Deepgram.
- **Settings → Goals** deep-links into the goal wheel (new `cat_open_goals_view` event). Mid-call it shows "off-call only" and says why, instead of closing the drawer on nothing.
- Spec: [`settings-view.md`](settings-view.md)

## v4.161.0 - a fluent but INCOMPLETE translation now gets caught (real CSA call)

- The interpreter pasted a CSA call where the Spanish ended `…Él ya tiene esos recursos allí` and **dropped "waiting for him"** entirely. Also `after all of this is done` → `después de todo de esto se hace` (wrong sense: "is made" not "is finished").
- **Every existing guard passed it.** `isSuspiciouslyShort` only fires under 25% of source words, and the Spanish came back *longer* (31 words vs 26). Not blank, not passthrough, no digits lost. The safety net protected against *absence* and had nothing at all against **silent omission** — which is the more dangerous one, because a fluent translation gets trusted.
- Added `isTruncatedTranslation(source, translation)` in `translationQuality.js`. Two signals, both required so it cannot fire alone: (A) the source dangles a modifier ("…waiting for him", "…entered into the record") and (B) the translation does not end in terminal punctuation. Plus an independent, deliberately generous 45% length floor as a second net.
- Wired into `isTranslationStuckForRetranslate`, so a truncated line now offers the existing **↻ retranslate** button. No new UI.
- The test file mirrors `negationGuard.test.js`: **6 must-not-fire cases against 2 must-fire**, including the same source translated *completely* (must not be punished) and both other lines from that real call. A check that cries wolf gets muted.
- **It is a detector, not a fixer.** No heuristic can prove meaning is complete. For terms that must land every time in CSA/legal work, the durable tool already exists and is better than any heuristic: the **glossary** (v4.76.0) — the ✎ editor on a translation pins the exact wording, and `findGlossaryTranslation` replays it forever.

## v4.161.0 - audio eval harness: the first metric that touches a microphone

## v4.160.0 (in progress) - the last words of a turn were never sealed

- Found by pasting a real call transcript in: nurse asks for a name and date of birth, the patient answers inside the same breath, and the bubble ended `…My last name? Okay. Yeah. That he has`. Reproduced as a test, and the app's own diagnostic confirmed it: `[CAT VANISH] caption_bubble_split → lost: ['Yeah.']`.
- **What was wrong:** when a final payload sentence-splits, the trailing incomplete sentence becomes a LIVE row (deliberate — v4.141.0 reuses the live draft's id so the bubble grows without remounting). But **nothing ever sealed it**: the next turn simply started a new row and left the old one live forever. Those words never entered the sealed transcript, never got translated, and sat on screen as a dangling fragment.
- **The fix is deliberately small:** on a turn transition, a live row that still holds words is sealed first. The live-tail design is untouched — the tail is still live *while the speaker keeps talking*; silence after a final is an ending.
- `flagVanish` was also lying: the split reported the tail as `lost` words, so the alarm meant to catch a vanishing phone number fired on ordinary sentence splits. The tail is now included in the "after" text.
- Honest limit: the app has **no diarization**, so it splits on sentence boundaries and cannot tell a nurse's question from a patient's answer. Both arrive in one payload and print as separate bubbles, which is readable but not attributed. Fixing that properly needs Deepgram `diarize` — a separate, opt-in request parameter, not a guess.

## v4.159.0 - The corpus now measures the numbers that must never drift

- "if you accidentally edit a phone number out while I am reading it I am going to lose my job" — that was in the brief from the start, and the corpus did not actually test it. It does now.
- Four new medical cases, all gated `minDigitRecall: 1`:
  - **pediatric weight dosing** — `0.4 mg/kg`, `18 kg`, `7.2 mg`: decimals AND a *derived* number in one turn;
  - **medication reconciliation** — four drugs, four doses, one turn;
  - **Spanish reconciliation** — drug + dose + a negation (`no hay alergias conocidas`);
  - **contact numbers** — two 10-digit numbers in the same sentence as clinical words, the exact shape that used to be edited out.
- They passed **first time**: number protection already holds decimals and derived doses. That is a real answer, not a new claim.
- Corpus now 22 cases (16 medical / 6 legal, probes included). Real-world mix: WER raw 8.4%, WER display 3.5%, **damage 0.00**, term acc 86.0%, digits 94.2%, critical 88.4%, repair +0.34. Negation guard: recall 100% (2/2), precision 100% (20/20 clean lines quiet).
- No code path changed and no switch was flipped — this release only makes the metric mean something closer to an actual day.

## v4.158.0 - Your ✎ corrections teach Deepgram (the Stage 4 loop, closed)

- Stage 4's promise was "corrections → teach Deepgram, user approves each". This is that, and it turns the transcription thread from hand-curated into self-improving.
- `keytermsFromCorrections(corrections)` in `src/utils/sttKeyterms.js`: a correction is the only ground truth this app owns — a human heard "all but a roll" and typed *albuterol*. Those words now **outrank the shipped lexicon** in the keyterm list, ranked by how often they were fixed.
- Four safety rules, because this is the one list that leaves the machine and is built from something the user *typed*:
  - only the **corrected** text is sent — sending "all but a roll" as a keyterm would teach Deepgram the error;
  - **digits are refused** — a correction containing a digit is a dose, and a dose is never a keyterm;
  - a whole-sentence correction is not a vocabulary item (≤2 words, ≤40 chars);
  - terms stay in **their own lane** — an English correction never reaches the ES socket.
- Third switch, `catint_stt_user_keyterms_v1`, **OFF by default**, and it only does anything when *Keyterm bias* is also on. Settings shows the exact words that would be sent, live, so nothing the operator typed leaves without them seeing it first.
- 21 keyterm tests + 4 URL-level privacy tests (correction absent when the switch is off, ES socket never receives the EN term, a dose never leaves). 1290/1290 green (one pre-existing `GreetingsPanel` timing flake under parallel load; 11/11 in isolation).
- **Still owed:** the A/B. Nothing here changes what a call sounds like until a switch is flipped.

## v4.157.0 - Provider biasing: built, gated, and OFF (Stage 3 scaffolding)

- Stage 3 of [`docs/stt-eval-plan.md`](stt-eval-plan.md) was code-shaped but unimplemented. This ships the whole thing **behind switches that default OFF**, so the A/B costs nothing until it is deliberately run — and the app cannot accidentally start billing 2x.
- `src/utils/sttKeyterms.js`: `buildKeyterms(lang)` builds the list **from the domain lexicon**, i.e. only from words already *proven* mangled. We never bias toward a word we merely expect to be common — force-fitting invented terms is Deepgram's documented failure mode, and the eval already reports it as `INVENTED terms`. Capped at 30 terms / 500 tokens (Deepgram's guidance is 20–50, hard cap 500), medical kinds first so a deposition cannot crowd out a dose. An **unknown lane gets an empty list** — never English terms force-fitted into a foreign stream.
- `deepgramListenConfig.js`: `getDeepgramModel(lang, {medicalModel})` (EN-only; ES stays `nova-3-general` because the app is a two-lane EN/ES structure) and `buildListenUrl(lang, mode, bias)`. `readSttBias()` / `saveSttBias()` in the same file, no new storage module.
- **The promise, as a test:** with both switches off, `buildListenUrl('en','fast')` returns the exact v4.154.0 string, character for character. A broken/absent storage means *no bias* — never a silent 2x.
- `useDeepgram.js` reads the switches at CONNECT time (next call, no reload) and logs the bias alongside the URL.
- Settings → Deepgram gains a **Provider biasing** group: *Medical model (EN)* (red) and *Keyterm bias*, each with the cost and the term count stated on the panel rather than buried in a doc. `SettingsPanel.test.js` now renders the real Deepgram section and asserts all four transcription switches start OFF and flip independently.
- **Still owed — the actual A/B:** one test call per switch, then `npm run eval:stt` to compare WER/terms/digits and watch for `INVENTED terms`. Until then these stay off. The unresolved `filler_words=true`-on-Nova-3 question from Stage 3 is untouched on purpose — it is a socket-stability risk and needs a live run, not a guess.
- 1271/1271 tests green, build clean.

## v4.156.0 - Negation guard: flags the dropped "denies", never invents it

- Shipped v4.155.0's negation detection was real but **invisible** — console-only. The one error class that can change what a patient agreed to had no on-screen signal at all.
- Added `src/utils/negationGuard.js`: `findNegationGaps()` (READ-ONLY, returns `{expect, snippet}` and never touches the text), `hasNegationCue()`, and `NEGATION_GAP_TITLE`. Split out of `domainLexicon.js` because it is now a first-class feature with its own switch.
- **Precision over recall, deliberately.** "He is allergic to penicillin" is a NORMAL affirmative a patient says all day, so the guard does **not** flag it — only DEGENERATE shapes ("patient chest pain", "any chest pain"). An alarm that fires constantly gets muted, and then it cannot catch the real thing; that is the v4.155.1 VANISH lesson applied to a brand-new alarm. `negationGuard.test.js` therefore carries **more must-not-warn sentences than must-warn ones**.
- `clinicalGuards.js` (renamed from `domainRepairSetting.js`): both clinical switches in one place, built by one `makeGuard` helper so they cannot drift. **Term repair** and **Negation guard** are independent by design — the safe half must not hide behind the risky half. Both default OFF.
- UI: amber ⚠ in the bubble rail, rendered **on the same line as the word count** so it costs the layout zero height (the 80/20 viewport rule). Tooltip says what was expected. `SettingsPanel.test.js` unaffected; a human-fixed bubble (✎) is never flagged.
- Harness: `checkNegationGuard()` scores recall and precision across the whole corpus, returns `offenders[]` (MISSED / FALSE POSITIVE with the exact text) so a regression names the sentence. Gated: **recall must be 1.0**, precision ≥ 80%. A test proves the gate can fail. Corpus gained `probe-negation-dropped-es`.
- Measured: **recall 100% (2/2 dropped negations caught), precision 100% (16/16 clean lines silent)**.
- 1253/1253 tests green, build clean.

## v4.155.1 - Domain lexicon (term repair) + the false VANISH alarm

- Reported: "we do mostly eng spa medical interpreting, 95 pc with 3pc legal bills insurance police etc." Two things followed from it — the corpus was measuring the wrong mix, and there was no fix for the mishearings it kept reporting.
- Added `src/utils/domainLexicon.js`: ~40 rules `{term, lang, kind, mishears[], context[]}` — medical EN (albuterol, amoxicillin, insulin, hemoglobin…), medical ES (amoxicilina, metformina, disnea…), and the legal 3% (exhibit, deposition, objection, affidavit, subpoena + deductible/copayment/coinsurance).
- `applyDomainRepair(text, lang) → {text, repairs[], reverted, negated[]}`, enforced by six rules, each unit-tested: known mishears only · **never touches a digit** (rules with digits are dropped at load; the final digit-run check voids the whole repair) · no double-correcting · a context word must be nearby · **never invents a missing negation** (`findNegationGaps` reports, never writes — a dropped "denies" would invent a diagnosis) · every change logged to `catLog('[domain-repair]')`.
- Added `src/utils/domainRepairSetting.js` + **Settings → Deepgram → "Term repair"** switch. **Ships OFF**: with it off `resolveDisplayText()` is a pass-through and the bubble is byte-identical to v4.154.0 (that promise is a test, not a comment). Flipping it re-renders existing bubbles live — no reconnect.
- Harness: new `repairGain` metric and `checkRepairSafety` gate, applied to **every** case and not per-fixture configurable — the lexicon may never make the text worse and may never move a digit run. A test proves the gate can fail.
- Corpus re-weighted: 17 cases (medical EN/ES, the legal 3% — bills/insurance/police added, allergy + discharge-instruction cases added) and `KIND_MIX_WEIGHT` (medical 1, legal 0.2) so the headline `mix` row matches a real day instead of letting depositions dominate. `repair +0.46` overall; **damage still 0.00**.
- v4.155.1 fix: `vanishTrace.lostWords` compared raw whitespace tokens, so Deepgram re-punctuating on finalize (`82` → `82,`) reported `lost: ['82','96']` on every call. The alarm meant to catch a vanishing phone number was crying wolf constantly — which is how a real alarm gets ignored. Words now compare by letters+digits only; a real digit loss is still reported.

## v4.154.0 - STT eval harness: the first transcription-quality numbers (medical + legal)

- Reported: "we do mostly medical interpreting and/or legal, there are a whole bunch of things that it is a lot better if transcribed correctly." The repo had **no numeric STT metric at all** — no WER, no term/digit accuracy — so every quality claim was a guess, and the most expensive bug class (Deepgram right, app wrong) was unmeasurable.
- Added `src/utils/sttEval.js` (pure): normalization policy, word-level Levenshtein with backtrace, `wordErrorRate`, `termAccuracy`, `digitRunAccuracy`, `criticalPhraseRecall`, `scoreEvalCase`, `summarizeEval`, `renderEvalReport`, `collectConfusions`.
- Added `src/fixtures/eval/` (10 cases) + `src/utils/sttEvalRun.js`: cases with Deepgram-shaped `events` are replayed through the **real** live pipeline, so every case is scored twice — provider text vs the text the user reads. `damage = displayErrors − providerErrors` is the new headline metric.
- Report: `npm run eval:stt` (prints the table; jest-based because `src/` is ESM inside a CJS package — the table builder is a pure function so a real CLI can be added later). Registered in `test:transcription`.
- First run: **WER(display) 0.0%, damage 0.00** on all 6 gated medical/legal cases — the app currently does not damage correct provider text. The informational probes name the known failures: `albuterol → roll`, `exhibit → bit`, `500 → 50`, and a dropped `denies`.
- Two real bugs in the metrics themselves were caught by their own tests while writing them: a consuming regex split digit runs (`555123 4567` instead of `5551234567` — fixed with a char walk), and `termAccuracy` counted present terms as misses.
- Next (staged, in [`docs/stt-eval-plan.md`](stt-eval-plan.md)): v4.155.0 domain lexicons + `applyDomainRepair` (display-side safety net), then `keyterm` biasing + EN socket `nova-3-medical` behind one A/B run.

## v4.153.0 - CONNECT really starts Deepgram

- Reported: "I press CONNECT during a call and Deepgram does not start." Four independent ways to end a press with **no audio and no message**:
  1. `audioAttached` was `connectionState === "connected" && …`, and idle-ear/dead pipes report `connected` with **no recorder**. CONNECT therefore took the start-the-call branch and never started Deepgram → a call that could never transcribe.
  2. The ES socket was created **inside EN's `onopen`**, so one hung socket meant no recorder, no audio and no error for 8s. Connect retries also rebuilt only EN.
  3. A stream was reused on `active && tracks > 0` — a share that had ended or gone fully muted was trusted, so the sockets opened onto silence.
  4. A cancelled tab picker reset to `disconnected`, and the diagnostics bar hides itself when `connected` → the failure was completely invisible.
- Fixes:
  - **`sttLive`** (new signal from `useDeepgram`): true only when the sockets are open **and** a MediaRecorder is feeding them. `audioAttached = sttLive && (mic‖tab‖cable)`; idle-ear and warm-but-dead sockets are explicitly *not* live.
  - **Parallel sockets**: EN and ES open together; a connect retry rebuilds both.
  - **Rotten-stream guard** (`isReusableStream`): ended/muted/all-dead streams are dropped and re-acquired; a fresh stream with a dead track is refused with a plain message instead of opening sockets onto nothing.
  - **Self-heal**: if nothing is streaming 1.5s after the press, one rebuild runs automatically (reuse path, no tab picker) — once per press, never a loop.
  - **Evidence**: an amber `DG up, no audio` chip appears when Deepgram is connected but sent no audio for 8s, with the fix in plain words; a cancelled tab picker now shows an error + `press M (mic) then CONNECT` instead of resetting to `disconnected`.
  - `resolveConnectIntent()` is the one place that decides what a CONNECT press does; the header and the idle-pane scoreboard share it.
- Tests: `src/utils/connectEvidence.test.js` (24) + `src/hooks/useDeepgram.sttLive.test.js` (5, real WebSocket/MediaRecorder doubles). Full suite: 123 files green.

## v4.149.0 - speech evidence: Zap only when it can help

- Reported: still stuck after v4.148.1. Two different failures look identical on the Deepgram message clock: a dead Deepgram pipe (a Zap rebuilds it) and a silent audio route — mic/tab/VB-Cable/headset stopped delivering signal (a Zap is useless). Zapping the second case burns the cooldown while nothing is fixed.
- Fix: a call-time local RMS monitor (WebAudio analyser on the outgoing stream, worker-timed so a hidden tab can't starve it, zero audio leaves the machine) stamps when the pipe last carried real speech energy. `shouldAutoZap()` now requires speech evidence: **15s+ of zero Deepgram messages while someone is audibly speaking → Zap in ~15-20s** (down from 35s when it matters most); 35s+ of total silence still Zaps regardless (pipe that died during dead air); a quiet stretch with no speech never Zaps (dead air is not a fault). Recorder-alive + 120s-cooldown guards unchanged. Pure + unit-tested in `dgStatus.js`.
- Version note: the pill the user reported as "4.184.1" is v4.148.1 (no such version exists in the repo).

## v4.148.1 - auto-Zap waits 35s, not 65s

- Reported live: "65s auto zap seems bonkers." Correct — that wait was sized in v4.136 when a frozen message clock caused Zap loops. The clock is trustworthy now (v4.136/v4.148.0 fixes) and the guards that matter stayed: recorder must still be sending audio (else it's the audio watchdog's failure) + 120s cooldown between recovery Zaps.
- Fix: the 65s inline thresholds became the pure, unit-tested `shouldAutoZap()` in `dgStatus.js` with `DG_AUTO_ZAP_SILENCE_MS = 35000`. A mid-call Deepgram stall now self-heals in ~35-40s; a connect-time dead pipe was already ~12s since v4.148.0. Empty keepalive Results during dead air count as life, so live conversation is never interrupted by a recovery Zap.

## v4.148.0 - STT evidence inspector + visible hold counter + CONNECT no longer goes "stuck"

- **CONNECT reliability (reported: red "DG STUCK" right after connect, manual Zap needed, intake info missed):** the 12s connect watchdog stood down the moment audio was being sent, so "Deepgram accepted the socket but never sent ANYTHING (not even startup Metadata)" sat `connected` until the 60s red chip and a manual Zap — about a minute of the call lost. Now a dead pipe is detected within 12s and sockets auto-rebuild (status: "Deepgram not responding — reconnecting…", 3-try budget, then an actionable timeout). Deepgram answering once (any message, incl. Metadata) stands the watchdog down; mid-call stalls still use the 65s auto-Zap (v4.136 tuning untouched). Verdict logic is the pure, unit-tested `connectStallVerdict()` in `dgStatus.js`.
- **Multilingual false red:** Multilingual (auto-detect) mode runs ONE Deepgram socket (`socketEs: "skipped"`), but every health surface required `=== 'open'` — the DG chip read red "DG STUCK" and the cat read amber "STT checking" on every connect while text flowed. New shared `isSocketHealthy()` accepts `'open'` and `'skipped'`; used by the DG status chip, the cat status, and the connect diagnostics checklist.
- Settings → Audio → Admin STT diagnostics: optional raw Deepgram trace and last-60-seconds local audio ring, both off by default and opened with `Ctrl+Alt+D`.
- Every diagnostic event now has a stable session/event ID shared with CAT STT logs, provider and wall-clock timestamps, confidence/final state, linked caption IDs, and raw→visible text for phone-loss diagnosis.
- Diagnostic transcript/audio data remains memory-only, is bounded, and is wiped on STOP; a visible `STT AUDIO REC` indicator appears while enabled audio is retained.
- Active hold button now shows `H 00:42` instead of only `H`.

## v4.147.0 - calmer hold detector

- Study mode now requires a hold phrase plus **30 seconds of continuous silence**, instead of firing after 3 seconds.
- Any later confident, non-hold speech clears the armed intent, so an old “one moment” cannot fire after the conversation continues.
- Hold intent remains valid for 60 seconds; speech still resumes hold immediately.

## v4.146.1 - actually ship the v4.146.0 code

- The v4.146.0 deploy carried only the version bump + this changelog entry (a concurrent commit swept up docs mid-edit). This release ships the actual fix: `SessionContext.js`, `useDeepgram.js`, `AutopilotGuard.js`, `captionEngine.js` (+ tests).

## v4.146.0 - call disconnect autodetect: farewell auto-end was never wired

- Reported: "call disconnect autodetect is not working."
- Root cause: the v4.132.0/v4.133.0 human-farewell auto-end shipped as **dead code** — `matchFarewellPhrase()` and `AUTOPILOT_FAREWELL_SILENCE_MS` existed, but nothing ever called the matcher from the transcript pipeline, so real-life call endings ("thank you, have a good day") never ended the session. Only platform phrases ("caller has disconnected") fired, and only with the autopilot toggle ON.
- Fix: `useDeepgram` now checks farewell phrases on final transcripts → `SessionContext.armAutopilotFarewell()` arms a flag → after **120s of no speech** the standard 10s cancellable auto-end banner opens (`requestAutopilotEnd`). Any speech in the window resets it (ER-incident rule: a farewell mid-conversation never cuts a live call). STOP / auto-start / call end clear the arm.
- UI: header 🤖 AUTO chip turns amber **🤖 END⏳** while a farewell is armed (hover explains: 2 min silence → auto-end, speech cancels).
- Still requires the autopilot toggle (Settings → Behavior). Tests: farewell matcher cases in `callAutopilot.test.js`.
- **Phone number protector (second report):** the v4.141.0 restart-split had **no digit exemption** (unlike the overlap guard above it). Deepgram re-cuts during phone/ID dictation ("…five five five one" finalized, then "five five five one two three…" re-delivered) fired the split and scattered the run across bubbles — the per-bubble display stitch could never group it into `XXX-XXX-XXXX`. Fix: a digit run (≥2 digits; ordinals like "1st" don't count) or ≥2 consecutive number-words at the boundary vetoes the split, so the dictation stays in ONE line where `collapseAdjacentDigitRepeats` + stitch heal it. Nothing is deleted — this only changes routing. Tests: rewritten digit-veto case + new number-word dictation re-cut case in `captionEngine.test.js`.


## v4.145.0 - sticky bottom always shows the newest line (interpreter-blocking)

- Reported: "the sticky scroll that ensures new transcriptions are always visible — if new transcriptions are not visible, the interpreter cannot work."
- Root cause (three, all in `TranscriptionBoard.js`): (1) the follow was paused by scroll **geometry** (`scrollHeight - scrollTop - clientHeight > 35`), so every scroll the operator did not make — the browser's **scroll-anchoring** moving the viewport when a live bubble grows, or our own programmatic scroll — looked like "the operator scrolled away", and the 15 s resume kept being re-armed; (2) `scrollIntoView` scrolls *any* ancestor (page included) and silently does nothing if the engine declines — nothing checked whether the pane actually moved; (3) follow ran only when a `scrollKey` changed, so height that arrives *after* the render (translation line, morph, re-wrap) never triggered a follow.
- Fix: new pure module `src/utils/stickyScroll.js` — `classifyScroll()` labels each scroll event `self` (ours, inside a 300 ms grace window) / `user` (wheel-drag-scrollbar gesture, wins over the grace window) / `content` (nobody touched it → snap back, never pause). `followLatest()` sets `pane.scrollTop = pane.scrollHeight` directly (instant, pane-only; `scrollIntoView` kept only as a last resort). Two settle passes (120 ms + 400 ms) catch late height growth. `overflow-anchor: none` on `#transcript-pane` so the browser stops moving us. While paused, the corner toggle turns amber and reads **`⬇ N new`** — one click jumps to the newest line (and no longer switches the follow off in that state).
- Tests: `src/utils/stickyScroll.test.js` (decisions), `src/components/stickyBottomBehavior.test.js` (real `TranscriptionBoard` render in jsdom: new caption snaps to bottom; a no-gesture scroll snaps back; wheel up is respected and counted; the amber click jumps; dragging back to the bottom resumes), `src/components/stickyBottom.test.js` (stylesheet + source contract: anchoring off, `pane.scrollTop = pane.scrollHeight`, no return of the geometry-only flag).

## v4.144.0 - bubble text can no longer paint over the next bubble (overlap root cause)

- Reported (screenshot): translation span of bubble N rendered *on top of* the first line of bubble N+1 (`.bubble-line > span` overlapping the following span) — worse on busy calls, after v4.143.1's update only "a little better".
- Root cause: `#transcript-pane` (`.scroll-area`) is `display: flex; flex-direction: column; overflow-y: auto` (`TranscriptionBoard.js:1346`) and `.transcript-bubble` shipped with the **default `flex-shrink: 1`** (no override anywhere). Once total content exceeded the pane, flex distributed the negative space by squashing bubbles **below their content height**; with `overflow: visible` the bottom line painted over the next bubble. The v4.134.0 height-lock hardening only reduced the inflated-height symptom — it is a `min-height` floor and cannot stop a shrink below content.
- Fix (one declaration): `src/index.css` `.transcript-bubble` gains `flex-shrink: 0`. Bubbles always keep natural height; the pane scrolls instead (pinned wrapper + bottom anchor already had `flex-shrink: 0` inline). Height-lock / `liveBubbleHeight.js` untouched.
- Tests: new `src/components/bubbleOverlap.test.js` — asserts `flex-shrink: 0` on the `.transcript-bubble` rule read straight from `src/index.css` (same stylesheet-contract pattern as `RepeatDimText.test.js`), plus asserts no later rule re-enables shrink for the bubble.

## v4.142.0 - repeated wording is dimmed, never removed (readability net)

- Reported (screenshot): one sealed bubble printed the same ~22-word sentence twice ("…You said you did a unemployment claim, but they wanted to follow-up with you. Or you want to speak with Social Security…") and the pane became impossible to read. A duplicate can still reach the pane even with v4.141.0's routing: a mid-line re-cut the overlap guard cannot clean, rows persisted by an older session, or the supersede presentation.
- Fix, exactly as the operator proposed — "do a simple string compare; if a sequence of words is repeated, dim it, but leave it still at least 70% visible":
  - New pure detector `src/utils/repeatedWordRuns.js` → `findRepeatedWordRuns(text, {minWords, maxChars})` returns the **character ranges of the LATER occurrences** of a word run that already appeared earlier in the same text. Case/punctuation-insensitive matching ("names," ≡ "names"), but the ranges map back onto the **original characters**.
  - Minimum run **4 words** (`MIN_REPEAT_WORDS`): "no no", "you you", "thank you thank you" are untouched. Ranges sorted and non-overlapping; work capped at `MAX_SCAN_CHARS` (6000) — past the cap the scan stops instead of dimming the wrong words.
  - Render: new `src/components/RepeatDimText.js` wraps a dim chunk in `<span class="repeat-dim">` and hands each chunk to the call site's own token renderer, so sensitive-data chips, number highlights and confidence tints keep working (`part.wordOffset` keeps word-indexed tinting aligned). Split points are at whitespace, so no token is ever cut. Call sites: live line `StableTextMorph.js`, and `TranscriptionBoard.js` sealed source **and** translation line.
- **Display-only**: nothing is deleted, hidden, reordered or normalized. The rendered `textContent` is byte-identical to what the pane showed before (pinned in `RepeatDimText.test.js`), digits/doses/phones included — a repeated phone number is dimmed like any other repeat, never removed. The engine (`captionEngine.js`, `removeOverlapPreservingDigitSequences`) is untouched.
- Styling floor — hard requirement: `.repeat-dim { opacity: 0.72 }` in `src/index.css`, no strike-through, no blur, no color override, no font shrink. The 70% floor (`REPEAT_DIM_MIN_OPACITY`) is asserted **from the stylesheet** in `RepeatDimText.test.js` (verified to fail at 0.5), so a future edit cannot silently dim readable text below it.
- Same floor for the supersede path: `.stm-superseded` was ~25% visual weight (`#64748b` + faint strike-through) and is now **0.72** (`#94a3b8`, no strike-through); the `stm-old-word` settle keyframes were raised with it (0.9 → 0.72) so the animation cannot dip below the floor, and `stm-superseded--protected` moved to 0.72 too. Class names, hold/retire timings and the reduced-motion behaviour are unchanged.
- Tests: `repeatedWordRuns.test.js` (15), `RepeatDimText.test.js` (14, incl. the screenshot sentence twice in one bubble and the word-confidence alignment across the chunk split). Spec: `docs/transcription-pane/README.md` §12d.

## v4.141.0 - restarted segment no longer prints twice in one line

- Reported (screenshot): one bubble read "…their first names, if Can you provide me with their 1st names if so?" — the same question twice, and the gray translation mirrored it. The word badge read 26 for a 17-word phrase, i.e. the count was inflated by the duplicate.
- Root cause (`captionEngine.js`): a FINAL/interim was **appended** to text already finalized on the same lane (`merged = finalized + " " + cleaned`). The only defense, `removeOverlapPreservingDigitSequences`, strips only when the arriving text's prefix equals the base's **suffix** — and it cancels itself near digits or clinical words (v4.116.0/v4.133.0). A Deepgram restart (re-cut, reconnect replay, re-segmentation) that re-states a phrase from the head/middle of the line therefore landed as a second copy inside the same row, then sealed, persisted and translated.
- Fix — **routing, never deletion**: a new `restatedHeadWindow()` measures the longest run of leading words of the arriving segment that already exists anywhere in that lane's finalized text (≥ 4 words); when it fires and the overlap guard cannot clean the boundary itself (nothing was stripped), the restart opens **its own bubble** (`caption_restart_split` in the vanish trace), the same primitive as the sentence-boundary split. The finalized row keeps every word; the restart lands once. The overlap guard's code and thresholds are untouched (v4.116.0 digits / v4.133.0 clinical + emphasis rules unchanged).
- The row left behind is marked sealed (it can never grow again), so it stays translatable/editable instead of dangling as a "live" row; its words are banked into the turn counter so the turn badge stays monotonic.
- Second hole found while testing: an interim draft whose text ended in `?`/`.` followed by its own final produced a **duplicate row** (the draft was never sealed and a sealed copy opened beside it). The sentence-boundary split now only considers **sealed** lane text, so that final seals the draft in place.
- Display (secondary): under the v4.140.0 supersede model a *reorder* diff renders `delete(old) + insert(new)`, so the dimmed copy printed words the current line already contained ("…for?Yourself, Anna?"). `isRedundantSupersededPart()` drops that dim copy only when its words are a contiguous run of the wording on screen and it carries no digit — a real retraction ("take 5 mg daily" → "take 5 mg") keeps its readable dim copy.
- Tests: `captionEngine.test.js` +8, new `interim-restart` fixture + `fixtureReplay.test.js` acceptance test, `textSupersede.test.js` +4, `StableTextMorph.test.js` +3. Spec: `docs/transcription-pane/README.md` §12c.

## v4.140.0 - live text supersede model (no more words vanishing mid-read)

- Reported: when Deepgram rewrote interim wording for the same speech, the words being read disappeared mid-read; the interpreter cut off mid-sentence. The old cue removed them after **480 ms** with a hard pop.
- Supersede presentation (`StableTextMorph` + new pure `utils/textSupersede.js`): superseded wording stays on screen at **~25% weight** (faint strike-through) while the replacing wording gets a bright frame, then it exits with a fade. Numbers/doses hold at readable weight.
- **Episode base**: the first revision freezes the wording on screen; later revisions re-diff against that, so dimmed text no longer flickers back to full brightness nor piles up as duplicates.
- Bounded lifecycle: hold **1500 ms** (prop `supersedeHoldMs`) → retire fade **320 ms** (prop `supersedeRetireMs`) → settle; hard cap 4000 ms per episode. Reduced motion: animations off, hold 120 ms, retire 0 ms.
- Quiet adopt (no dim, no frame) when the rewrite is equal/lower confidence or past the episode cap — the pane never shows two live-looking versions of one phrase.
- Wired `wordConfidence` into the live source path (dropped since v4.84.1), so the decision can tell a genuine higher-confidence rewrite from noise.
- Enter/update/exit easing on `.bubble-col-source .bubble-line` (color/opacity only — no layout animation); `stm-*` classes are now `stm-arriving` / `stm-superseded` / `stm-arrow`, with a `prefers-reduced-motion` block.
- Tests: `textSupersede.test.js` (18), new `StableTextMorph.test.js` (10, written first and red against the 480 ms behaviour), new `interim-rewrite` fixture. Spec: `docs/transcription-pane/README.md` §12b.

## v4.138.0 - honest DG status + background-tab idle ear + Zap/Connect correctness

- Reported: red "DG STUCK" flashed while transcription was working, then flipped ✓; speech auto-detect failed too often; status never said what was actually happening.
- Root cause 1 (lying chip): the health clock `lastDataTime` only ticked on confidence > 0.4 transcripts — low-confidence text reached the board but aged the chip to red. It was also never reset by Zap, so a rebuilt connection stayed red until the first confident hit; with call-detection OFF it read STUCK permanently and auto-Zapped every 2 min.
- Fix (`dgStatus.js` + `AudioRouteStatusBar`): TEXT ✓ = any transcript within 30s; DG QUIET (amber, 30–60s, "waiting for speech") only when Deepgram sends literally nothing — empty keepalive Results count as life; DG STUCK (red) at 60s+ or a lost socket. `lastDeepgramMessageAt` is seeded fresh at every connect, so stall is always measured from the current connection. Off-call stays never-stale (v4.100.3).
- Root cause 2 (deaf idle ear): VAD (100ms) + idle KeepAlive (4s) were main-thread `setInterval`s → Chrome throttles hidden tabs to ~1/min; a suspended VAD AudioContext yielded silence forever; dead tracks failed silently; `wakeFromIdleEar` logged nothing.
- Fix (`workerInterval.js` + `useDeepgram`): both timers run on an inline Web Worker (not visibility-throttled; setInterval fallback). VAD tick self-checks: suspended context → resume + "Idle ear — audio blocked" message; ended track → ear closes with "Ear lost — audio share ended"; wake attempts now logged (warm/cold) via sttTrace.
- Zap/Connect: `closeConnections` now tears down the idle ear (a Zap during idle ear used to leave VAD + KeepAlive racing the new sockets — double-recorder risk). Auto-Zap keeps 65s/120s rules but keys on the DG message clock + requires audio still flowing; the compact ZAP button now appears only on a real stall or error (it used to appear 30s after the last transcript even with a healthy idle ear).
- Tests: `dgStatus` flag matrix (8), `workerInterval` fallback contract (3); full suite green.

## v4.137.0 - lane-flip digit guard (zips can't vanish)

- Reported: a zipcode disappeared from the transcription bubble (and translation, which inherits it). Root cause: `captionEngine.js` picks the EN/ES lane winner and overwrote the visible text wholesale (`current.text = enFull : esFull`); a zip heard in only one lane vanished on a lane flip.
- Fix: before a lane flip overwrites bubble text, digit runs are compared (normalized, "93 550" ≡ "93550"); if any run would be lost, the old visible text is kept and `caption_lane_digit_guard` is logged to the vanish trace. Normal flips unchanged.
- Second hole: `splitLongTextAtCommas` could tear "93, 550" across two bubbles at the 40-word boundary (render-time `repairSplitZips` can't rejoin across bubbles) — boundaries between digit groups are no longer split points.
- Tests: lane-flip guard keeps zip / still flips without digits; comma-split keeps "93, 550" whole; 43 tests in both suites green.

## v4.135.0 - retroactive debug ring (`catLog`)

- Problem: `[Deepgram]` socket-event spam buried the rare `[CAT VANISH]` warns — the exact trace for vanished numbers/zips. Debugging happens *after* the incident, so a toggle is useless; the recorder must already be running.
- New `src/utils/catLog.js`: console passes through unchanged, and every call is mirrored into an in-memory circular ring (~500 entries; warn/error entries get a guaranteed window that info spam cannot evict; exact repeats collapse into `label ×N`).
- Retrieval: `__CAT_DUMP()` / `__CAT_DUMP("zip")` / `copy(__CAT_DUMP("zip", true))` in the browser console.
- Wired: `useDeepgram` `[Deepgram]` → sub-labeled `[Deepgram:start|open|close|err|connect|key]`; `vanishTrace` `[CAT VANISH]` → `catWarn` (always retained); `SessionContext` + `storage.js` errors/warns.
- No console stripping in builds — output looks the same as before; the ring is additive.

## v4.134.0 - bubble overlap fix + UI libraries doc

- Transcription bubbles could overflow into the next bubble, both unreadable. Root cause: the live-bubble `minHeight` lock (`liveBubbleHeight.js`) locked heights measured mid-animation, because `.is-live` animated `min-height` over 120ms — inflated bubble N, next bubble mounted over unreadable space.
- Fix: height-lock growth now requires the text to have grown; height-shrink-while-text-grows treated as noise; `min-height` transition removed; scroll-area bottom padding so the last bubble can't clip.
- New: [`docs/ui/ui-libraries.md`](ui/ui-libraries.md) — shadcn/Transitions.dev/Beautiful UI/BeUI/Rare UI refs + what to crib for this app.

## v4.133.1 - hotfix: unreadable captions value can't brick the greeting editor

- Prod failure: corrupt/unreadable `catint_captions_v2` (transcript array sharing the greeting IDB store) made `loadAllBlobs` throw forever — Greeting Editor stuck on "Load failed … Retry loading".
- Fix: known non-audio keys (`catint_captions_v2`, `catint_last_call_v1`) are skipped outright; a recording key that lost its blob now fails SOFT — remaining clips load, bad keys listed in a warning.
- Transcript data untouched (never delete a tirade); main transcript view was already fail-soft.

## v4.133.0 - ER incident: never delete a tirade

- `stopRecording` no longer wipes captions — audio stops were clearing the whole transcript before the last-call archive could seal it (unrecoverable loss in the ER).
- `stopSession` HARD RULE: no wipe without a verified archive; billing still stops.
- Long-bubble compression policy: live + newest-2 + any medical/digit row never clip; expansion keyed by text signature (survives re-seal/id churn).
- Overlap/dedupe: clinical repeats (epinephrine, airway, mg…) are emphasis — exact-repeat only; med-cue boundaries never strip.
- Autopilot farewells: dropped mid-conversation triggers ('is there anything else'), silence 30s→120s.

## v4.132.0 - Sentence-boundary bubbles + medical prune guards

- New bubble after every sealed sentence end (`.!?…`) even mid-tirade with no silence break (`captionEngine.js`); mid-sentence fragments still merge.
- Spelled-out doses ("five hundred milligrams") now critical data — stutter-prune/dedupe/overlap-strip skip them (`sensitiveDataProtector.js`).
- Stutter-prune blocked by any med/date/money cue word; dedupe never drops `not/never/nunca/insulin/mg…`; overlap-strip skips boundaries with critical cues.
- AGENTS.md: agent replies ≤3× user prompt length.

## v4.130.2 - Re-attach banner names your route

- Zombie banner reads the configured audio route: `re-attach VB-Cable` / `re-attach mic` / `re-attach tab` (was hardcoded tab).

## v4.130.1 - Last-call seal + outage is not call end

- STOP/auto-end seals a read-only last-call transcript (IDB) — re-readable after refresh/update until next call, End Day, or 🗑.
- Ghost auto-end now requires Deepgram connected: STT collapse / update / reconnect can never end the call or wipe text.
- Live captions flush to IDB on pagehide/hide (kills the 1s debounce-loss window on reload).

## v4.129.1 - Connect = BREAK exact box

- `#header-connect-btn` + `#header-break-btn:not(.has-label)` share one ID rule: 26×26, padding 0, radius 4px (23px ≤1100px via vars); 90m BREAK label still expands via `.has-label`.
- Both off-call only (STOP replaces Connect in-call); icon 14px both.

## v4.129.0 - Small buttons, slim row

- Soundboard (🎛) + Editor (✎) are 26px squares like BREAK; Connect forced to exact 26×26 box + glow without scale.
- Full name stays in the tooltip.

## v4.128.0 - Greetings play once (sink-only caller audio)

- Caller-bound audio (on-call strip fires, Studio caller sends, editor caller tests, TTS) is sink-only by default — the parallel local copy + the Voicemeeter A1→cable loop made every greeting sound twice.
- Opt-in local monitor: "Monitor" checkbox on the on-call strip (`CATINT_CALLER_MONITOR`).
- Voicemeeter fix applied live: VAIO→B1 only, empty Strip[1] cleared; `setup-voicemeeter-mic.ps1 -Apply` now enforces both.

## v4.126.0 - Header declutter + no mid-call updates

- Update banner deferred off-call (`App.js`): no reload offers while active/zombie/on-break — the flag persists so it returns after STOP.
- STOP matches CONNECT height at double width; off-call center children shrink instead of overlapping (`index.css`).
- Mic-verify chip + DG/greetings proof spans moved to Settings → audio (live output label); compact bar keeps TAB/VB toggle + ZAP.
- Notes auto-close on STOP (`stopSession`).

## v4.123.0 - Auto-start on any speech (fix B)

- Off-call auto-start no longer needs confidence>0.4: any non-empty transcript starts the call and opens the capture gate, so mumbled openers land in bubbles instead of dropped (`shouldSpeechAutoStart` in `idleEar.js`, unit-tested).
- Confidence >0.4 stays the gate for billing/activity (`notifySpeechDuringCall`, call-detect pulse) only.

## v4.122.0 - Fractions, percent, self-pay

- foldFractions/foldPercents run FIRST on words ("one half"→1/2, "50 por ciento"→50%); stitch skips 2-part slash runs ("1/2" safe, "5/5/5/1/2/3/4" still stitches); PERCENT_RE joins critical data.
- PRICE_CUE_RE += self-pay/uninsured/deductible/deducible/sin seguro/out-of-pocket/pago privado.

## v4.121.0 - Rooms, ranges, honest yellow

- Rooms/IDs: unitRe += room/bed/po box/ext ("double room" still safe); case/claim/reference arm the ID lane; bare "number is" narrowed (room/case/MRN no longer phone-dash).
- Times: quarter past/to, o'clock/en punto, cueless H MM post-date-mask ("11 30"→"11:30", "05 12 1980" safe); "1 to 3" + "entre las 2 y las 4" schedule units.
- Yellow fix: aligner digit-run consumption (min confidence) + positional fallback removed — unmatched words stay white; lane-aware via TranscriptionBoard lang.

## v4.120.0 - Dictation words, magnitudes, NPI, vitals

- expandDictationWords: "8 oh 5"→805 (digit-gated, "oh no" safe), "double/triple five"→stitchable.
- foldMagnitudes: hundred/thousand/mil/ciento incl. "2 1000 26"→2026, "100 20"→120, cue-gated years; ES map gains cien/ciento/mil + accented numerals (veintiséis).
- NPI/DEA/NCPDP runs stay verbatim even when armed; translation ID_RE covers NPI/DEA.
- Vitals: "120 over 80"→"120/80", new vitals chip (lb/kg/ft/cm/grados/F/C/BP), critical-data + translation safety; stitch decimal/IP guards held.

## v4.119.0 - Addresses survive: split ZIPs, directional slot, whole-span chips

- repairSplitZips: "California, 93, 550" → "93550" (cue-gated; counts untouched).
- Directional slot: "3247 e/and/y + street-type" → compass letter ("3247 E Avenida").
- Street span is one address chip (click copies full line); unitRe takes "#" + letter suffixes ("apt 4B" copies "4B"); shorthand suites ("s 1") gated on address context.
- STREET_TYPE_WORD += avenida/calle/carrera/bulevar; ES street-first + EN number-first both chip.

## v4.118.0 - Greeting Editor view (one greeting at a time)

- New off-call **Greeting Editor view**: master/detail workspace for a single soundboard clip — script, inline waveform editor, record/upload, legibility + loudness + choppiness, and a caller test.
- Entry points: ✎ **Editor** button on the header chips row, and ✏️ on any Studio tile (opens pre-selected on that clip). `← Exit` / Escape returns to the scoreboard; `🗂 Studio` returns to the soundboard overview.
- Navigation: ◀ ▶ buttons or ←/→ keys walk every clip (time-slot variants included); the left rail shows saved/empty counts per greeting family.
- Safety: **CALL OK** is only offered when a caller test plays to the end; a stopped, cancelled or failed test raises a visible error instead of arming the patient path.
- Failures (storage, mic, route, Deepgram) now render inside the view — no silent console-only errors. Delete asks in-view, never via `window.confirm`.
- Studio cleanup: the old per-clip edit **modal** was removed (one editor, one place); the Studio stays the catalog. Shared clip logic extracted to `src/hooks/useGreetingClip.js`.

## v4.117.0 - Request memory: phone/SSN format across bubbles

- New expectedDataContext: "can I have your phone number/SSN" arms formatting for 45s; later-bubble digits group correctly (full override: armed SSN beats ZIP shape, armed phone groups 8 digits, armed DOB/address stay verbatim).
- collapseAdjacentDigitRepeats: exact straddle dupes ("555 123 123 4567") → one copy; single-digit runs never collapse ("9 1 9 1" kept — caught eating HIPAA digits in testing).
- Sentinel gaps: bare request phrasings EN/ES, birth/born/dob/age/how-old, "me puede dar su número".

## v4.116.0 - Doubt shows both, numbers never destroyed

- Ambiguous all-digit dates copy both ISOs ("05/12/1980" → 1980-05-12 / 1980-12-05); display verbatim.
- Phone fallback dashes only 9/10/11; other lengths stay as dictated unless explicit phone/SSN sentinel.
- Overlap near digits requires exact raw-word repeat ("1234" vs "12 34" no longer strips).
- Morph protects any digit token + currency; translation pure-digit compare exact + new ZIP class.

## v4.115.0 - Sensitive data round 2: DOB/dose/money/email survive

- Spaced DOB "05 12 1980" masks as one date unit (ISO copy); dotted "05.12.1980" too; "v1.2" untouched.
- Compounds/decimals: "eighty two"→82, "ochenta y dos"→82, "two point five mg"→2.5 mg; stitch no longer eats decimals ("2.5"→"25" fixed); IPs not phones.
- ZIP+4 stays verbatim; 8-digit MRN/chart runs undashed (9/10/11 keep SSN/phone/member behavior).
- Money thousands ("$1,234.56") one unit; pills/gotas/puffs dosage units; spoken email highlight + reconstructed copy; "Calle 45" address unit.
- Word times: "half past two"→2:30, "at 3 30"→"at 3:30", 24h + "3pm" highlight; translation safety covers times/money/MRN.
- Corrections gain word boundaries ("ana" can't rewrite "Juana", "212" can't rewrite phones). Caught live bug: translation `dobs` extracted with dosage regex — fixed.

## v4.114.0 - Greeting Editor view + clerk slot times survive

- Clerk shorthand "we have 1 1 30, 2 2 30" expands to 1:00, 1:30, 2:00, 2:30 (1 1 30 = TWO slots, never 1130); times highlight + click-to-copy, phone colon backstop, translation digit-loss safety covers times.
- Greeting Editor focused view (see in-app release notes).

## v4.113.0 - Goal Tracking view: dial + month calendar, live need/day

- New off-call Goal Tracking view: dial selector + month calendar side-by-side; live pace card shows banked vs goal, remaining over workdays, and need/day with an on-pace verdict (updates live as the dial changes, before saving).
- Open from the goal button, income card, calendar button, or daily-targets chip; cat or Escape returns to transcription. Transient view: refresh lands back on the scoreboard.
- Month calendar requirement math moves to a workday basis (remaining goal / remaining workdays) reacting to the live dial preview; click a past day to edit minutes.
- Separate heatmap overlay removed (calendar lives in the view); workdays/month lifted to session context so header catch-up strip and view never disagree.

## v4.112.3 - Greeting scripts visible before Record

- Clip cards render script `<details open>` (was collapsed until Record); ✏️ edit modal shows script under header. Recording keeps live teleprompter.

## v4.112.2 - Passive ElementHint tooltips retired

- `ElementHintTarget` is a pass-through (native titles back); ⌖ HudInspector picker is the single element-select path. No behavior change for wrapped controls.

## v4.112.1 - Soundboard dock fills the rail

- Dock gallery drops to full-width grid row below header (was squeezed to 1-tile column beside toggle+slider in the 180–240px rail).

## v4.112.0 - One-tab local translator watch (no more 5-min popup)

- **Retired:** `\CatTS-API-Watchdog` scheduled task (console flash every 5 min; `-WindowStyle Hidden` still flashes on interactive logon) — disabled. Re-enable: `schtasks /change /tn "CatTS-API-Watchdog" /enable`.
- **New:** `scripts/watch-local.ps1` + `npm run local` — one persistent tab checks `127.0.0.1:59200/health` every 30s and lifts hidden uvicorn inline if down. Zero new windows, ever.
- **Gotcha fixed while here:** PS 5.1 fails to parse BOM-less `.ps1` with non-ASCII chars (spurious "string missing terminator") — script is pure ASCII now.
- **Next:** app lifts its own backend — options in `docs/development/local-translate-watch.md`.

## v4.108.3 - Voicemeeter Input is not In 1

- Fixed incorrect endpoint matching: In 1–5 are optional VAIO extensions, not the normal VAIO input. Auto-pick skips them; existing explicit picks stay put with a routing warning.
- Explicit Studio 📡 Caller tests now send to the selected greeting output even in Mic mode; previously neither output played. Ordinary Mic-mode playback stays local.
- Settings now explain the separate greeting, transcription and call-site microphone routes.

## v4.108.2 - Greeting output binding and cancellation

- Direct greeting playback now resumes and binds the selected output before rendering (includes the unshipped v4.108.1 fix).
- Stop, Restore Mic, output changes and replacement clips cancel pending playback; cancelled requests cannot restart through fallback or clear a newer clip.
- Mixer inspection: Standard B1 is `Bus[1]`, not `Bus[2]`; corrected Potato strip indexes. No automatic live mixer changes.
- Hardware delivery remains unverified; browser playback success cannot prove an endpoint reaches the caller.

## v4.108.0 - Quieter vault lock + hidden local servers

- **Deepgram vault:** "Lock (Clear Session)" red alarm button → quiet underlined text link; key copy stays, menace gone.
- **Agent rule:** lifting local (`npm start`, servers) must run hidden — never a visible cmd window while the user reads live transcriptions on calls (`docs/handoff/00_global_rules.md`).

## v4.107.0 - Twin-endpoint disambiguation (ghost Voicemeeter Input)

- **Root cause of silent no-needle:** Voicemeeter Standard + Potato leftovers register identically-labeled outputs. Picking the ghost twin plays into nothing — no error, no needle. Every VB-out picker (Settings, I/O strip, header, Mic Verify) now appends an id tail (`· #a1b2`) when 2+ entries share a label, so the live twin can be told apart.
- **Success proof:** sink test fires now confirm `📡 Into X ✓ — if no needle moved, re-pick the other same-named entry`.
- Tests: twin-suffix cases in `audioDeviceLabels.test.js`.

## v4.106.0 - Quiet sink test (no more "no needle" mystery)

- **Studio sink test, quiet by design:** clip-card 📡 Caller + Check-panel 📡 Send now play the real recorded clip into VB out capped at 0.4 (ignores a 100% slider); footer beep is a soft fixed-0.2 tone, sink-only — never your speakers. Judge voice quality safely by watching the VAIO strip meter.
- **Quality gate no longer blocks testing:** 📡 Send enables with clip + sink picked (was disabled on quality fail) — the gate still guards on-call tiles; Studio is for diagnosis.
- **Visible failures:** sink bind/play errors now name the sink in a persistent notice (`Sink play failed into X — re-pick 🔊 in header`) instead of console-only.
- Tests: `capSinkTestVolume` clamp tests in `audioSelfTest.test.js`.

## v4.99.3 - Soundboard dedup (one Opener–Client)

- **Retired:** `open_client` ("Client Open") — byte-identical script to `greeting_en`. Canonical survivor is `greeting_en` ("Opener – Client"), which keeps the AM/PM/Eve recording variants. Tile count 26 → 25.
- **Relabeled (no deletions):** openers in call order (Opener–Client / Opener–LEP / Opener–LEP (ES) / Opener–Direct dial); closers grouped (Closing–More help? / Closing–Sign off / Closing–LEP bye); old generics tagged Legacy (Anyone? / Callout / Louder).
- **Carry-over, never delete:** on Studio load, if all 3 Opener–Client slots are empty and an `open_client` clip exists, it copies to `greeting_en_morning` (+ legibility health + CALL OK fingerprint). Old blob stays in IndexedDB as a recoverable orphan (Storage panel → Export backup).
- **Meta migration (seed 2→3):** stored `open_client` entries drop out; untouched tiles relabel automatically; user-renamed labels preserved.
- On-call strip unchanged (7 tiles). Tests: soundboardMeta + cloudSync + releaseNotes green, build clean.

## v4.98.0 - Call Autopilot (phrase-driven auto start/end)

- **New (`callAutopilot.js` + `SessionContext` + `useDeepgram`):** 🤖 Call Autopilot (Settings → Behavior, default OFF). One CONNECT press arms it; after that the platform's own announcements run the session — a bridge phrase ("call is being bridged") STARTS the call, a disconnect phrase ("the caller has disconnected") opens a **10s cancellable banner** then ends it (same stop path as SilenceGuardian: audio pipeline + session).
- **Strict start:** with autopilot ON, any-speech auto-start (v4.92.0) is suppressed — queue-wait announcements ("please continue to hold…") can no longer start billing. Speech auto-start behavior is unchanged when autopilot is OFF.
- **Safety gates:** 25s cooldown after any auto-end/cancel (no bounce-start from trailing "thank you for using…"); end phrases ignored while on hold and during the first 60s of a call (echo window); end detection only on final transcripts.
- **Editable phrases:** Settings → Behavior → "Phrase lists" — start/end lists are one-per-line textareas (defaults shipped, stored in `catint_autopilot_phrases_v1`).
- **Ring/bell listener (experimental, LOG-ONLY):** while armed, `toneWatch.js` samples the preserved tab stream's FFT and records narrow-band bursts (`AutopilotSettings` panel shows tone frames + dominant Hz). Nothing acts on tones yet — data first, thresholds later.
- **Header:** green `🤖 AUTO` chip next to the app logo while armed; hover shows the last autopilot action.
- Tests: 18 new (`callAutopilot.test.js`, `toneWatch.test.js`).

## v4.95.1 - Meter-only HUD mode

- **New:** 3rd HUD mode during calls — 📊 button (top-right, next to ⌃) toggles meter-only: sticky timers hidden, big workday timeline (ON/OFF/LEFT, larger font, static layout) + 💵⏱☕ targets strip. Persisted `catint_hud_meter_only_v1`.
- **Fix:** off-call — metrics strip and I/O bar now have hard separation (border + z-index), no overlap.

## v4.94.1 - CPU freeze fix (blank caption row)

- **Root cause:** an empty live-draft caption row (created when the overlap cleaner emptied the first transcript of a turn) could never seal and stayed in state forever. Every board render skipped it and fired a forced `console.warn` (`ui_blank_caption_skipped`) — 4×/sec all call long × full-board render + layout reads = 100% CPU freeze. NOT the translation API changes.
- **Fix 1 (`captionEngine.js`):** `mergeCaptionsForUi` never merges a blank live draft; the `overlap_empty_freeze` branch drops a freshly appended all-empty draft instead of keeping it (also stops blank rows persisting to IDB / resurrecting on reload).
- **Fix 2 (`TranscriptionBoard.js`):** blank-caption vanish log deduped by id — once per session, not per render.
- **Fix 3 (`sensitiveDataProtector.js`, pre-existing red tests):** ssn/phone sentinels now override the address/date guards in both `stitchSingleDigitSequences` and `formatPhoneAndSSNDigits` — "Medicaid ID 1013159516, Madison Avenue May 8" groups to `101-315-9516` again.
- Release notes entry added (4.94.1) and 4.93.0's empty `highlightElementIds` fixed. All 71 test files green, build clean.

## v4.94.0 - Tiny translate chunks (one sentence/comma per local API request)

- **Fix (user request):** translation requests to the local model were up to 40-word chunks — paragraphs stalled it and translations arrived minutes later. Requests are now **one sentence or one comma-clause at a time, max 14 words**; hard ceiling 24 regardless of what a caller passes.
- `segmentLongMonologue` (`translationApplicator.js`): sentence peel → comma/semicolon split → clause groups ≤14 words. `useTranslate.js` no longer overrides with `maxWords: 40`.
- Regression tests added; 52 translation tests pass, build clean.

## v4.93.1 - CPU sink fix (inspector + mic meter + transcript tick)

- **HUD inspector:** mousemove storm (60-120 setStates/sec + layout thrash per pixel) → rAF-coalesced, same-element short-circuit, per-element selector cache. Same feature, ~zero idle cost.
- **Mic meter:** 60fps analyser + DOM writes → ~10Hz analysis, rounded values, identical writes skipped. Quiet frames still tick so the 3s no-signal timer fires.
- **Transcript:** in-call freshness tick 250ms → 1000ms (4 full-board renders/sec → 1; windows are 1400/4500ms so indicators stay correct).

## v4.93.0 - No more [⚠ Check: …] badges in transcripts

- **Fix (user request):** removed the `[⚠ Check: …]` salvage markers that made translations unreadable. Root cause: the "address" regex treated ANY `number + word` ("7 minutes", "1 of", "5 to") as a sensitive address, flooding every sentence with badges.
- **Safety kept:** digit-loss still flags `weak_digit_loss` and preserves the previous good translation (`translationApplicator.js`); only the text injection is gone. Legacy persisted text with markers is stripped on display (`composeCaptionTranslation`).
- **Tests:** `translationSensitiveTokens` regression — time phrases yield zero tokens; real addresses ("123 Main Street") still detected.

## v4.92.0 - Always-on ear (speech detection between calls, zero cost)

- **New:** after STOP the Deepgram sockets stay warm (KeepAlive pings only — NO audio is sent, so zero Deepgram usage) and a local VAD (WebAudio RMS on the preserved tab/cable stream) watches for speech. Speech ~0.3s → recorder resumes → transcript → existing speech auto-connect starts the call by itself. No CONNECT press between calls anymore.
- **Rules:** `src/utils/idleEar.js` (tested). Falls back to full disconnect when Speech Auto Connect is OFF or the stream is gone. Sockets died while idle → wake rebuilds them from the preserved stream (no tab picker, no gesture). One CONNECT press per browser session remains (browser gesture rule for tab capture).
- **Fix:** `startSession` now cancels the 15s HIPAA finalizer — an auto-started call inside the grace window no longer wipes its own transcript. Call-detect toggle now also disables speech auto-start.

## v4.91.0 - Smart tooltips on daily-targets chip

- **New:** hover the 💵 ⏱ ☕ chip → instant floating panel, all USD: earned/target today (%), on-call minutes to go ≈ $, break taken + what still fits by 18:00 + cost per break minute, month vs $1200, 5500m floor, 18:00/23:00 overtime slack. Replaces the slow native `title` tooltips. `src/components/DailyTargetsChip.js`.
- **Move:** chip lives in `session-controls-center` now (off-call under status line, in-call beside micro-bar grid, bar stays 32px) — moved out of the I/O strip.
- **Tighten:** metrics summary + quick buttons share one line (`header-metrics-strip` row-wrap, bars drop below); I/O strip contents forced single-line scroll (`audio-route-status-main` nowrap).
- **Fix:** compact goal meter no longer overlays the I/O bar — in-flow second row (`dashboard-header--call-compact`).
- **Space:** 4px padding on every item in the header rows (strip, quick, I/O, micro-bar).
- **CPU:** `[CAT STT]` per-chunk console spam now opt-in (`localStorage catint_stt_verbose=1`); dead translate gateway (502) backs off 90s instead of refiring per segment.

## v4.90.0 - Auto break (counts ALL no-transcription time)

- **New:** break timer runs itself — 3s with no transcription detected → ☕ ticks (off-call idle AND mid-call dead air). Hold (provider keywords: "one moment", "please hold", "put you on hold"…) pauses break — that's work. Speech resumes → break banks itself into ☕ taken.
- **Rules:** `src/utils/breakState.js` (tested). Grace 3s; ≥5 min idle restarts the "working without break" nudge; STOP BREAK suppresses auto-break 10 min (desk-work grace); no auto-break before 9am or during zombie calls.
- **Note:** ☕ taken now includes waiting-between-calls idle — the 90m break budget and compensated log-off (18:00 + late + break) consume it accordingly.

## v4.89.2 - Inspector ON by default

- **Fix:** ⌖ HUD inspector now defaults ON — hover anything, get name + selector, click copies. No toggle hunt. Off persists via ⌖/Alt+I.

## v4.89.1 - Hold auto-resume (click-outside + speech)

- **Fix:** study hold overlay no longer traps you — click outside the card (or Enter/Escape) resumes; any detected speech (<2s silence) auto-lifts hold. Rules in `src/utils/holdState.js` (tested); overlay click in `App.js`.

## v4.89.0 - HUD inspector (hover any element, click to copy selector)

- **New:** ⌖ toggle bottom-right (or Alt+I): hover ANY hud element — incl. plain container divs — shows name + unique CSS selector; click tooltip (or press C) copies `name :: selector` for bug reports. Works during calls. `src/components/HudInspector.js`.

## v4.88.4 - De-duplicated timers/earnings

- **Cleanup:** the `$ 📞 📡` block no longer renders twice (center idle slot emptied; sticky row keeps it). Header metrics summary trimmed to `X% mo` — mins/$/📞📡 live in the sticky row and the status-bar targets strip.

## v4.88.3 - Readable status-bar targets strip

- **New:** status bar center shows 3 readable current/target pairs: `💵 $earned/$target · ⏱ done/target · ☕ break taken/max`. Break max = total break for today that still lets you hit the $1200-pace minutes by 18:00; hover adds the 5500m fallback and 23:00 overtime slack. Chip turns orange when 18h is no longer reachable.

## v4.88.2 - Endgame plan in scoreboard

- **New:** line under the ⏱️ mins cell: `🏁 need XhYYm on call · off≤18h: … · off≤23h: …` — on-call time still needed today for the $1200/mo pace, plus slack time if you finish by 18:00 / 23:00 (`computeEndgamePlan` in `DailyTargetsChip.js`).

## v4.88.1 - Daily targets in status bar

- **New:** always-visible chip in the I/O status bar: minutes + USD needed TODAY for the $1200/mo goal, plus minutes left this month. Hover shows the 5500m fallback floor numbers.
- **Goal tiers:** primary $1200/mo (~9231m @ $0.13/min); fallback 5500m/mo (rate floor). `src/components/DailyTargetsChip.js`.

## v4.88.0 - Study cue cards (between calls + on hold)

- **New:** rotating study cards in the off-call idle pane (supersede the rotating tip) and as a fade-in overlay over the transcript during HOLD — dead hold time becomes study time.
- **Cards:** EN→ES glossary, NO-SAY warnings (aseguranza→seguro, enrolarse→inscribirse, always usted, first person), acronyms, QA reminders. Tap to reveal, auto-rotate 10s, skip.
- **Domain picker:** chips on the card (auto/insurance/education/utilities/financial/social/medical/all), persisted `catint_study_domain_v1`. QA cards show in every domain.
- **Data:** `src/utils/studyDecks.js` — seeded starter deck (~55 cards). Full LanguagesCX glossary: paste cleaned rows into `STUDY_CARDS`; jest validator (`validateDecks`) fails the build on duplicate EN terms (airbag/appointment/license dupes) or empty fields.
- **Toggle:** Settings → Display → "Study cue cards" (`study_cue_cards`, default always).

## v4.87.5 - Vertical paste hardening

- **Bug:** v4.87.4's vertical regrouping required an exact-match date line — NBSP / odd line endings from the client app copy made it bail (49 skipped, 0 rows).
- **Fix:** normalize NBSP-family spaces + CR line endings before parsing; tolerant date/money token matching; vertical grouping only when no line parses as a full row on its own.
- **Diagnosis:** "No valid rows" now shows the first skipped line so the next paste failure is self-explanatory.

## v4.87.4 - Call-log import: one-field-per-line paste + today is authoritative

- **Bug:** pasting the client app's list copy (each field on its own line — id, date, time, mins, Yes, No, $) parsed 0 rows. Parser now regroups vertical pastes into records (closes on `$` token or new date after 6+ fields).
- **Bug:** today's import used `Math.max(prev, imported)` — correcting to a lower value was a no-op. Import now OVERWRITES `dailyMinutes`/`callsToday` (up or down); monthly/weekly absorb the signed delta (floored at 0). Today also writes `dailyLog` + `historyTimeline` so the progress-bar timeline repaints.
- **Removed:** `devStatsSeed.js` (localhost 09/08 59m seed) — it masked import corrections.
- **Panel flash:** now shows `Today: old m → new m` + version tag.

## v4.87.2 - Speech auto-start: call state sticks (stale closure fix)
- **Bug:** when a call auto-started from speech (audio attached, no call yet), the Deepgram socket handler held a stale `isActive=false` closure — `startSession()` re-ran on EVERY confident transcript, resetting the call timer to 0, spamming timeline `work` events + purse-open sound. ON-call tracking looked broken.
- **Fix:** live refs in the Results handler (`isActiveLiveRef`, `isZombieCallLiveRef`), `trySpeechAutoStart` guard now ref-based (`isActiveStateRef`), and `startSession` refuses double-start while active (recovery exempt).
- On/off-call detection itself is unchanged: transcript confidence > 0.4 → ON call; silence watchdog (3 prompts + 7 min, hold-exempt) → OFF call.

## v4.87.1 - Call-log paste actually works + 09/08 seed

- **Settings → Data:** paste now accepts space-separated rows (chat/monitor copy with no tabs) + space header, not just TSV/CSV — your 4-row paste previews 59m/4 calls instead of "No valid rows".
- **Today import:** seeds via max() (never clobbers live-banked minutes), monthly/weekly absorb the seeded delta, re-import is a no-op — counter keeps going up, hot-reload safe (localStorage + apply-once seed).
- **Localhost seed:** 2026-09-08 hardcoded — 4 calls = 59m (09:02 13m, 09:35 10m, 10:29 7m, 10:41 29m) so 📞 shows 59m on fresh :3001.
- **Soundboard Studio:** 14 verbatim handbook scripts (`scripts.txt`, "By the Book") preloaded as recording texts — openers, direct dial, repeat/segments/interrupt/static, ghost, stay/leave, blocked, voicemail, operator 12241, closing, LEP bye. `greeting_en/es` + `sign_off` updated to verbatim. One-time reseed overwrites stale stored texts only (recorded audio untouched; stale legibility health cleared for reseeded keys).
- **VB-out picker selectable:** remembers device labels across origins, explicit hand-pick never auto-overridden, blank slots show stable names + one-Allow guidance, Voicemeeter sink strictly means Standard input.

## v4.87.0 - Daily income bar + editable month target
- **Status bar:** big orange `$ earned today` (live) next to 📞 on-call / 📡 off-call totals (both header spots: side timers + center idle block).
- **Scoreboard ($ MONTH cell):** shows `month minutes / target` pill — click ✎ opens the goal dial to edit the monthly target (default 5500m).
- **Soundboard:** default route back to `passthrough` — the v4.86.2 switch to `dual_element` put two elements on the same virtual sink (patient-side garble; see `docs/soundboard/voicemod-comparison.md`). If your Studio ever set the mode explicitly, it stays as set (`localStorage CATINT_ROUTE_MODE`).
- **Voicemeeter script:** `scripts/setup-voicemeeter-mic.ps1` now takes `-MicName` (default `Realtek`) instead of hardcoded HS-220U, and enables Strip[2]→B1 for app greetings per `docs/soundboard/voicemeeter-mic-plan.md`.
- Tests: 61 suites / 410 tests all pass (fixed 3 stale failures); production build verified.
- **Settings → Data:** company call-log paste import (`CallLogImportPanel`) — paste client-app rows (TSV/CSV), preview per-day on/off minutes, apply overwrites day totals + timeline and seeds today/monthly so scoreboard, progress bar + heatmap follow.
- **VB-Cable attach:** saved CABLE Output ID is validated against live devices (old cross-origin IDs re-picked by label), blank-label origins get one permission prompt, and `OverconstrainedError` retries once — no more silent stuck-on-tab.
- **VB-out picker selectable:** remembers every real device label, so CABLE Input / Voicemeeter Input stay readable on fresh origins; an explicit hand-pick is never auto-overridden (persistence fix); blank-label slots show "Output N · names hidden" + one-Allow guidance; Voicemeeter sink strictly means Standard input (AUX/VAIO3/numbered rejected).

## v4.86.8 - Pins persist across calls
- **Bug fix:** pinned messages were auto-wiped at call start, call end, AND end-of-day — "unpinning themselves". Pins now persist across calls and days.
- Kept: explicit HIPAA wipe-all still clears pins (via `catint_pinned_cleared`); clear-log dialog behavior unchanged ("Pinned messages stay").

## v4.86.7 - Auto-start on speech default ON
- Speech auto-start (`speechAutoConnect`) now defaults to **on** for fresh profiles — if a listening stream detects speech while off-call, the session starts automatically (existing toggle in Settings still respected: `'0'` stays off).
- Auto-stop verified: SilenceGuardian ends ghost calls after 3 silence prompts + 7 min, and trailing silence >30s is deducted from billable time at STOP.
- Total-mins editing: 📞/☕ edit buttons → TimeEditModal (live timer / ±add / set total; fixes daily+monthly together).

## v4.86.6 - Center timers + localhost call-history seed
- Off-call center of the sticky row shows `📞Xm 📡Ym` instead of "Disconnected" (error/connecting/zombie states keep status text).
- `src/utils/devStatsSeed.js` (called from `index.js`): localhost-only apply-once seed of 2026-09-03 call history — 15 calls = 172m — into `catintassist_stats` before first load. Monthly absorbs only the delta.

## v4.86.5 - Draggable scoreboard + sticky-row timers
- Grab bar at the bottom of the expanded scoreboard (portal mode): drag to resize height 18–80vh, persisted in `catint_scoreboard_max_vh`.
- 📞/📡 today timers now also live next to the Connect button in the sticky row (visible even when it says Disconnected).
- Smart tooltips (ElementHint) added for the timers chip; grab bar has title/aria.

## v4.86.4 - Strip de-clutter (low-hanging fruit 1-2)
- Metrics toggle hidden in full-HUD mode where it had no effect (dead button).
- Strip summary drops `% mo · AR$` when the expanded income HUD already shows them; day progress + 📞/📡 timers always visible.
- Audit notes + revert paths: `docs/development/scoreboard-ux-notes.md`.

## v4.86.3 - On/off-call timers + connect width
- Header strip summary now shows today's `📞Xm` (on-call) vs `📡Ym` (off-call = avail+break) next to the daily/monthly summary — glanceable slack/hustle tracker.
- Connect button widened to exactly 2× button cell (two emojis read as two glued buttons).

## v4.86.2 - 12-grid fit fix
- Expanded scoreboard panel cap raised to `min(38vh, 260px)` — 4th grid row (switcher row) no longer clipped.
- Scoreboard grid cells compacted (min-height 56→42px, tighter padding/gap, smaller value font) to reduce padding waste.


## v4.86.1 - Local dev translation gateway
- `npm run gateway` serves `api/translate.js` on `127.0.0.1:59210`; `src/setupProxy.js` routes dev `/api/translate` to it. Translation now works under `npm start` without the Vercel gateway (falls through Azure/DeepL/Google/AWS/MyMemory using `.env` server keys).


## v4.86.0 - Scoreboard de-dupe + 20/80 → guideline
- Off-call expanded Metrics no longer duplicates bars/quick-row where the card, progress stack, or outer controls already show them.
- Flip-panel card can now be opened by the Metrics toggle outside portal mode (never alongside the expanded income HUD).
- 20/80 space rule relaxed to a guideline (docs/scoreboard/README.md): scoreboard may grow off-call; transcription must always stay visible.


## v4.85.17 - Locked-key critical-call recovery
- If a saved Deepgram key is locked, Connect now opens the Deepgram vault directly. Press **Unlock**; if the password is already present, one click restores transcription.
- Missing/locked-key failures now say what broke and show the immediate recovery instead of attempting audio capture first.

## v4.85.16 - Deepgram console outage logs
- Console now logs Deepgram startup, socket open/error/close, API-key failures, and final connection failures.

## v4.85.15 - Ghost-call close
- After the existing three warnings and 7 minutes without Deepgram speech, the app now stops both the work session and Deepgram.
- Holds are excluded. This preserves the conservative threshold while preventing forgotten STOP from skewing time or leaving STT open.

## v4.85.14 - Quiet local translation
- Browser translation now calls the local `127.0.0.1:59200/stt/translate` service first, one mouthful at a time.
- Azure, Google GTX, and MyMemory are no longer browser requests, so their 401/CORS errors cannot pile up in DevTools. The Vercel gateway remains the fallback.

## v4.85.13 - One-click VB work route
- `VB` now auto-selects detected `CABLE Output` for STT and saves it for the shift.
- If CABLE Output is missing, VB refuses to start rather than capture the default physical mic.

## v4.85.12 - Translation browser safety
- Browser no longer calls Azure, DeepL, OpenAI, or Google GTX directly. This stops invalid-key 401s and Google CORS request noise.
- Translation uses the server gateway first, then one rate-limited free fallback; no translation result still falls back visibly rather than blank.

## v4.85.11 - Translation request guard
- Auto translation waits for at least two words, then sends on a final/sentence, split, or each 10 new live words.
- Translation requests are serialized: one active request at a time across bubbles.

## v4.85.10 - Simple translation fallback
- Translation tries the server gateway first, keeping any provider keys off the browser.
- If no server provider is ready, it falls through to Google GTX, then MyMemory; a failed gateway cannot leave the translation pane blank.

## v4.85.9 - Status cat
- Header cat is gray while ready, blue while connecting, green when both STT lanes are live, amber when attention is needed, and red on STT error.
- Silent patients do not turn the cat red; status is based on connection health, not speech volume.

## v4.85.8 - Active-call TAB/VB switcher
- The fixed 30px call row now exposes `TAB`, `VB`, and concise Deepgram/text proof at 900×600.
- Source switches acquire first and persist only after success; failed TAB/VB acquisition leaves the current captions and stream live.
- Work-call connection now selects only Tab or VB-Cable. Physical Mic remains for off-call/testing tools.

## v4.85.7 - Tab-only work calls
- Disabled the inverted physical-mic fallback and stopped persisting mic-test mode into later calls. Tab failure now stays a visible Tab failure.
- If an active call is on Mic, the compact HUD now exposes `USE TAB` to reopen the tab picker immediately.

## v4.85.6 - Bounded scoreboard grid
- Metrics now opens the 12-cell number grid directly, inside a capped 28vh/180px scroll area; it cannot take over the transcription workspace.
- Hovering the CatIntAssist icon now always shows the build version.

## v4.85.5 - Scoreboard restore at 900px
- Restored the off-call scoreboard strip at small-screen widths. Its Metrics button, 12-cell grid, and three progress bars are reachable again; call-mode chrome remains compact.

## v4.85.4 - Clear compact call HUD
- During a call, the I/O strip now shows only Tab proof and Deepgram state; device dropdowns and setup controls are hidden until off-call.
- Removed duplicate slot-style daily timers and normalized all HUD duration inputs to whole seconds, fixing the floating-point OFF value.

## v4.85.3 - Disconnected shift totals
- The disconnected I/O strip now shows daily ON-call and OFF-call workday totals. Deepgram remains closed between calls because streaming is billed by processed audio duration, not recognized words.

## v4.85.2 - Stop keeps Tab ready
- Stop now closes Deepgram between calls while retaining the selected Tab MediaStream. The next Connect reuses it without the tab picker; explicit source switch or browser sharing stop still releases it.

## v4.85.1 - Always-visible workday line
- Compact call mode now shows the 09:00-18:00 timeline: blue calls, orange available time, red breaks, a white current-time line, and literal ON / OFF / LEFT totals.

## v4.85.0 - Translation outage gateway
- Translation tries the private Vercel gateway first: Azure, DeepL, Google Cloud, then Amazon Translate. Browser-only Google/MyMemory remain last-resort legacy fallbacks.

## v4.84.49 - Live bilingual translation
- Translation runs at each 10 new live words, on sentence completion, and on splits. Source-language echoes are rejected.

## v4.84.48 - Cached translation echo guard
- Old cached source-language echoes are discarded before rendering; they cannot appear as a translation.

## v4.84.47 - No duplicate source text
- A failed translation leaves its pane empty; the center rail turns amber while retrying instead of repeating the source language.

## v4.84.46 - Small-screen call chrome
- STT status is a single compact row; Greetings becomes a bottom drawer; the always-visible goal line is blue banked time plus orange current-call time.

## v4.84.45 - Spanish release-note encoding
- Spanish release notes use Unicode escapes so accented characters cannot render as mojibake.

## v4.84.44 - Translation state is explicit
- A source fallback in the translation column is labeled `SOURCE · RETRYING`; it cannot be mistaken for a valid translation.

## v4.84.43 - Softer live text cues
- Only arriving or corrected words softly fade in; already-readable transcript text stays fixed and visible.

## v4.84.42 - Tab proof at a glance
- Persistent Tab proof chip shows: pick tab, attached/opening Deepgram, packets reaching Deepgram, then live text.

## v4.84.41 - Work-safe silence
- Disabled all synthetic reward and alert sound effects. Call audio, TTS, and soundboard clips are unchanged.

## v4.84.40 - Always-visible STT route
- The compact I/O strip remains visible during calls: selected Tab/Cable/Mic route plus Deepgram state.

## v4.84.39 - Tab fails closed
- Tab STT never automatically switches to the physical microphone. Bad tab sharing remains a visible Tab error.

## v4.84.38 - Stop rapid sound loop
- Removed the 150ms celebration coin loop. Audio only plays on explicit call/day events or once per minute.

## v4.84.37 - Tab STT route recovery
- Selecting Tab or VB-Cable clears the saved Mic STT override before Connect.

---

## v4.84.28 — Fix STT: drop medical model (filler_words conflict)
- Root cause: EN socket used `nova-3-medical` + `filler_words=true` — Deepgram only allows filler words on **general** models → EN lane dies / garbles
- Both lanes → `nova-3-general` + numerals; keep filler_words
- Also: arm caption capture before Connect auto-starts call (was dropping early finals until React painted `isActive`)
- Hard refresh + reconnect STT after call (or between calls)

## v4.84.27 — Soundboard “can’t hear myself” routing UX
- Root tip: **VB out = CABLE Input** (not speakers). Windows Listen only hears greetings on the cable.
- I/O strip: detects wrong sink / swapped Input↔Output → ⚠ chip + **Fix → CABLE In**
- Smart ElementHints on 📥 STT in · 🎤 Mic · 🔊 VB out · 🧪 Test · Mic Monitor
- Studio banner when VB out is speakers/wrong

## v4.84.26 — STT accuracy + truthful health rail
- ~~Deepgram: Nova-3 Medical for English~~ — **reverted in v4.84.28** (medical + filler_words unsupported)
- Bottom STT rail turns amber on repeated empty Deepgram replies or an active-call render gate block
- `npm test` runs fresh-memory batches so the full suite does not die midway on Windows

## v4.84.25 — Soundboard picture gallery
- Studio play grid = photo gallery; labels on hover (toggle **Labels** = always on); size slider
- On-call greetings = thumbnail tiles + size slider (was text chips)
- **▶ LIVE to patient** banner + progress while greeting plays (studio + on-call)

## v4.84.24 — Sticky bottom transcript follow
- Default-on **⬇ sticky** toggle; follows live bubble growth (was only new/final)
- Scroll-up still pauses; re-enable via toggle

## v4.84.23 — Connect button mode + robot icons
- Green Connect shows STT mode SVG (bookmark / headset / mic) matching I/O strip
- Robot SVG after mode icon when Deepgram key is unlocked/available

## v4.84.22 — STT route toggle: 🔖 tab · 🎧 VB · 🎤 mic
- Mic joined Tab/VB in the I/O strip 3-way toggle (header mic button removed)
- Emoji labels; picking one clears the others; hotkey M still toggles mic

## v4.84.21 — Off-call tips respect audio mode
- Idle pane / status / scoreboard tips check tab vs VB-Cable vs mic — no more “Tab mode” copy while on VB
- Mode-filtered rotating tips + checklist; newcomer guide step 1/2 matches mode
- VB + mic stay separate (playback differs) but share “device input / no tab picker” tip framing

## v4.84.20 — Release notes modal (ES default) + VB-Cable shine
- Bilingual what's-new modal on first load per version (`ReleaseNotesModal`, `src/content/releaseNotes.js`)
- ES default, EN toggle; **Entendido** / **Ver después** (24h) / **No mostrar de nuevo**
- Post-dismiss: header buttons shine (`catint-ui-shine`) — VB Cable, Tab, → Tab, VB out
- Docs: `docs/onboarding/release-notes.md`

## v4.84.19 — VB-Cable route toggle + tab fallback
- I/O strip: Tab | VB Cable toggle, → Tab backup, cable device pickers
- Tab picker cancel → disconnected (no red error spam)
- Docs: `docs/development/audio-routing-no-spof.md`

## v4.84.17 — Unified button sizing
- Continuity keys by seal ordinal (`g{n}`): live bubble keeps its DOM node when it seals or splits — only the tail mounts new. Kills the vanish/reappear-elsewhere mid-read
- Height lock releases on text shrink (was re-locking at inflated height — the "void" after splits): `liveBubbleHeight.js`
- Repro: `[CAT VANISH] caption_bubble_split` + `caption_split_or_append` on `dg-es-152.82-i` (training video 2026-07-09)

## v4.84.9 — DOM vanish net
- `observeDomVanish`: MutationObserver flags `dom_bubble_removed` / `dom_bubble_relocated` even when no words are lost

## v4.84.8 — Name chips: ES cues + accent fix
- `mi nombre es Maria Lopez` → strong cue (lowercase OK); bare `soy Josefina` → weak cue (Capitalized required)
- ES role/condition stopwords: `soy la intérprete` / `soy alérgica` / `Soy Diabética` never chip
- Accented letters no longer truncate captures (`Diabética` ≠ `Diab` chip)
- Brief acceptance tests added: `I'm here`, `me llamo Josefina`, `Dr. Perez`

## v4.84.7 — Phase E dosage / money units
- `500 mg`, `2.5 ml`, `$25.00` highlight/copy as one unit (not lone digits)
- Phones/dates still separate; overlap unchanged

## v4.84.6 — Phase D spelling soften
- Display keeps spoken spelling paragraph (no `\n` mono remount cliff)
- Sealed trailing **Spelled** chip still consolidates (SMITH); `formatSpellingText` opt-in only
- Removed InteractiveText spelling-branch layout swap

## v4.84.5 — Phase C sentinels wired
- `detectSentinelContext` gates display stitch/phone format
- Skip stitch: date · address · email · spelling
- Skip phone format: those + dosage · medication · price
- phone/ssn modes still format; overlap guards unchanged

## v4.84.4 — Phase B date units
- Date spans (`May 8 1990`, `8 May 1990`, `3/15/26`) highlight/copy as **one** unit (ISO when year present)
- Mask dates before digit stitch/phone format; skip stitch near month/year
- `8 mg` stays a lone number; phones still group
- Plan: `docs/development/sensitive-data-approach.md`

## v4.84.3 — Phase A name chips
- `I'm sorry` no longer → Name chip (stopwords + weak-cue Capitalized gate)
- Chips: sealed bubbles only; trailing under text (not slab above)
- Plan + diagram: `docs/development/sensitive-data-approach.md`

## v4.84.2 — Vanish / derender console flags
- `window.__catintVanishTrace` + `[CAT VANISH]` logs when words/segments shorten, remount, or derender
- Wired: overlap strip, hallucination prune, digit stitch/phone reformat, spelling layout flip, live→sealed, morph diff, caption split
- Mute: `window.__catintVanishOn = false`
- Protector audit note: dates/dosage/address are detect-only (no formatters); spelling ≥3 “as in” flips sealed layout

## v4.84.1 — Continuity-preserving StableTextMorph
- Live source: word-level `diffWordsStable` + `StableTextMorph` (A→B without blank remount)
- Changed spans: brief `from ⇢ to` cue; protected tokens (phones/doses) never vanish
- Reduced motion: instant highlighted patch (no typewriter)
- ScrambleText remains for non-critical UI only

## v4.84.0 — Stable transcript display
- Live STT source: no ScrambleText; single `StableLiveTranscriptText` path (committed prefix + uncertain tail)
- Continuity keys by turnId so live id flips do not remount readable text
- Sealed bubbles: no typewriter/scramble; translation column isolated from source reflow
- Helpers/tests: `stableLiveTranscript.js`

## v4.83.1 — Phase 0 viewport / Azure blockers
- Azure status: missing / unauthorized·key-region mismatch / error / ok (success-only) / paused; fallback-chain banner
- Live bubble height: anti-jitter only; release on shrink/seal/split (no historic max slab)
- On-call soundboard: `grid-column: 1 / -1` above transcript+tools
- STT: single bottom status rail (removed top absolute + pending bubble)

## v4.83.0 — Phase 0 Smoke Dashboard
- Settings → Behavior → Phase 0 Smoke: operator checklist + live stack probes
- Does not re-implement v4.81/v4.82; proves them on the real stack
- `npm run test:phase0-smoke` · docs: `development/phase0-smoke-dashboard.md`

## v4.82.0 — Translation safety ledger
- Pure `applyTranslationResult` — keyed `captionId::segmentId::sourceHash::targetLang`
- Invariant: weaker never overwrites stronger (`preserved: true` / strength rank)
- Filler-only target (`bueno`…) rejected; blank/fail → source passthrough (never silent blank)
- Sensitive-token salvage / `weak_digit_loss`; reformatted phones count as present
- Long monologue → ~40-word chunks (removed >80 hard reject)
- Persist sealed translations on `caption.translations` in IDB; hydrate on refresh
- `stopSession` clears revenant/zombie re-attach gate
- `npm run test:translation` + fixtures
- Docs: [`development/translation-reliability-harness.md`](development/translation-reliability-harness.md)

## v4.81.0 — Transcription test harness
- `applyDeepgramTranscriptPayload` — live WS + fixtures share one reducer path
- Fixtures (fake PHI only): phone, dosage, DOB, address, bilingual, low-confidence, disconnect-reconnect
- Settings → Behavior → Test Harness (`REACT_APP_DEV_TEST_HARNESS` for prod unlock)
- `npm run test:fixtures` / `test:transcription`
- Docs: [`development/transcription-test-harness.md`](development/transcription-test-harness.md)

## v4.78.0 — Corrections backup + export pack
- Settings → **Data** tab: export/import/clear taught corrections
- `exports/audio-greeting-editor/` — spin-off waveform editor (documented)
- Compliance docs: `docs/compliance/`
- Tests for exported `audioEditorCore`

## v4.77.0 — Production readiness (a11y + PWA)
- Fixed broken PWA manifest (missing icon 404s)
- Clear-log confirm; footer a11y; skip-to-transcript link
- Reduced-motion support (CSS + ScrambleText)
- Modal focus trap; dev-only Deepgram console noise
- Docs: [`development/production-readiness.md`](development/production-readiness.md)

## v4.76.0 — Bubble corrections (teach STT + glossary)
- Double-click / ✎ on source or translation → floating editor → **Save & teach**
- STT corrections auto-replace misheard phrases; glossary skips API for exact sentences
- Docs: [`transcription-pane/corrections.md`](transcription-pane/corrections.md)

## v4.75.8 — Debug ingest cleanup
- Removed `127.0.0.1:7891` debug probes from hot paths (`useDeepgram`, `TranscriptionBoard`, `App`, etc.)
- Tail preview render tighten; dead CSS removed

## v4.75.7 — Blue tail + render tighten
- Stable `resolveTailHighlight()` for split rollover
- `MemoInteractiveText` + plain-text tail (no scramble on tail)

## v4.75.6 — Transcript copy + digit stitch
- `CopyChip` rows for names / spelled text above bubbles
- `stitchSingleDigitSequences()` — phone digits copy without spaces
- `collectCopyableEntities()` in `transcriptFormat.js`

## v4.75.5 — ElementHint tooltips
- Rich hover tooltips: unique name + **copy selector** button
- Wired on header, scoreboard strip, 12-grid metrics, I/O strip
- Docs: [`development/element-hint.md`](development/element-hint.md)

---

*Older releases: see collapsible **Completed Tasks** in root `AGENTS.md`.*
