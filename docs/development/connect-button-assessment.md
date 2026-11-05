# CONNECT Button & STT Reliability Exhaustive Assessment (v4.203.0)

**Date:** 2026-11-05  
**Audience:** Lead Developer, Systems Architect, Operator  
**Scope:** Definitive diagnostic evaluation of all 8 elements of the CONNECT button pipeline, identifying why CONNECT fails on ~80% of live call attempts while ZAP recovers ~95% of the time, and the precise file-by-file remediation roadmap.

---

## 1. Executive Summary: The 80% Failure Reality

During live production on **v4.203.0**, the operator reports that clicking the **CONNECT button fails approximately 80% of the time** on incoming calls. Clicking **ZAP** (or double-tapping ZAP) remains the only mechanism that reliably recovers transcription.

Every element in the end-to-end chain was audited:
1. **UI Button Element & Intent Routing** (`ConnectInterpretButton.js`, `DashboardHeader.js`)
2. **Call Lifecycle Dispatcher & Self-Heal** (`App.js`, `connectEvidence.js`)
3. **Stream Lifecycle & Chrome Tab Reuse** (`inputSource.js`, `connectEvidence.js`, `useDeepgram.js`)
4. **Socket Teardown & Deepgram Concurrency Slot Collisions** (`useDeepgram.js: startDeepgram`)
5. **The Missed v4.203.0 WebM Header Fix** (`useDeepgram.js: startRecorderOnSockets` vs `startDeepgram`)
6. **12s Watchdog Suicide on Normal Call Silence** (`useDeepgram.js: evaluateStall`, `dgStatus.js: connectStallVerdict`)
7. **Acoustic VAD Level Threshold Disconnect** (`useDeepgram.js: startCallVad`, `dgStatus.js: sttStallReason`)
8. **The ZAP Asymmetry Mechanism** (Why ZAP recovers what CONNECT breaks)

---

## 2. Complete Element-by-Element Diagnostic Matrix

