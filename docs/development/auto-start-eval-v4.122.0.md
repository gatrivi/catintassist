# Auto-start eval — speech wakes call from off-call (v4.122.0)

Target: call starts <1s after intake speech so no crucial intake info is missed.
Verdict: **PASS on warm-socket path, normal volume. 3 intake-loss gaps remain (see §3).**

## 1. Chain (files:lines)

1. VAD: `src/utils/idleEar.js:8-17` — RMS≥0.02, 3×100ms frames = ~300ms speech → wake. Verified live: 500ms in the 5-frame sim (2 quiet + 3 loud).
2. Wake: `src/hooks/useDeepgram.js:1428-1445` — warm sockets open → resume recorder only (~ms). Sockets dead → cold `startRecording` rebuild (~0.5–2s).
3. Start: `useDeepgram.js:1123-1133` — first transcript with confidence>0.4 → `trySpeechAutoStart()` → capture gate opens **in the same onmessage**, same transcript commits. Zero words dropped after first transcript arrives.
4. Gate: `src/contexts/SessionContext.js:830-837` — requires speechAuto ON + callDetect ON + off-call + autopilot OFF.

## 2. Latency budget (warm path, the common case)

| Step | Cost |
|---|---|
| VAD 3 loud frames | ~300ms |
| Deepgram first transcript (interim, conf>0.4) | ~300–700ms typical |
| `startSession` + capture (sync in handler) | ~0ms |
| **Total onset → call active + first words kept** | **~0.5–1.0s** ✅ |

First-transcript-captures-itself (gate opens before the §1186 check on the same event) is why nothing is lost once STT delivers. Operator intro takes longer than this, so budget holds.

Tests green: `idleEar` + `callAutopilot` + `ringSignature` 17/17, `fixtureReplay` 5/5 (v4.122.0).

## 3. Intake-loss gaps (ranked)

1. **Quiet intake (RMS<0.02) never wakes.** Soft-spoken caller / far mic → VAD streak resets forever → total miss until louder speech. No fallback.
2. **Low-confidence opener (≤0.4) is dropped even when STT heard it.** Mumbled names, spelled numbers, heavy accent: transcript arrives but neither starts the call nor passes the capture gate (`useDeepgram.js:1123` + `:1186` return). Text existed, intake lost.
3. **Cold path exceeds budget.** Sockets died while idle → wake does full rebuild (socket open + recorder + first transcript ≈ 1–3s). Intake opener partially lost. Autopilot ON also suppresses any-speech start by design (only bridge phrases) — plain "hello, I need…" won't start it; plus 25s post-end cooldown blocks restarts.

## 4. Proposed fixes (not implemented — approve first)

- A. Pre-call buffer: keep sub-0.4 transcripts 10s, commit on start (fixes gap 2, cheap).
- B. Wake on any non-empty transcript for start purposes, keep 0.4 gate only for billing/activity (fixes gap 2).
- C. Adaptive VAD floor (room-noise calibrate; lower 0.02 → ~0.012) or 2-frame trigger (fixes gap 1, more false wakes).
- D. Idle socket health ping → proactively rebuild before speech arrives (fixes gap 3).
- E. Prod checklist: STOP → speak soft/normal/loud opener; kill sockets idle; autopilot ON vs OFF; measure onset→active with `sttTrace` timestamps.

## 5. Manual re-test (5 min, needs a call)

1. STOP → wait 10s → normal "hello, interpreter?" → expect call <1s, opener in bubble.
2. Same, whisper → expect miss (gap 1, confirm).
3. DevTools → close DG socket → wait → speak → time the cold start (gap 3).