| # | Element | Code Location | What It Does on CONNECT | Why It Fails (Root Cause) | Failure Impact |
|---|---|---|---|---|---|
| **1** | **UI Button & Intent Resolver** | [`ConnectInterpretButton.js:43-70`](file:///C:/zengatrivi/REACTJS/catintassist/src/components/ConnectInterpretButton.js#L43-L70)<br>[`DashboardHeader.js:1981-1998`](file:///C:/zengatrivi/REACTJS/catintassist/src/components/DashboardHeader.js#L1981-L1998) | Resolves user click to `intent`. If `audioAttached` is true, routes to `onStartCall`. | If `audioAttached` was held `true` off-call (idle-ear wake), clicking CONNECT calls `startSession()`. **It does not touch audio or sockets at all.** | **~20%** of fails: CONNECT doesn't even attempt to start/refresh Deepgram. |
| **2** | **Premature Call Activation & UI Lockout** | [`App.js:597-609`](file:///C:/zengatrivi/REACTJS/catintassist/src/App.js#L597-L609)<br>[`DashboardHeader.js:449-465`](file:///C:/zengatrivi/REACTJS/catintassist/src/components/DashboardHeader.js#L449-L465) | `startRecording()` returns `true` synchronously. `handleStartCall(false)` sets `isActive = true`. | CONNECT button is **instantly unmounted** at t=0ms and replaced by STOP before WebSocket connects. | Operator cannot retry CONNECT; trapped unless they spot ZAP. |
| **3** | **`shouldHealConnect` Auto-Heal Neutralization** | [`App.js:650-666`](file:///C:/zengatrivi/REACTJS/catintassist/src/App.js#L650-L666)<br>[`connectEvidence.js:71-80`](file:///C:/zengatrivi/REACTJS/catintassist/src/utils/connectEvidence.js#L71-L80) | Checks every 1s if CONNECT stalled after 6s to auto-rebuild. | `setSttLive(true)` is called at recorder start (~150ms). Line 80: `if (sttLive) return false;` aborts on every tick. | **100% disabled.** The 6s CONNECT self-heal never executes. |
| **4** | **Reused Tab Audio Track & Video-Only Listener** | [`connectEvidence.js:41-52`](file:///C:/zengatrivi/REACTJS/catintassist/src/utils/connectEvidence.js#L41-L52)<br>[`useDeepgram.js:2608-2612`](file:///C:/zengatrivi/REACTJS/catintassist/src/hooks/useDeepgram.js#L2608-L2612) | `isReusableStream` checks `stream.active` & tracks. | Chrome background tabs deliver zero-amplitude PCM while remaining `live` & `unmuted`. Tab listener only binds `videoTracks[0].onended`, ignoring audio track death. | **~25%** of fails: app streams digital silence into live sockets. |
| **5** | **Edge Concurrency Slot Collision** | [`useDeepgram.js:1097-1124`](file:///C:/zengatrivi/REACTJS/catintassist/src/hooks/useDeepgram.js#L1097-L1124)<br>[`useDeepgram.js:1930-1936`](file:///C:/zengatrivi/REACTJS/catintassist/src/hooks/useDeepgram.js#L1930-L1936) | Closes warm pair, waits 400ms (`SOCKET_REOPEN_GAP_MS`), opens new pair. | Deepgram edge proxy takes 800–2000ms to free concurrency slots. Dual sockets (EN+ES) exceed project cap. Deepgram accepts HTTP 101 but silently drops ASR pipeline. | **~45%** of fails: Deepgram edge proxy silent throttling. |
| **6** | **The Missed v4.203.0 Fix** | [`useDeepgram.js:2181-2197`](file:///C:/zengatrivi/REACTJS/catintassist/src/hooks/useDeepgram.js#L2181-L2197) | v4.203.0 checks `__catCarriedAudio` in `startRecorderOnSockets`. | **CONNECT never calls `startRecorderOnSockets`!** CONNECT calls `startRecording()` -> `startDeepgram()`. The fix only protected idle-ear wake. | **~30%** of fails: WebM header / carried socket mismatch was not fixed on CONNECT. |
| **7** | **12s Watchdog Suicide on Normal Call Silence** | [`dgStatus.js:152-175`](file:///C:/zengatrivi/REACTJS/catintassist/src/utils/dgStatus.js#L152-L175)<br>[`useDeepgram.js:1170-1221`](file:///C:/zengatrivi/REACTJS/catintassist/src/hooks/useDeepgram.js#L1170-L1221) | At 12s, `evaluateStall` runs `connectStallVerdict`. | Deepgram sends empty keepalives (`gotDgMessage = true`). If caller hasn't spoken loudly in first 12s, line 169 returns `'ok'`. Watchdog **exits permanently without rescheduling**. | System stays deaf forever when caller speaks at t = 13s+. |
| **8** | **Acoustic VAD Level Threshold Disconnect** | [`useDeepgram.js:820-848`](file:///C:/zengatrivi/REACTJS/catintassist/src/hooks/useDeepgram.js#L820-L848)<br>[`dgStatus.js:208-224`](file:///C:/zengatrivi/REACTJS/catintassist/src/utils/dgStatus.js#L208-L224) | `startCallVad` measures RMS energy against `IDLE_EAR_RMS_THRESHOLD` (0.02). | Tab audio is typically -24 to -30 dBFS (RMS ~0.008–0.015). It never crosses 0.02. `lastLoudAudioAtRef` stays 0; `speakingAgeMs` stays `Infinity`. Mid-call deaf monitor disabled. | Red stall banner never shows; auto-ZAP never triggers. |

---

## 3. The 3 Primary Failure Vectors

### Vector A: The Concurrency Slot Gap Trap (Why ZAP Works, CONNECT Fails)
- **CONNECT Path:** Warm sockets close, and only 400ms later `openSockets()` opens 2 new sockets. Deepgram's edge cluster is still processing the TCP close handshake for the old connections. When the new HTTP 101 handshake succeeds, backend ASR allocation is rejected or throttled. Sockets stay open but deaf.
- **ZAP Path:** The operator waits 5–8 seconds before clicking ZAP. Deepgram's backend has completely closed the previous session. When ZAP rebuilds, concurrency is 0. Deepgram assigns fresh workers immediately (95% success).

### Vector B: The 12-Second Watchdog Suicide Logic
- In `connectStallVerdict` (`dgStatus.js:168`), `if (gotDgMessage && !heardSpeech) return 'ok';`.
- Deepgram emits empty `{ type: "Results", alternatives: [{ transcript: "" }] }` every 2s, setting `gotDgMessage = true`.
- If the first 12 seconds are silent (ringing, greetings, or quiet caller under 0.02 RMS), `heardSpeech` is false.
- Verdict returns `'ok'`, and `evaluateStall` bails without re-arming. When the client speaks at second 13, the watchdog is gone.

### Vector C: The VAD Acoustic Sensitivity Floor
- `startCallVad` requires `rms >= 0.02` to update `lastLoudAudioAtRef`.
- Digital tab audio from intake platforms (Boostlingo, Cyracom, etc.) peaks at -24 dBFS to -32 dBFS (RMS ~0.008 to 0.016).
- Normal caller speech never crosses 0.02 RMS.
- `lastLoudAudioAtRef` stays 0. `speakingAgeMs` stays `Infinity`.
- Both the 12s watchdog and the mid-call deaf monitor remain blind to caller speech.

---

## 4. Remediation Plan

1. **Widen Socket Re-open Delay on CONNECT (`useDeepgram.js`):**
   - Increase `SOCKET_REOPEN_GAP_MS` from 400ms to **800ms** (or wait for explicit WebSocket `onclose` before opening new pair).
2. **Re-arm Watchdog Until First Real Word (`useDeepgram.js`):**
   - If `verdict === "ok"` but `transcriptReceived === false`, re-arm watchdog for another 8s window instead of exiting.
3. **Calibrate Tab Audio VAD Threshold (`useDeepgram.js`):**
   - For `source === "tab"`, lower VAD threshold to `0.006` so conversational tab speech updates `lastLoudAudioAtRef`.
4. **Fix `shouldHealConnect` Gate (`connectEvidence.js`):**
   - Gate on confirmed incoming words rather than `sttLive`.
5. **Always Fresh Sockets on CONNECT Click (`DashboardHeader.js`):**
   - When user clicks CONNECT, always force full fresh socket negotiation rather than routing to `onStartCall`.

---

## 5. Verified plan (2026-11-05, claims checked against code)

**Fact-check of §2** — the % figures add to >100 and are guesses.
| # | Verdict | Evidence |
|---|---|---|
| 1 | Harmless | `audioAttached` = `sttLive` = recorder running on open sockets. Nothing to rebuild. |
| 2 | UX only | STOP replaces CONNECT early; ZAP is the retry. Not a cause. |
| 3 | **TRUE gap** | heal gates on `sttLive`, which goes true when the recorder starts — before any word. |
| 4 | Unproven | silent-but-live tab track possible; needs RMS evidence (step 2). |
| 5 | Speculative | no proof Deepgram drops ASR on a 101 socket. Cheap hedge in step 4. |
| 6 | **FALSE** | `startDeepgram` closes BOTH sockets and opens a fresh pair (`useDeepgram.js:1118-1124`). No carried socket on CONNECT. |
| 7 | **TRUE bug** | `evaluateStall` returns on `'ok'` with no re-arm (`useDeepgram.js:1183`) → silent first 12 s = watchdog gone for the call. |
| 8 | Plausible | threshold 0.02 (`idleEar.js:8`); tab levels never measured. If true it also blinds #7 and the deaf banner. |

**Steps** (one release, one push):
1. **Watchdog lives until first word** (#7): `'ok'` without `transcriptReceived` → re-arm 8 s; stop only on first word or call end.
2. **Measure, then lower VAD** (#8/#4): log peak RMS per connect into `recordLastConnect`. Use adaptive floor (noise ×3, min 0.004) for tab/cable instead of fixed 0.02.
3. ~~**One healer, gated on words**~~ **DROPPED after step 1+2:** the watchdog now owns "live, no words, caller spoke" (re-checks every 8 s); `shouldHealConnect` owns "never went live". Gating it on words = 2nd rebuild at 6 s during a quiet ring, racing the watchdog. Original (#3): `shouldHealConnect` uses "first word received", not `sttLive`. Must not double-fire with step 1 (same attempt id).
4. **Reopen gap = wait for `onclose`** (#5 hedge): wait for old sockets' close event, cap 1.5 s, instead of fixed 400 ms.
5. **Connect record says WHICH vector**: `{rmsPeak, dgMsg, heardSpeech, words, healKind}` → `__CAT_CONNECTS()` shows the cause of each miss.

**Tests:** `connectStallVerdict` re-arm, `shouldHealConnect` word gate, adaptive VAD floor, close-wait cap. **Done =** after one shift, `__CAT_CONNECTS()` first-try dominates. Not before.

**Shipped:** step 1 v4.204.0 · step 2 v4.205.0 · step 3 dropped · step 4 v4.206.0 · step 5 v4.207.0. Next = one shift of `__CAT_CONNECTS()` data.
