import { catLog, catWarn, catError } from "../utils/catLog";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "../contexts/SessionContext";
import {
  getEffectiveDeepgramKey,
  getDeepgramKeyInfo,
} from "../utils/deepgramRuntimeKey";
import { notifyDeepgramKeyNeeded } from "../utils/deepgramSettingsPrompt";
import {
  classifyDeepgramClose,
  buildFailureMessage,
  shouldRetryConnectClose,
  FAILURE,
} from "../utils/deepgramDiagnostics";
import {
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  readAudioSourceMode,
  resolveSttSource,
  buildVirtualCableFailureUiState,
  classifyTabCaptureError,
  isTabCaptureUserCancel,
} from "../utils/audioSourceManager";
import {
  acquireInputSource,
  mapLegacySourceToKind,
} from "../utils/inputSource";
import {
  loadLanguagePair,
  isEnEsProtectionMode,
  usesMultiSocket,
  laneSideForLang,
  LANG_PAIR_CHANGED_EVENT,
} from "../utils/languageConfig";
import {
  mergeCaptionsForUi,
  initEngineFromPersisted,
  shouldFlushImmediately,
  createCaptionEngineState,
  captionsSnapshotEqual,
} from "../utils/captionEngine";
import { applyDeepgramTranscriptPayload } from "../utils/applyDeepgramTranscriptPayload";
import {
  STT_LATENCY_CHANGED_EVENT,
  buildListenUrl,
  buildAudioOnlyStream,
  getInterimFlushMs,
  getInterimProcessThrottleMs,
  getMediaRecorderOptions,
  getMediaRecorderTimeslice,
  loadSttLatencyMode,
} from "../utils/deepgramListenConfig";
import { writeMicTestMode } from "../utils/micMode";
import {
  isReusableStream,
  shouldHealConnect,
  buildConnectSummary,
  recordLastConnect,
} from "../utils/connectEvidence";
import { traceCaptionArrayDiff } from "../utils/vanishTrace";
import { updateVadLoudFrames, shouldWakeFromVad, shouldSpeechAutoStart, IDLE_EAR_RMS_THRESHOLD } from "../utils/idleEar";
import { createUnthrottledInterval } from "../utils/workerInterval";
import {
  RING_TRIGGER_FRAMES,
  RING_LEARN_EVENT,
  RING_SIG_CHANGED_EVENT,
  extractPeakHz,
  buildRingSignature,
  matchRingSignature,
  loadRingSignature,
  saveRingSignature,
} from "../utils/ringSignature";
import {
  matchCallStartPhrase,
  matchCallEndPhrase,
  matchFarewellPhrase,
  loadAutopilotPhrases,
} from "../utils/callAutopilot";
import { matchHoldPhrase } from "../utils/holdPhrases";
import { isEnglishDoctorSentence } from "../utils/holdState";
import {
  connectStallVerdict,
  shouldAutoZap,
  CONNECT_STALL_MAX_RETRIES,
} from "../utils/dgStatus";
import { analyzeToneFrame, createToneTracker } from "../utils/toneWatch";
import {
  STT_EVENT_STATUS,
  addSttAudioChunk,
  beginSttSession,
  endSttSession,
  getActiveSttSessionId,
  readSttDiagnosticSettings,
  recordSttEvent,
  setSttAudioRecording,
  updateSttEvent,
} from "../utils/sttDiagnosticTrace";

const CAPTIONS_CLEARED_EVENT = "catint_captions_cleared";
const STT_TRACE_LIMIT = 300;

/** Opt-in per-chunk/per-message console spam. Buffer (`window.__catintSttTrace`) always runs. */
const STT_VERBOSE_KEY = "catint_stt_verbose";
export const isSttVerbose = () => {
  try {
    return localStorage.getItem(STT_VERBOSE_KEY) === "1";
  } catch {
    return false;
  }
};

const TAB_STREAM_READY_KEY = "catint_tab_stream_ok_v1";
const readTabStreamReady = () => {
  try {
    return sessionStorage.getItem(TAB_STREAM_READY_KEY) === "1";
  } catch {
    return false;
  }
};

const deepgramKeyRejectedMessage = () => {
  const { source, masked } = getDeepgramKeyInfo();
  if (source === "runtime") {
    return `Deepgram rejected your saved key (${masked}) — open Settings and check the key.`;
  }
  if (source === "env") {
    return `Deepgram rejected the .env key (${masked}) — fix .env and restart, or save key in Settings.`;
  }
  if (source === "legacy") {
    return `Deepgram rejected stored key (${masked}) — update in Settings.`;
  }
  return "Deepgram API key is missing or invalid — open Settings (gear) and paste your key.";
};

const MIC_DEVICE_KEY = "CATINTASSIST_MIC_ID";
// Work calls are browser audio. A failed Tab capture must fail closed.
const NEVER_AUTO_FALLBACK_TO_PHYSICAL_MIC = true;

const acquireAudioStreamForSource = async (source) => {
  const { stream } = await acquireInputSource(mapLegacySourceToKind(source));
  if (!stream) {
    throw new Error(`InputSource ${source} did not yield a MediaStream`);
  }
  return stream;
};

export const useDeepgram = () => {
  const {
    updateActivity,
    updateEnglishActivity,
    isCallDetectionEnabled,
    requestHoldIntent,
    clearHoldIntent,
    captions,
    updateCaptions,
    clearCaptions,
    isCaptionsLoaded,
    isActive,
    isZombieCall,
    isHold,
    hipaaGraceActiveRef,
    notifySpeechDuringCall,
    trySpeechAutoStart,
    tryAutopilotStart,
    requestAutopilotEnd,
    armAutopilotFarewell,
    callAutopilotRef,
    speechAutoConnect,
  } = useSession();

  const [connectionState, setConnectionState] = useState("disconnected");
  const [connectionMessage, setConnectionMessage] = useState("Disconnected");
  const [apiKeyRejected, setApiKeyRejected] = useState(false);
  const [connectProgress, setConnectProgress] = useState({
    phase: "idle",
    keyResolved: false,
    keySource: "none",
    keyMasked: "",
    audioStreamReady: false,
    socketsOpen: false,
    socketEn: "pending",
    socketEs: "pending",
    socketEnClose: "",
    socketEsClose: "",
    audioChunksSent: false,
    lastAudioChunkAt: 0,
    lastAudioChunkSize: 0,
    lastDeepgramMessageAt: 0,
    lastEmptyTranscriptAt: 0,
    emptyTranscriptStreak: 0,
    lastTranscriptStringAt: 0,
    lastCaptionCommitAt: 0,
    captureBlockedAt: 0,
    lastTranscriptText: "",
    lastTranscriptConfidence: null,
    lastWordConfidenceCount: 0,
    lastSocketEnMessageAt: 0,
    lastSocketEsMessageAt: 0,
    lastSocketEnConfidence: null,
    lastSocketEsConfidence: null,
    lastSocketEnHadText: false,
    lastSocketEsHadText: false,
    transcriptReceived: false,
    lastCloseCode: null,
    lastCloseReason: null,
    failureCategory: null,
    lastUpdatedAt: 0,
    lastError: null,
  });
  const [sttLanguage, setSttLanguage] = useState("auto");
  const [lastDataTime, setLastDataTime] = useState(0);
  // Work calls must always start on Tab STT. A past mic test may never hijack
  // the next call after refresh.
  const [micTestMode, setMicTestModeState] = useState(false);
  const [tabStreamReady, setTabStreamReady] = useState(readTabStreamReady);
  const [cableStreamReady, setCableStreamReady] = useState(false);
  const [attachedAudioSourceMode, setAttachedAudioSourceMode] = useState("tab"); // 'tab' | 'mic' | 'virtualCable'
  // v4.153.0: the ONE truth about "Deepgram is really running". True only when
  // the sockets are open AND a MediaRecorder is actually feeding them. The old
  // gate (connectionState === 'connected') lied: idle-ear sets 'connected' with
  // no recorder, so CONNECT went to start-the-call and never started audio.
  const [sttLive, setSttLiveState] = useState(false);
  const sttLiveRef = useRef(false);
  const setSttLive = useCallback((v) => {
    sttLiveRef.current = v;
    setSttLiveState(v);
  }, []);
  const [virtualCableFailure, setVirtualCableFailure] = useState(null); // { message, suggestedActionLabel }

  const langModeRef = useRef("auto");
  const languagePairRef = useRef(loadLanguagePair());
  const reconnectStreamRef = useRef(null);
  const micTestModeRef = useRef(false);
  const streamSourceRef = useRef(null); // 'mic' | 'tab'
  const socketRefEn = useRef(null);
  const socketRefEs = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
  const captionEngineRef = useRef(createCaptionEngineState());
  const interimFlushTimerRef = useRef(null);
  const lastInterimAtRef = useRef(0);
  const lastAudioProgressAtRef = useRef(0);
  // v4.148.0: fast stall recovery — Deepgram accepted the socket but never
  // sent a single message (not even startup Metadata). The old 12s watchdog
  // stood down once audio was sent, leaving a dead pipe 'connected' until the
  // 60s red chip + manual Zap (first minute of intake lost).
  const dgMessageSeenRef = useRef(false);
  const connectStallRetriesRef = useRef(0);
  // v4.149.0: outgoing-audio speech evidence — last time the stream was
  // actually LOUD locally (RMS). Separates a dead Deepgram pipe (Zap fixes)
  // from a silent mic/tab/headset route (Zap useless). Local-only analyser.
  const lastLoudAudioAtRef = useRef(0);
  const callVadCtxRef = useRef(null);
  const callVadIntervalRef = useRef(null);
  const stopCallVadRef = useRef(null);
  const lastDiagnosticAudioChunkAtRef = useRef(0);
  const sttLatencyModeRef = useRef(loadSttLatencyMode());
  const captionsHydratedRef = useRef(false);

  // After refresh there is no live MediaStream — clear stale tab-ready flag.
  useEffect(() => {
    if (!streamRef.current?.active) {
      setTabStreamReady(false);
      setCableStreamReady(false);
      setAttachedAudioSourceMode("tab");
      setVirtualCableFailure(null);
      try {
        sessionStorage.removeItem(TAB_STREAM_READY_KEY);
      } catch (_) {}
    }
  }, []);

  const shouldCaptureCaptionsRef = useRef(false);
  const didLogCaptureGateWhileNotActiveRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());
  const lastEnglishActivityPulseRef = useRef(0);
  const turnWordsBaseRef = useRef(0); // words already sealed in the current silence-to-silence turn
  const currentTurnIdRef = useRef(null);
  const bubbleIdCounterRef = useRef(0);
  const lastBubbleStartedRef = useRef(0);
  const overrideTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectAttemptIdRef = useRef(0);
  const watchdogTimeoutRef = useRef(null);
  const keepaliveIntervalRef = useRef(null);
  // ── IDLE EAR (v4.92.0): always-on speech detection between calls ──
  const idleEarActiveRef = useRef(false);
  const idleKeepAliveRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const vadCtxRef = useRef(null);
  const vadLoudFramesRef = useRef(0);
  // v4.136.0: closeConnections must tear the ear down too — stopIdleEar is
  // defined further down, so a ref bridges the order (same pattern as the
  // other *Ref bridges in this hook).
  const stopIdleEarRef = useRef(null);
  const startRecordingRef = useRef(null);
  const speechAutoConnectRef = useRef(speechAutoConnect);
  useEffect(() => { speechAutoConnectRef.current = speechAutoConnect; }, [speechAutoConnect]);
  const connectFailTimerRef = useRef(null);
  const connectFlagsRef = useRef({
    phase: "idle",
    keyResolved: false,
    keySource: "none",
    keyMasked: "",
    audioStreamReady: false,
    socketsOpen: false,
    socketEn: "pending",
    socketEs: "pending",
    socketEnClose: "",
    socketEsClose: "",
    audioChunksSent: false,
    lastAudioChunkAt: 0,
    lastAudioChunkSize: 0,
    lastDeepgramMessageAt: 0,
    lastEmptyTranscriptAt: 0,
    emptyTranscriptStreak: 0,
    lastTranscriptStringAt: 0,
    lastCaptionCommitAt: 0,
    captureBlockedAt: 0,
    lastTranscriptText: "",
    lastTranscriptConfidence: null,
    lastWordConfidenceCount: 0,
    lastSocketEnMessageAt: 0,
    lastSocketEsMessageAt: 0,
    lastSocketEnConfidence: null,
    lastSocketEsConfidence: null,
    lastSocketEnHadText: false,
    lastSocketEsHadText: false,
    transcriptReceived: false,
    lastCloseCode: null,
    lastCloseReason: null,
    failureCategory: null,
    lastUpdatedAt: 0,
    lastError: null,
  });

  const syncConnectProgress = (patch) => {
    connectFlagsRef.current = { ...connectFlagsRef.current, ...patch, lastUpdatedAt: Date.now() };
    setConnectProgress(connectFlagsRef.current);
  };

  // Critical-only console logs for outage hotfixing.
  // Ponytail: time gate prevents reconnect loops from flooding logs.
  const lastCritLogAtRef = useRef(0);
  const critLog = useCallback((level, message, extra = {}) => {
    try {
      const now = Date.now();
      // Connection failures must always leave one DevTools breadcrumb. Only
      // rate-limit info/warn chatter; no transcript or audio data is logged.
      if (level !== "error" && now - lastCritLogAtRef.current < 5000) return;
      lastCritLogAtRef.current = now;
      const phase = connectFlagsRef.current?.phase;
      const attemptId = connectAttemptIdRef.current;
      console[level](`[CAT STT CRIT] ${message}`, {
        phase,
        attemptId,
        isActive: isActiveRef.current,
        ...extra,
      });
    } catch (_) {}
  }, []);

  const sttTrace = useCallback((stage, data = {}) => {
    if (typeof window === "undefined") return;
    const entry = {
      at: new Date().toISOString(),
      ms: Math.round(performance.now()),
      stage,
      ...data,
    };
    const trace = (window.__catintSttTrace ??= []);
    trace.push(entry);
    if (trace.length > STT_TRACE_LIMIT) trace.splice(0, trace.length - STT_TRACE_LIMIT);
    // v4.91.0: console.info per audio chunk + per Results msg was a CPU sink
    // with DevTools open. Buffer always; print only when verbose opted in.
    if (isSttVerbose()) console.info(`[CAT STT] ${stage}`, entry);
  }, []);

  const patchKeyProgress = useCallback(() => {
    const keyInfo = getDeepgramKeyInfo();
    syncConnectProgress({
      keyResolved: !!keyInfo.key,
      keySource: keyInfo.source,
      keyMasked: keyInfo.masked,
    });
  }, []);

  const resetCaptionEngine = useCallback(() => {
    captionEngineRef.current = createCaptionEngineState();
    turnWordsBaseRef.current = 0;
    currentTurnIdRef.current = null;
    lastBubbleStartedRef.current = 0;
    if (interimFlushTimerRef.current) {
      clearTimeout(interimFlushTimerRef.current);
      interimFlushTimerRef.current = null;
    }
    captionsHydratedRef.current = false;
  }, []);

  const flushCaptionsToSession = useCallback(() => {
    const next = mergeCaptionsForUi(captionEngineRef.current);

    updateCaptions((prev) => {
      if (captionsSnapshotEqual(prev, next)) return prev;
      traceCaptionArrayDiff(prev, next, 'useDeepgram.flushCaptions');
      return next;
    });
  }, [updateCaptions]);

  const scheduleInterimFlush = useCallback(() => {
    if (interimFlushTimerRef.current) return;
    const flushMs = getInterimFlushMs(sttLatencyModeRef.current);
    interimFlushTimerRef.current = setTimeout(() => {
      interimFlushTimerRef.current = null;
      flushCaptionsToSession();
    }, flushMs);
  }, [flushCaptionsToSession]);

  // Hydrate engine once after IDB load — never re-sync on every flush (caused desync loops).
  useEffect(() => {
    if (!isCaptionsLoaded || captionsHydratedRef.current) return;
    if (captions.length === 0) return;
    captionsHydratedRef.current = true;
    captionEngineRef.current = initEngineFromPersisted(captions);
  }, [isCaptionsLoaded, captions]);

  useEffect(() => {
    const onCleared = () => resetCaptionEngine();
    window.addEventListener(CAPTIONS_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(CAPTIONS_CLEARED_EVENT, onCleared);
  }, [resetCaptionEngine]);

  const resetConnectProgress = useCallback(() => {
    didLogCaptureGateWhileNotActiveRef.current = false;
    const keyInfo = getDeepgramKeyInfo();
    syncConnectProgress({
      phase: "connecting",
      keyResolved: !!keyInfo.key,
      keySource: keyInfo.source,
      keyMasked: keyInfo.masked,
      audioStreamReady: false,
      socketsOpen: false,
      socketEn: "connecting",
      socketEs: "pending",
      socketEnClose: "",
      socketEsClose: "",
      audioChunksSent: false,
      lastAudioChunkAt: 0,
      lastAudioChunkSize: 0,
      lastDeepgramMessageAt: 0,
      lastEmptyTranscriptAt: 0,
      emptyTranscriptStreak: 0,
      lastTranscriptStringAt: 0,
      lastCaptionCommitAt: 0,
      captureBlockedAt: 0,
      lastTranscriptText: "",
      lastTranscriptConfidence: null,
      lastWordConfidenceCount: 0,
      lastSocketEnMessageAt: 0,
      lastSocketEsMessageAt: 0,
      lastSocketEnConfidence: null,
      lastSocketEsConfidence: null,
      lastSocketEnHadText: false,
      lastSocketEsHadText: false,
      transcriptReceived: false,
      lastCloseCode: null,
      lastCloseReason: null,
      failureCategory: null,
      lastError: null,
    });
  }, []);

  const hasSelectedMicDevice = () => {
    try {
      return !!localStorage.getItem(MIC_DEVICE_KEY);
    } catch {
      return false;
    }
  };

  const clearKeepalive = useCallback(() => {
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  }, []);

  const startKeepalive = useCallback(() => {
    clearKeepalive();
    keepaliveIntervalRef.current = setInterval(() => {
      if (connectFlagsRef.current.audioChunksSent) {
        clearKeepalive();
        return;
      }
      const payload = JSON.stringify({ type: "KeepAlive" });
      try {
        if (socketRefEn.current?.readyState === 1) socketRefEn.current.send(payload);
        if (socketRefEs.current?.readyState === 1) socketRefEs.current.send(payload);
      } catch (_) {}
    }, 4000);
  }, [clearKeepalive]);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    watchdogTimeoutRef.current = null;
  }, []);

  /** User cancelled tab picker — calm reset, not a Deepgram error. */
  const abortConnectAttempt = useCallback((message) => {
    isActiveRef.current = false;
    reconnectAttemptsRef.current = 0;
    clearWatchdog();
    clearKeepalive();
    if (connectFailTimerRef.current) {
      clearTimeout(connectFailTimerRef.current);
      connectFailTimerRef.current = null;
    }
    setConnectionState("disconnected");
    setConnectionMessage(message || "Tab share cancelled — press Connect when ready.");
    const keyInfo = getDeepgramKeyInfo();
    syncConnectProgress({
      phase: "idle",
      lastError: null,
      keyResolved: !!keyInfo.key,
      keySource: keyInfo.source,
      keyMasked: keyInfo.masked,
      audioStreamReady: false,
      socketsOpen: false,
      socketEn: "pending",
      socketEs: "pending",
    });
  }, [clearWatchdog, clearKeepalive]);

  // Only store transcript bubbles during an active or zombie-resumed call.
  // Armed sync before React paints (Connect auto-starts call) — beginStream can
  // receive Deepgram text before isActive state commits (v4.84.28).
  // v4.87.2: live refs for socket handlers. ws.onmessage closures are frozen at
  // connect time; reading state directly made speech auto-start re-fire
  // startSession on EVERY transcript (call timer reset to 0, spam events).
  const isActiveLiveRef = useRef(isActive);
  const isZombieCallLiveRef = useRef(isZombieCall);
  const isHoldLiveRef = useRef(isHold);
  useEffect(() => {
    isActiveLiveRef.current = isActive;
    isZombieCallLiveRef.current = isZombieCall;
    isHoldLiveRef.current = isHold;
    shouldCaptureCaptionsRef.current = !!(isActive || isZombieCall);
  }, [isActive, isZombieCall, isHold]);

  const armCaptionCapture = useCallback((on = true) => {
    shouldCaptureCaptionsRef.current = !!on;
  }, []);

  useEffect(() => {
    const onKeyChange = () => {
      const keyInfo = getDeepgramKeyInfo();
      syncConnectProgress({
        keyResolved: !!keyInfo.key,
        keySource: keyInfo.source,
        keyMasked: keyInfo.masked,
      });
      if (keyInfo.key) setApiKeyRejected(false);
    };
    window.addEventListener("cat_deepgram_runtime_key_changed", onKeyChange);
    patchKeyProgress();
    return () => window.removeEventListener("cat_deepgram_runtime_key_changed", onKeyChange);
  }, [patchKeyProgress]);

  // ── TONE WATCH (v4.98.0) — EXPERIMENTAL, LOG-ONLY ──────────────────────
  // While autopilot is armed, sample the preserved platform stream's FFT and
  // record narrow-band bursts (ring / end-bell candidates). Nothing acts on
  // this yet — Settings shows what it hears so thresholds can be tuned
  // against the real sounds first. Declared before closeConnections (deps).

  const toneMonitorRef = useRef(null);

  const stopToneMonitor = useCallback(() => {
    const m = toneMonitorRef.current;
    if (!m) return;
    toneMonitorRef.current = null;
    clearInterval(m.interval);
    try { m.ctx.close(); } catch (_) {}
    try { delete window.__catintTone; } catch (_) {}
  }, []);

  const ensureToneMonitor = useCallback((stream) => {
    if (!callAutopilotRef?.current) return;
    if (!stream?.active || stream.getAudioTracks().length === 0) return;
    if (toneMonitorRef.current) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      const srcNode = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser);
      const freqBuf = new Uint8Array(analyser.frequencyBinCount);
      const tracker = createToneTracker();
      window.__catintTone = tracker; // inspect: __catintTone.summary()
      const interval = setInterval(() => {
        try {
          analyser.getByteFrequencyData(freqBuf);
          tracker.push(analyzeToneFrame(freqBuf, ctx.sampleRate), Date.now());
        } catch (_) {}
      }, 200);
      toneMonitorRef.current = { ctx, interval };
      critLog("info", "tone watch: listening (log-only)", {});
    } catch (e) {
      critLog("warn", "tone watch unavailable", { err: String(e) });
    }
  }, [callAutopilotRef, critLog]);

  // ── v4.149.0: call-time outgoing-audio RMS ──────────────────────────────
  // "Is anyone audibly speaking into the pipe right now?" Worker-timed (a
  // hidden tab can't starve it) and local-only: no audio leaves the machine.
  const stopCallVad = useCallback(() => {
    if (callVadIntervalRef.current) {
      callVadIntervalRef.current();
      callVadIntervalRef.current = null;
    }
    if (callVadCtxRef.current) {
      try { callVadCtxRef.current.close(); } catch (_) {}
      callVadCtxRef.current = null;
    }
  }, []);
  stopCallVadRef.current = stopCallVad;

  const startCallVad = useCallback((stream) => {
    stopCallVad();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      callVadCtxRef.current = ctx;
      const srcNode = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        try {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          if (rms >= IDLE_EAR_RMS_THRESHOLD) lastLoudAudioAtRef.current = Date.now();
        } catch (_) {}
      };
      callVadIntervalRef.current = createUnthrottledInterval(tick, 250);
    } catch (e) {
      catWarn(`[callVAD] unavailable: ${String(e)}`);
    }
  }, [stopCallVad]);

  const closeConnections = useCallback(() => {
    // v4.136.0: closing sockets must also close the idle ear. A Zap used to
    // leave VAD + idle KeepAlive running into whatever sockets open next —
    // the ear could then wake and build a SECOND recorder mid-reconnect.
    try {
      stopIdleEarRef.current?.();
    } catch (_) {}
    try {
      stopCallVadRef.current?.();
    } catch (_) {}
    stopToneMonitor();
    clearKeepalive();
    if (connectFailTimerRef.current) {
      clearTimeout(connectFailTimerRef.current);
      connectFailTimerRef.current = null;
    }
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn("Failed to stop recorder:", e);
    }
    mediaRecorderRef.current = null;
    setSttAudioRecording(false);
    setSttLive(false); // v4.153.0: sockets are gone — nothing is live.

    if (socketRefEn.current) {
      socketRefEn.current.close();
      socketRefEn.current = null;
    }
    if (socketRefEs.current) {
      socketRefEs.current.close();
      socketRefEs.current = null;
    }
    setConnectionState("disconnected");
    setConnectionMessage("Disconnected");
    setApiKeyRejected(false);
    const keyInfo = getDeepgramKeyInfo();
    syncConnectProgress({
      phase: "idle",
      keyResolved: !!keyInfo.key,
      keySource: keyInfo.source,
      keyMasked: keyInfo.masked,
      audioStreamReady: false,
      socketsOpen: false,
      socketEn: "pending",
      socketEs: "pending",
      socketEnClose: "",
      socketEsClose: "",
      audioChunksSent: false,
      lastAudioChunkAt: 0,
      transcriptReceived: false,
      lastCloseCode: null,
      lastCloseReason: null,
      failureCategory: null,
      lastError: null,
    });
  }, [clearKeepalive, stopToneMonitor, setSttLive]);

  const isLikelyApiKeyRejected = useCallback((text) => {
    const s = (text || "").toString().toLowerCase();
    // Deepgram typically returns auth-ish errors mentioning token/key.
    return (
      s.includes("unauthorized") ||
      s.includes("forbidden") ||
      (s.includes("missing") && s.includes("token")) ||
      (s.includes("invalid") && s.includes("token")) ||
      (s.includes("api key") &&
        (s.includes("reject") ||
          s.includes("invalid") ||
          s.includes("missing")))
    );
  }, []);

  const failConnection = useCallback(
    (message, extra = {}) => {
      catError("[Deepgram:connect] CONNECTION FAILED", { message, ...extra });
      critLog("warn", "failConnection", {
        message,
        failureCategory: extra?.failureCategory,
        lastCloseCode: extra?.lastCloseCode,
        lastCloseReason: extra?.lastCloseReason,
        socketEnClose: extra?.socketEnClose,
        socketEsClose: extra?.socketEsClose,
      });
      isActiveRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearWatchdog();
      clearKeepalive();
      if (connectFailTimerRef.current) {
        clearTimeout(connectFailTimerRef.current);
        connectFailTimerRef.current = null;
      }
      try {
        if (overrideTimeoutRef.current) clearTimeout(overrideTimeoutRef.current);
      } catch {}

      try {
        if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop();
      } catch (_) {}
      mediaRecorderRef.current = null;
      try {
        socketRefEn.current?.close();
      } catch (_) {}
      try {
        socketRefEs.current?.close();
      } catch (_) {}
      socketRefEn.current = null;
      socketRefEs.current = null;
      setSttLive(false); // v4.153.0: rebuilding — not live until audio flows.

      setConnectionState("error");
      setConnectionMessage(message);
      const keyInfo = getDeepgramKeyInfo();
      const cat = extra.failureCategory;
      critLog("error", "connection failed", {
        category: cat || FAILURE.UNKNOWN,
        message: String(message || "").slice(0, 220),
        closeCode: extra.lastCloseCode ?? null,
        source: streamSourceRef.current || "none",
      });
      syncConnectProgress({
        phase: "error",
        lastError: message,
        keyResolved: cat === FAILURE.AUTH ? false : !!keyInfo.key,
        keySource: keyInfo.source,
        keyMasked: keyInfo.masked,
        ...extra,
      });
      if (cat === FAILURE.AUTH || isLikelyApiKeyRejected(message)) setApiKeyRejected(true);
    },
    [clearWatchdog, clearKeepalive, isLikelyApiKeyRejected, critLog, setSttLive],
  );

  const scheduleConnectFail = useCallback(
    (lang, code, reason, socketSide = "En") => {
      if (connectFailTimerRef.current) return;
      connectFailTimerRef.current = setTimeout(() => {
        connectFailTimerRef.current = null;
        if (connectFlagsRef.current.phase !== "connecting") return;
        const keyInfo = getDeepgramKeyInfo();
        const diag = classifyDeepgramClose(code, reason);


        const msg = buildFailureMessage({
          category: diag.category || FAILURE.UNKNOWN,
          hint: diag.hint,
          keySource: keyInfo.source,
          keyMasked: keyInfo.masked,
          socketLang: lang,
        });
        failConnection(msg, {
          failureCategory: diag.category || FAILURE.UNKNOWN,
          lastCloseCode: code,
          lastCloseReason: reason,
          [`socket${socketSide}`]: "error",
          [`socket${socketSide}Close`]: `${code}${reason ? `: ${reason}` : ""}`,
        });
      }, 120);
    },
    [failConnection],
  );

  const stopStreamTracks = useCallback(() => {
    try {
      const s = streamRef.current;
      if (!s) return;
      s.getTracks?.().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
    } catch (_) {}
    streamRef.current = null;
    streamSourceRef.current = null;
    setTabStreamReady(false);
    setCableStreamReady(false);
    setAttachedAudioSourceMode("tab");
    try {
      sessionStorage.setItem(TAB_STREAM_READY_KEY, "0");
    } catch {}
  }, []);

  const setMicTestMode = useCallback(
    (enabled) => {
      const on = !!enabled;
      micTestModeRef.current = on;
      setMicTestModeState(on);
      writeMicTestMode(on);
      // Drop cached stream if source type would change on next connect.
      if (
        streamRef.current &&
        streamSourceRef.current !== (on ? "mic" : "tab")
      ) {
        stopStreamTracks();
      }
    },
    [stopStreamTracks],
  );

  // A saved mic flag wins during source selection. Keep the three route
  // choices exclusive so Tab/VB cannot silently reconnect the microphone.
  useEffect(() => {
    const onAudioSourceModeChanged = (event) => {
      const mode = event?.detail?.mode;
      if (
        (mode === "tab" || mode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE) &&
        micTestModeRef.current
      ) {
        setMicTestMode(false);
      }
    };
    window.addEventListener("catint_audio_source_mode_changed", onAudioSourceModeChanged);
    return () => window.removeEventListener("catint_audio_source_mode_changed", onAudioSourceModeChanged);
  }, [setMicTestMode]);

  const startDeepgram = useCallback(
    (stream) => {
      const API_KEY = getEffectiveDeepgramKey();
      if (!API_KEY) {
        catError("[Deepgram:key] API KEY MISSING");
        critLog("error", "credential unavailable", {
          reason: "browser_key_missing",
          source: streamSourceRef.current || "none",
        });
        setConnectionState("error");
        const msg =
          "Deepgram API key is missing. Open Settings (gear) → Deepgram, or set REACT_APP_DEEPGRAM_API_KEY on Vercel and redeploy.";
        setConnectionMessage(msg);
        notifyDeepgramKeyNeeded("connect");
        syncConnectProgress({
          phase: "error",
          lastError: msg,
          failureCategory: FAILURE.AUTH,
          keyResolved: false,
        });
        return;
      }
      const diagnosticSettings = readSttDiagnosticSettings();
      if ((diagnosticSettings.traceEnabled || diagnosticSettings.audioRingEnabled) && !getActiveSttSessionId()) {
        beginSttSession();
      }
      setSttAudioRecording(false);
      lastDiagnosticAudioChunkAtRef.current = 0;

      // ponytail: tear down stale sockets/recorder before opening new ones (reuse-stream path).
      clearKeepalive();
      try {
        if (mediaRecorderRef.current?.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (_) {}
      mediaRecorderRef.current = null;
      try {
        socketRefEn.current?.close();
      } catch (_) {}
      try {
        socketRefEs.current?.close();
      } catch (_) {}
      socketRefEn.current = null;
      socketRefEs.current = null;
      setSttLive(false); // v4.153.0: nothing is live until the recorder runs.

      setConnectionState("connecting");
      setConnectionMessage("Initializing Sockets...");

      const pair = languagePairRef.current;
      const multiMode = usesMultiSocket(pair);
      const protectionsOn = isEnEsProtectionMode(pair);
      catLog("[Deepgram:start] STARTING", {
        source: streamSourceRef.current,
        pair,
        multiMode,
        latencyMode: sttLatencyModeRef.current,
        audioTracks: stream?.getAudioTracks?.().length,
      });

      const tryStartStreaming = (stream) => {
        const socketsReady = multiMode
          ? socketRefEn.current?.readyState === 1
          : socketRefEn.current?.readyState === 1 &&
            socketRefEs.current?.readyState === 1;
        if (!socketsReady) return;
        syncConnectProgress({
          socketsOpen: true,
          socketEn: "open",
          socketEs: multiMode ? "skipped" : "open",
          phase: "connecting",
          // v4.136.0: seed the DG-message clock with a fresh epoch at every
          // connect — after a Zap, stall is measured from NOW, never from the
          // pre-stall transcript (the old stale age kept the chip red).
          lastDeepgramMessageAt: Date.now(),
        });
        // v4.148.0: fresh "has Deepgram answered at all?" probe per attempt.
        dgMessageSeenRef.current = false;
        startKeepalive();
        const attemptId = connectAttemptIdRef.current;
        clearWatchdog();
        watchdogTimeoutRef.current = setTimeout(() => {
          if (connectAttemptIdRef.current !== attemptId) return;
          const flags = connectFlagsRef.current;
          const verdict = connectStallVerdict({
            audioChunksSent: flags.audioChunksSent,
            transcriptReceived: flags.transcriptReceived,
            gotDgMessage: dgMessageSeenRef.current,
            retriesLeft: CONNECT_STALL_MAX_RETRIES - connectStallRetriesRef.current,
          });
          if (verdict === "ok") return;
          if (verdict === "stall-reconnect") {
            // Audio IS flowing but Deepgram never answered — dead pipe.
            // Rebuild sockets NOW instead of aging to the 60s red chip.
            connectStallRetriesRef.current += 1;
            setConnectionMessage("Deepgram not responding — reconnecting…");
            catWarn(
              `[Deepgram:stall] audio sent, zero Deepgram messages — auto reconnect (try ${connectStallRetriesRef.current}/${CONNECT_STALL_MAX_RETRIES})`,
            );
            reconnectStreamRef.current?.();
            return;
          }
          failConnection(
            verdict === "fail-silent"
              ? "TIMEOUT: Deepgram never responded to audio. Check network/VPN, then press CONNECT."
              : "TIMEOUT: Sockets open but no audio reached Deepgram. Check Share audio on tab, unmute call, or try mic mode.",
            { failureCategory: FAILURE.TIMEOUT },
          );
        }, 12000);

        setConnectionState("connected");
        setConnectionMessage("Live");
        // v4.149.0: start watching outgoing loudness for speech evidence.
        startCallVad(stream);
        try {
          const needsRecorder =
            !mediaRecorderRef.current ||
            mediaRecorderRef.current.state === "inactive";
          if (needsRecorder) {
            if (mediaRecorderRef.current) {
              try {
                mediaRecorderRef.current.stop();
              } catch (_) {}
              mediaRecorderRef.current = null;
            }
            const audioStream = buildAudioOnlyStream(stream);
            if (!audioStream) {
              failConnection(
                "No audio track on stream — enable Share audio on tab or try mic mode.",
                { failureCategory: FAILURE.AUDIO },
              );
              return;
            }
            const audioTrack = audioStream.getAudioTracks()[0];
            const mrOpts = getMediaRecorderOptions();
            mediaRecorderRef.current = mrOpts
              ? new MediaRecorder(audioStream, mrOpts)
              : new MediaRecorder(audioStream);
            mediaRecorderRef.current.addEventListener("dataavailable", (e) => {
              if (e.data.size > 0) {
                const audioNow = Date.now();
                if (readSttDiagnosticSettings().audioRingEnabled) {
                  const previousChunkAt = lastDiagnosticAudioChunkAtRef.current;
                  const durationMs = previousChunkAt
                    ? Math.min(2000, Math.max(50, audioNow - previousChunkAt))
                    : getMediaRecorderTimeslice(sttLatencyModeRef.current);
                  lastDiagnosticAudioChunkAtRef.current = audioNow;
                  setSttAudioRecording(true);
                  const diagnosticSessionId = getActiveSttSessionId();
                  e.data.arrayBuffer().then((buffer) => {
                    if (diagnosticSessionId === getActiveSttSessionId()) {
                      addSttAudioChunk(buffer, {
                        durationMs,
                        mimeType: e.data.type || mediaRecorderRef.current?.mimeType || "audio/webm",
                        wallClockMs: audioNow,
                      });
                    }
                  }).catch(() => {});
                }
                let sentAny = false;
                const lanes = [];
                if (socketRefEn.current?.readyState === 1) {
                  sentAny = true;
                  lanes.push("En");
                  socketRefEn.current.send(e.data);
                }
                if (!multiMode && socketRefEs.current?.readyState === 1) {
                  sentAny = true;
                  lanes.push("Es");
                  socketRefEs.current.send(e.data);
                }
                const firstAudioChunk = sentAny && !connectFlagsRef.current.audioChunksSent;
                if (sentAny) {
                  if (
                    firstAudioChunk ||
                    audioNow - lastAudioProgressAtRef.current > 500
                  ) {
                    lastAudioProgressAtRef.current = audioNow;
                    sttTrace("1 sound received + 2 sound sent", {
                      bytes: e.data.size,
                      type: e.data.type,
                      mimeType: mediaRecorderRef.current?.mimeType || null,
                      lanes,
                      firstAudioChunk,
                      trackMuted: audioTrack?.muted,
                      trackEnabled: audioTrack?.enabled,
                      trackReadyState: audioTrack?.readyState,
                    });
                    syncConnectProgress({
                      audioChunksSent: true,
                      lastAudioChunkAt: audioNow,
                      lastAudioChunkSize: e.data.size,
                    });
                  }
                }
                if (firstAudioChunk) {
                  if (audioTrack?.muted || !audioTrack?.enabled) {
                    critLog("warn", "audio track muted/disabled — DG may return empty", {
                      muted: audioTrack?.muted,
                      enabled: audioTrack?.enabled,
                      readyState: audioTrack?.readyState,
                    });
                  }
                  clearKeepalive();
                  clearWatchdog();
                }
              }
            });
            mediaRecorderRef.current.start(
              getMediaRecorderTimeslice(sttLatencyModeRef.current),
            );
            // v4.153.0: sockets open + recorder running = the ONE truth that
            // Deepgram is really transcribing. This is what CONNECT gates on.
            setSttLive(true);
            recordLastConnect(
              buildConnectSummary({
                source: streamSourceRef.current || "none",
                ok: true,
                reason: "recorder streaming",
                socketEn: "open",
                socketEs: multiMode ? "skipped" : "open",
                audioChunksSent: true,
              }),
            );

          }
        } catch (err) {
          console.error(err);
          failConnection(`MediaRecorder failed: ${err.message}`, {
            failureCategory: FAILURE.AUDIO,
          });
        }
      };

      // ── v4.103.2 CONNECT auto-retry ─────────────────────────────────────
      // A transient DG failure during the initial CONNECT (1006 handshake
      // drop, network blip) used to hard-fail the attempt and cost a manual
      // ZAP — crucial seconds on a live call. Quick socket re-opens (3 max)
      // fix it silently; auth/quota closes still fail fast (retry is futile).
      const myAttemptId = connectAttemptIdRef.current;
      const CONNECT_MAX_RETRIES = 3;
      let connectRetries = 0;
      let retryPending = false;
      let openStallTimer = null;
      const clearOpenStall = () => {
        if (openStallTimer) {
          clearTimeout(openStallTimer);
          openStallTimer = null;
        }
      };
      /** Handshake hang: sockets never opened (covers En-open/Es-hang too). */
      const armOpenStall = () => {
        clearOpenStall();
        openStallTimer = setTimeout(() => {
          openStallTimer = null;
          if (connectAttemptIdRef.current !== myAttemptId) return;
          if (connectFlagsRef.current.phase !== "connecting") return;
          const socketsReady = multiMode
            ? socketRefEn.current?.readyState === 1
            : socketRefEn.current?.readyState === 1 &&
              socketRefEs.current?.readyState === 1;
          if (socketsReady) return; // open-but-silent → 12s audio watchdog owns it
          if (!retryOpenSockets("socket-open-stall", 0)) {
            failConnection(
              "TIMEOUT: Deepgram did not open after retries. Check network/VPN, then press ZAP.",
              { failureCategory: FAILURE.TIMEOUT },
            );
          }
        }, 8000);
      };
      /** Re-open sockets after a connecting-phase failure. Returns true if a
       * retry is scheduled; false when out of budget (caller should fail). */
      const retryOpenSockets = (why, delayMs) => {
        if (retryPending || connectRetries >= CONNECT_MAX_RETRIES) return false;
        retryPending = true;
        connectRetries += 1;
        syncConnectProgress({ connectRetries, lastRetryReason: why });
        critLog("warn", "connect auto-retry", { why, attempt: connectRetries, delayMs });
        setConnectionMessage(
          `Deepgram hiccup — retrying (${connectRetries}/${CONNECT_MAX_RETRIES})...`,
        );
        setTimeout(() => {
          retryPending = false;
          if (connectAttemptIdRef.current !== myAttemptId) return;
          if (connectFlagsRef.current.phase !== "connecting") return;
          try { socketRefEn.current?.close(); } catch (_) {}
          try { socketRefEs.current?.close(); } catch (_) {}
          socketRefEn.current = null;
          socketRefEs.current = null;
          clearOpenStall();
          socketRefEn.current = createSocket(
            multiMode ? "multi" : pair.left,
            stream,
            { socketSide: "En", isFirst: !multiMode },
          );
          // v4.153.0: a retry must rebuild BOTH sockets. Re-opening only EN
          // left the ES lane dead, so the both-open gate never fired.
          if (!multiMode) {
            syncConnectProgress({ socketEs: "connecting" });
            socketRefEs.current = createSocket(pair.right, stream, {
              socketSide: "Es",
              isFirst: false,
            });
          }
          armOpenStall();
        }, delayMs);
        return true;
      };

      const createSocket = (lang, stream, { socketSide = "En", isFirst = false } = {}) => {
        const url = buildListenUrl(lang, sttLatencyModeRef.current);
        catLog("[Deepgram:open] OPENING SOCKET", { lang, socketSide, url });
        const ws = new WebSocket(url, ["token", API_KEY]);
        const sk = socketSide === "En" ? "socketEn" : "socketEs";
        const skClose = socketSide === "En" ? "socketEnClose" : "socketEsClose";

        ws.onopen = () => {
          catLog("[Deepgram:open] SOCKET OPEN", { lang, socketSide });
          reconnectAttemptsRef.current = 0;
          syncConnectProgress({ [sk]: "open" });
          critLog("info", `socket open (${lang}/${socketSide})`, {
            multiMode,
            latencyMode: sttLatencyModeRef.current,
          });
          // v4.153.0: ES is NOT chained off EN's onopen any more. A single
          // hung socket used to leave us with "no recorder, no audio, no
          // error" until the 8s stall timer. Both sockets now open in parallel
          // (bottom of startDeepgram) and tryStartStreaming waits for both.
          tryStartStreaming(stream);
        };

        ws.onmessage = (message) => {
          // v4.148.0: ANY traffic (Metadata, empty Results, …) proves the pipe
          // is alive — arm the probe and give the stall budget back.
          if (!dgMessageSeenRef.current) {
            dgMessageSeenRef.current = true;
            connectStallRetriesRef.current = 0;
          }
          let received;
          try {
            received = JSON.parse(message.data);
          } catch (_) {
            return;
          }
          const dgMessageAt = Date.now();
          const socketMsgPatch = socketSide === "En"
            ? { lastSocketEnMessageAt: dgMessageAt }
            : { lastSocketEsMessageAt: dgMessageAt };
          const receivedAlt = received.channel?.alternatives?.[0];
          const receivedTranscript = receivedAlt?.transcript;
          const diagnosticEvent = recordSttEvent({
            text: receivedTranscript || "",
            wallClockMs: dgMessageAt,
            providerStart: received.start ?? null,
            providerDuration: received.duration ?? null,
            lane: lang,
            socket: socketSide,
            confidence: receivedAlt?.confidence ?? null,
            final: !!received.is_final,
            metadata: {
              messageType: received.type || "transcript",
              speechFinal: !!received.speech_final,
              wordCount: receivedAlt?.words?.length || 0,
            },
          });
          sttTrace("3 Deepgram websocket message received", {
            diagnosticEventId: diagnosticEvent?.id || null,
            lang,
            type: received?.type || "transcript",
            isFinal: !!received?.is_final,
            speechFinal: !!received?.speech_final,
          });
          syncConnectProgress({ lastDeepgramMessageAt: dgMessageAt, ...socketMsgPatch });
          const errType = (received?.type || "").toString().toLowerCase();
          if (errType === "error" || received?.error) {
            updateSttEvent(diagnosticEvent?.id, { status: STT_EVENT_STATUS.BLOCKED });
            const errText =
              received?.error?.message ||
              received?.error?.code ||
              received?.description ||
              JSON.stringify(received?.error || received);
            if (isLikelyApiKeyRejected(errText)) {
              catError("[Deepgram:key] API KEY REJECTED", received);
              const msg = deepgramKeyRejectedMessage();
              failConnection(msg, {
                failureCategory: FAILURE.AUTH,
                [sk]: "error",
              });
              return;
            }
          }
          const alt = receivedAlt;
          const transcript = alt?.transcript;
          const socketConfidencePatch = socketSide === "En"
            ? {
                lastSocketEnConfidence: alt?.confidence ?? 0,
                lastSocketEnHadText: Boolean(transcript?.trim()),
              }
            : {
                lastSocketEsConfidence: alt?.confidence ?? 0,
                lastSocketEsHadText: Boolean(transcript?.trim()),
              };
          if (!transcript || transcript.trim().length === 0) {
            updateSttEvent(diagnosticEvent?.id, { status: STT_EVENT_STATUS.EMPTY });
            syncConnectProgress({
              ...socketConfidencePatch,
              lastEmptyTranscriptAt: dgMessageAt,
              emptyTranscriptStreak: (connectFlagsRef.current.emptyTranscriptStreak || 0) + 1,
            });
            // Empty interim Results are normal DG keepalive — only log finals to reduce noise.
            if (received.is_final || received.speech_final) {
              sttTrace("4 Deepgram processed empty transcript", {
                lang,
                confidence: alt?.confidence ?? null,
                words: alt?.words?.length || 0,
                isFinal: !!received.is_final,
                speechFinal: !!received.speech_final,
              });
            }
            return;
          }

          // CPU triage counters for the STT caption hot path. Expose via `window.__ciaPerf`.
          const perf =
            typeof window !== "undefined"
              ? (window.__ciaPerf ??= {
                  deepgramMessages: 0,
                  captionMs: 0,
                  captionSlow: 0,
                })
              : null;
          if (perf) perf.deepgramMessages += 1;

          const confidence = alt?.confidence || 0;
          const isFinal = received.is_final;
          const speechFinal = received.speech_final;
          const wordConfidenceCount = (alt?.words || []).filter((w) => Number.isFinite(w?.confidence)).length;
          updateSttEvent(diagnosticEvent?.id, { status: STT_EVENT_STATUS.PROCESSED });
          sttTrace("4 Deepgram processed + 5 returned string", {
            diagnosticEventId: diagnosticEvent?.id || null,
            lang,
            chars: transcript.length,
            text: transcript.slice(0, 160),
            confidence,
            wordConfidenceCount,
            isFinal: !!isFinal,
            speechFinal: !!speechFinal,
          });

          const socketLaneLang =
            lang === "multi"
              ? received.channel?.detected_language ||
                alt?.languages?.[0] ||
                pair.left
              : lang;
          const laneSide = laneSideForLang(socketLaneLang, pair);

          // v4.87.2: live refs — this closure may predate the auto-start it
          // triggers, so state reads here are stale by one call.
          // v4.123.0 fix B: ANY audible transcript starts the call — a mumbled
          // low-confidence opener is still intake. Confidence >0.4 stays the
          // gate for billing/activity signals only.
          if (isActiveLiveRef.current) {
            if (confidence > 0.4) notifySpeechDuringCall();
          } else if (
            shouldSpeechAutoStart({
              transcript,
              isActive: isActiveLiveRef.current,
              isZombie: isZombieCallLiveRef.current,
            })
          ) {
            if (trySpeechAutoStart()) {
              shouldCaptureCaptionsRef.current = true;
              if (confidence > 0.4) notifySpeechDuringCall();
            }
          }

          if (!connectFlagsRef.current.transcriptReceived) {
            syncConnectProgress({ transcriptReceived: true, phase: "ready" });
          }
          syncConnectProgress({
            lastTranscriptStringAt: Date.now(),
            emptyTranscriptStreak: 0,
            lastTranscriptText: transcript.slice(0, 120),
            lastTranscriptConfidence: confidence,
            lastWordConfidenceCount: wordConfidenceCount,
            ...socketConfidencePatch,
          });

          // v4.125.0: hold-phrase matcher (EN+ES, STT-tolerant). Computed once,
          // used twice: arming the intent below, and guarding the silence
          // clock above so hold music can't break hold.
          const holdPhrase = matchHoldPhrase(transcript);
          // v4.136.0: the health clock ticks on ANY non-empty transcript. The
          // old confidence>0.4 gate froze it during mumbled stretches, so the
          // status chip aged to DG STUCK while text still flowed to the board.
          // Confidence>0.4 stays the gate for activity/billing signals only.
          setLastDataTime(Date.now());
          if (isCallDetectionEnabled && confidence > 0.4) {
            // Hold music/announcements heard WHILE holding are more of the
            // same hold — not the provider returning. Only the silence clock
            // is shielded so auto-resume can't fire on music.
            if (!(isHoldLiveRef.current && holdPhrase)) {
              updateActivity();
            }
          }

          if (holdPhrase) {
            requestHoldIntent();
          } else if (
            isCallDetectionEnabled &&
            confidence > 0.4 &&
            // v4.150.0: only a FULL English sentence proves "the doctor is
            // back". Spanish / background chatter must not disarm hold intent
            // — that was why auto-hold never armed while nurses talked.
            isEnglishDoctorSentence(socketLaneLang, transcript)
          ) {
            clearHoldIntent();
          }

          // v4.98.0: call autopilot — the platform's own announcements drive
          // the session. Runs BEFORE the capture gate so phrases land between
          // calls too (idle ear wakes on the announcement's speech energy).
          const lowTrans = transcript.toLowerCase();
          if (matchCallStartPhrase(lowTrans, loadAutopilotPhrases())) {
            if (tryAutopilotStart()) {
              shouldCaptureCaptionsRef.current = true;
              notifySpeechDuringCall();
            }
          } else if (isFinal || speechFinal) {
            const phrases = loadAutopilotPhrases();
            if (matchCallEndPhrase(lowTrans, phrases)) {
              requestAutopilotEnd();
            } else if (matchFarewellPhrase(lowTrans, phrases)) {
              // v4.146.0: human farewell ("have a good day") arms the
              // silence-gated auto-end — 120s of no speech → the same 10s
              // cancellable banner. Any speech in the window cancels it.
              armAutopilotFarewell();
            }
          }

          const now = Date.now();
          const timeSinceLast = now - lastTranscriptTimeRef.current;
          lastTranscriptTimeRef.current = now;
          const isSilentBreak = timeSinceLast > 2500;

          if (!shouldCaptureCaptionsRef.current) {
            updateSttEvent(diagnosticEvent?.id, { status: STT_EVENT_STATUS.BLOCKED });
            if (!didLogCaptureGateWhileNotActiveRef.current && typeof window !== "undefined") {
              didLogCaptureGateWhileNotActiveRef.current = true;
              sttTrace("blocked before render: capture gate off", {
                isActive,
                isZombieCall,
                text: transcript.slice(0, 120),
              });
              if (isActive || isZombieCall) {
                syncConnectProgress({ captureBlockedAt: Date.now() });
              }
            }
            return;
          }

          // Throttle interim transcript processing: final/speech-final always processed.
          const isFinalish = !!isFinal || !!speechFinal;
          if (!isFinalish) {
            const nowPerf = performance.now();
            const interimGate = getInterimProcessThrottleMs(sttLatencyModeRef.current);
            if (nowPerf - lastInterimAtRef.current < interimGate) {
              updateSttEvent(diagnosticEvent?.id, { status: STT_EVENT_STATUS.THROTTLED });
              return;
            }
            lastInterimAtRef.current = nowPerf;
          }

          const t0 = performance.now();
          const applied = applyDeepgramTranscriptPayload({
            engineState: captionEngineRef.current,
            payload: received,
            lane: lang,
            ctxMeta: {
              pair,
              langMode: langModeRef.current,
              protectionsOn,
              now,
              isSilentBreak,
              laneSide,
              channelKey: lang,
              turnWordsBaseRef,
              currentTurnIdRef,
              bubbleIdCounterRef,
              lastBubbleStartedRef,
            },
          });
          if (!applied) return;
          captionEngineRef.current = applied.nextEngineState;
          const newArr = applied.nextRows;
          const appliedLastRow = newArr[newArr.length - 1];
          if (diagnosticEvent?.id && appliedLastRow) appliedLastRow.sttEventId = diagnosticEvent.id;
          updateSttEvent(diagnosticEvent?.id, {
            status: STT_EVENT_STATUS.COMMITTED,
            metadata: {
              captionId: appliedLastRow?.id || null,
              rowCount: newArr.length,
              protectionMode: protectionsOn ? "on" : "off",
            },
          });
          const dt = performance.now() - t0;
          sttTrace("6 caption engine committed", {
            diagnosticEventId: diagnosticEvent?.id || null,
            ms: Number(dt.toFixed(2)),
            rows: newArr.length,
            lastRowId: applied.debug?.lastRowId || null,
            wordConfidenceCount,
          });
          syncConnectProgress({ lastCaptionCommitAt: Date.now() });
          if (perf) {
            perf.captionMs += dt;
            if (dt > 8 && process.env.NODE_ENV !== "production") {
              perf.captionSlow += 1;
              console.warn("[captionEngine slow]", {
                ms: dt.toFixed(2),
                transcriptLength: transcript.length,
                isFinal,
              });
            }
          }

          if (shouldFlushImmediately(isFinal, speechFinal)) {
            if (interimFlushTimerRef.current) {
              clearTimeout(interimFlushTimerRef.current);
              interimFlushTimerRef.current = null;
            }
            flushCaptionsToSession();
          } else {
            scheduleInterimFlush();
          }

          // v4.150.0: the English clock ticks ONLY on a full English sentence
          // from this message's own lane (socketLaneLang, not lastRow.lang —
          // the last row may belong to the ES lane). Interims lack terminal
          // punctuation and fail the gate, so fragments/background chatter
          // never look like the doctor is back. Feeds hold auto-resume and
          // the header "non-doctor hold" micro-bar.
          if (
            isCallDetectionEnabled &&
            confidence > 0.4 &&
            isEnglishDoctorSentence(socketLaneLang, transcript) &&
            now - lastEnglishActivityPulseRef.current > 500
          ) {
            updateEnglishActivity();
            lastEnglishActivityPulseRef.current = now;
          }
        };

        ws.onclose = (event) => {
          // v4.103.2: stale sockets (torn down by a retry/teardown) must not
          // trigger retries or failures — only the CURRENT socket speaks.
          if (ws !== socketRefEn.current && ws !== socketRefEs.current) return;
          const code = event?.code;
          const reason = event?.reason || "";
          catError("[Deepgram:close] SOCKET CLOSED", { lang, socketSide, code, reason });
          syncConnectProgress({
            [sk]: "error",
            [skClose]: `${code}${reason ? `: ${reason}` : ""}`,
            lastCloseCode: code,
            lastCloseReason: reason,
          });

          if (code !== 1000) {
            critLog("warn", `socket close (${lang}/${socketSide})`, {
              code,
              reason: (reason || "").slice(0, 140),
            });
          }

          if (connectFlagsRef.current.phase === "connecting") {
            // v4.103.2: auto-retry transient closes before hard-failing.
            if (code !== 1000 && !retryPending) {
              if (
                !shouldRetryConnectClose(code, reason) ||
                !retryOpenSockets(`close-${code}`, 600 * (connectRetries + 1))
              ) {
                scheduleConnectFail(lang, code, reason, socketSide);
              }
            }
            return;
          }

          if (isActiveRef.current && reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++;
            const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
            critLog("info", "auto reconnect scheduled", {
              reconnectAttempts: reconnectAttemptsRef.current,
              delayMs: delay,
              socketSide,
            });
            const livePair = languagePairRef.current;
            const liveMulti = usesMultiSocket(livePair);
            setTimeout(() => {
              if (!isActiveRef.current) return;
              if (socketSide === "En") {
                socketRefEn.current = createSocket(
                  liveMulti ? "multi" : livePair.left,
                  streamRef.current,
                  { socketSide: "En", isFirst: !liveMulti },
                );
              } else {
                socketRefEs.current = createSocket(
                  livePair.right,
                  streamRef.current,
                  { socketSide: "Es", isFirst: false },
                );
              }
            }, delay);
          }
        };

        ws.onerror = (event) => {
          catError("[Deepgram:err] WEBSOCKET ERROR", { lang, socketSide, event });
          if (connectFlagsRef.current.phase === "ready") return;
          if (connectFlagsRef.current.phase !== "connecting") return;
          syncConnectProgress({ [sk]: "error" });
          catWarn(`[Deepgram:err] ${lang} WebSocket error (awaiting close code…)`);
          critLog("error", `socket error (${lang}/${socketSide})`);
        };
        return ws;
      };

      const firstLang = multiMode ? "multi" : pair.left;
      socketRefEn.current = createSocket(firstLang, stream, {
        socketSide: "En",
        isFirst: true,
      });
      if (!multiMode) {
        // v4.153.0: parallel ES open (see the note in ws.onopen).
        syncConnectProgress({ socketEs: "connecting" });
        socketRefEs.current = createSocket(pair.right, stream, {
          socketSide: "Es",
          isFirst: false,
        });
      }
      armOpenStall(); // v4.103.2: hang = sockets never open → auto-retry
    },
    [
      isCallDetectionEnabled,
      updateActivity,
      flushCaptionsToSession,
      scheduleInterimFlush,
      updateEnglishActivity,
      requestHoldIntent,
      clearHoldIntent,
      notifySpeechDuringCall,
      trySpeechAutoStart,
      speechAutoConnect,
      isActive,
      isZombieCall,
      failConnection,
      scheduleConnectFail,
      startKeepalive,
      clearWatchdog,
      clearKeepalive,
      isLikelyApiKeyRejected,
      sttTrace,
      critLog,
      startCallVad,
      setSttLive,
    ],
  );

  // ── IDLE EAR ENGINE (v4.92.0) ───────────────────────────────────────────
  // After STOP: sockets stay OPEN (KeepAlive pings only — zero audio sent to
  // Deepgram = zero usage) and a local VAD watches the preserved stream.
  // Speech → resume recorder → transcript → trySpeechAutoStart starts the
  // call by itself. First attach still needs one CONNECT press (browser rule).

  /** Tear down VAD + idle keepalive. Refs hold stop-fns (worker-backed). */
  const stopIdleEar = useCallback(() => {
    idleEarActiveRef.current = false;
    if (vadIntervalRef.current) { vadIntervalRef.current(); vadIntervalRef.current = null; }
    if (idleKeepAliveRef.current) { idleKeepAliveRef.current(); idleKeepAliveRef.current = null; }
    try { vadCtxRef.current?.close(); } catch (_) {}
    vadCtxRef.current = null;
  }, []);
  stopIdleEarRef.current = stopIdleEar;

  /** Rebuild just the MediaRecorder and stream into the already-open sockets. */
  const startRecorderOnSockets = useCallback((stream) => {
    try {
      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
        mediaRecorderRef.current = null;
      }
      const audioStream = buildAudioOnlyStream(stream);
      if (!audioStream) return false;
      const multiMode = usesMultiSocket(languagePairRef.current);
      const mrOpts = getMediaRecorderOptions();
      mediaRecorderRef.current = mrOpts
        ? new MediaRecorder(audioStream, mrOpts)
        : new MediaRecorder(audioStream);
      mediaRecorderRef.current.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) {
          const audioNow = Date.now();
          if (readSttDiagnosticSettings().audioRingEnabled) {
            const previousChunkAt = lastDiagnosticAudioChunkAtRef.current;
            const durationMs = previousChunkAt
              ? Math.min(2000, Math.max(50, audioNow - previousChunkAt))
              : getMediaRecorderTimeslice(sttLatencyModeRef.current);
            lastDiagnosticAudioChunkAtRef.current = audioNow;
            setSttAudioRecording(true);
            const diagnosticSessionId = getActiveSttSessionId();
            e.data.arrayBuffer().then((buffer) => {
              if (diagnosticSessionId === getActiveSttSessionId()) {
                addSttAudioChunk(buffer, {
                  durationMs,
                  mimeType: e.data.type || mediaRecorderRef.current?.mimeType || "audio/webm",
                  wallClockMs: audioNow,
                });
              }
            }).catch(() => {});
          }
          try {
            if (socketRefEn.current?.readyState === 1) socketRefEn.current.send(e.data);
            if (!multiMode && socketRefEs.current?.readyState === 1) socketRefEs.current.send(e.data);
          } catch (_) {}
          lastAudioProgressAtRef.current = audioNow;
          syncConnectProgress({ audioChunksSent: true, lastAudioChunkAt: Date.now() });
        }
      });
      mediaRecorderRef.current.start(getMediaRecorderTimeslice(sttLatencyModeRef.current));
      return true;
    } catch (err) {
      console.error("[IdleEar] recorder resume failed:", err);
      return false;
    }
  }, [syncConnectProgress]);

  /** VAD heard speech → resume audio into warm sockets (or full reconnect). */
  const wakeFromIdleEar = useCallback(() => {
    if (!idleEarActiveRef.current) return;
    stopIdleEar();
    const stream = streamRef.current;
    const multiMode = usesMultiSocket(languagePairRef.current);
    const enOpen = socketRefEn.current?.readyState === 1;
    const esOk = multiMode || socketRefEs.current?.readyState === 1;
    if (stream?.active && stream.getAudioTracks().length > 0 && enOpen && esOk) {
      if (startRecorderOnSockets(stream)) {
        setConnectionState("connected");
        setSttLive(true); // v4.153.0: audio is flowing again.
        setConnectionMessage("Speech detected — reconnecting…");
        sttTrace("idle ear wake: warm recorder resume");
        return;
      }
    }
    // Cold path: sockets died while idle — full rebuild from the preserved
    // stream (reuse path, no tab picker, no user gesture needed).
    // v4.136.0: the wake is now visible and logged. If the rebuild then fails
    // (e.g. the share died in a background tab and the picker needs a
    // gesture), the user still knows speech WAS heard and CONNECT is the fix.
    sttTrace("idle ear wake: cold rebuild");
    setSttLive(false);
    setConnectionMessage("Speech detected — press CONNECT if text doesn't resume");
    startRecordingRef.current?.();
  }, [stopIdleEar, startRecorderOnSockets, setSttLive]);

  const wakeFromIdleEarRef = useRef(wakeFromIdleEar);
  wakeFromIdleEarRef.current = wakeFromIdleEar;

  /** Enter idle-ear from stopRecording. Returns false → full disconnect. */
  const enterIdleEar = useCallback(() => {
    // v4.98.0: autopilot also needs the ear open between calls (it listens
    // for the bridge/disconnect phrases, which arrive as transcripts).
    if (!speechAutoConnectRef.current && !callAutopilotRef.current) return false;
    const stream = streamRef.current;
    if (!stream?.active || stream.getAudioTracks().length === 0) return false;
    ensureToneMonitor(stream);

    // Stop ONLY the recorder — sockets stay open, no audio leaves the machine.
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (_) {}
    mediaRecorderRef.current = null;
    setSttAudioRecording(false);
    idleEarActiveRef.current = true;
    setConnectionState("connected");
    // v4.153.0: warm sockets + NO recorder = not live. Without this, CONNECT
    // saw "connected" and started a call that could never transcribe.
    setSttLive(false);
    setConnectionMessage("Idle ear — listening for speech (auto-connect on)");
    syncConnectProgress({
      phase: "ready",
      audioStreamReady: true,
      socketsOpen: true,
      socketEn: "open",
      socketEs: usesMultiSocket(languagePairRef.current) ? "skipped" : "open",
      audioChunksSent: false,
    });

    // Deepgram closes a socket after ~10s without audio — KeepAlive every 4s.
    // v4.136.0: worker-backed interval. A hidden tab throttles page timers to
    // ~1/min, which starved the KeepAlive (socket died) AND the VAD (ear
    // went deaf) — the main "fails to detect speech" cause.
    idleKeepAliveRef.current = createUnthrottledInterval(() => {
      const multiMode = usesMultiSocket(languagePairRef.current);
      const payload = JSON.stringify({ type: "KeepAlive" });
      const enOpen = socketRefEn.current?.readyState === 1;
      const esOpen = multiMode || socketRefEs.current?.readyState === 1;
      try {
        if (enOpen) socketRefEn.current.send(payload);
        if (!multiMode && socketRefEs.current?.readyState === 1) socketRefEs.current.send(payload);
      } catch (_) {}
      if (!enOpen && !esOpen) {
        // Sockets died while idle — clean up; VAD wake will rebuild from stream.
        stopIdleEar();
        closeConnections();
      }
    }, 4000);

    // Local VAD (WebAudio RMS) — speech energy never leaves the machine.
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      vadCtxRef.current = ctx;
      const srcNode = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      vadLoudFramesRef.current = 0;
      const vadTick = () => {
        if (!idleEarActiveRef.current) return;
        try {
          // v4.136.0 self-checks: a suspended AudioContext yields silence
          // forever, and a dead track makes the ear deaf — surface both
          // instead of silently never firing.
          if (ctx.state === "suspended") {
            ctx.resume?.();
            setConnectionMessage("Idle ear — audio blocked, click the app once");
            return;
          }
          const liveTrack = stream.getAudioTracks()[0];
          if (!liveTrack || liveTrack.readyState !== "live") {
            critLog("warn", "idle ear: audio track ended — closing ear");
            stopIdleEar();
            closeConnections();
            setConnectionMessage("Ear lost — audio share ended. Press CONNECT.");
            return;
          }
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          vadLoudFramesRef.current = updateVadLoudFrames({ rms, prevLoudFrames: vadLoudFramesRef.current });
          if (shouldWakeFromVad(vadLoudFramesRef.current)) wakeFromIdleEarRef.current();
        } catch (_) {}
      };
      vadIntervalRef.current = createUnthrottledInterval(vadTick, 100);
    } catch (e) {
      critLog("warn", "idle ear VAD unavailable", { err: String(e) });
    }
    return true;
  }, [speechAutoConnectRef, callAutopilotRef, ensureToneMonitor, stopIdleEar, syncConnectProgress, closeConnections, critLog, setSttLive]);
  // ────────────────────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    // v4.92.0: idle ear — between calls keep Deepgram sockets warm (KeepAlive
    // only, NO audio sent = no tokens) and listen locally for speech to
    // auto-start the next call. Falls back to full disconnect when idle-ear
    // is off or the stream is gone. Stream tracks stay preserved either way.
    isActiveRef.current = false;
    turnWordsBaseRef.current = 0;
    currentTurnIdRef.current = null;
    endSttSession();
    if (!enterIdleEar()) {
      closeConnections();
    }
    // v4.133.0 SAFETY (ER incident 2026-09-19): this used to call
    // resetCaptionEngine() + clearCaptions(). It runs on stream-end, stuck
    // audio and guard stops — i.e. BEFORE SessionContext seals the last-call
    // archive — so the transcript was wiped with nothing to recover.
    // Stopping audio must never destroy text: SessionContext.stopSession seals
    // first (and HIPAA grace decides when to actually clear).
  }, [enterIdleEar, closeConnections]);

  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  const bindStreamLifecycle = useCallback((stream, source) => {
    streamSourceRef.current = source;
    const onStreamEnded = () => {
      // Safe-switch guard: only stop the active Deepgram pipeline
      // if the ended tracks belong to the current MediaStream.
      if (streamRef.current !== stream) return;
      streamRef.current = null;
      streamSourceRef.current = null;
      stopToneMonitor();
      stopRecordingRef.current();
    };
    if (source === "tab") {
      const vt = stream.getVideoTracks()[0];
      if (vt) vt.onended = onStreamEnded;
      return;
    }
    stream.getAudioTracks().forEach((track) => {
      track.onended = onStreamEnded;
    });
  }, [stopToneMonitor]);

  const beginStream = useCallback(
    (stream, source) => {
      // v4.148.0: a brand-new session (fresh stream acquired) starts with a
      // full stall-retry budget. Deliberately NOT reset in startRecording /
      // resetConnectProgress — reconnectStream reaches those, and a reset
      // there would turn the 3-try budget into a 12s Zap loop.
      connectStallRetriesRef.current = 0;
      const audioTrackCount = stream.getAudioTracks().length;

      const audioTracks = stream.getAudioTracks();
      // v4.153.0: a track that is present but already ended is NOT audio.
      // Opening sockets onto it produced "connected" + zero sound, forever.
      const deadTrack = audioTracks.find((t) => t.readyState && t.readyState !== "live");
      if (audioTrackCount === 0 || deadTrack) {
        const msg = deadTrack
          ? "The audio share ended before Deepgram could start. Press CONNECT and share the tab again."
          : "No audio track was detected. Make sure your selected tab or microphone includes audio, then press Connect again.";
        critLog("error", "beginStream: no usable audio track", { source, deadTrack: !!deadTrack });
        setConnectionState("error");
        setConnectionMessage(msg);
        syncConnectProgress({ phase: "error", lastError: msg });
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
        return false;
      }
      streamRef.current = stream;
      isActiveRef.current = true;
      ensureToneMonitor(stream); // v4.98.0: log-only ring/bell listener (autopilot)
      setAttachedAudioSourceMode(source);
      bindStreamLifecycle(stream, source);
      syncConnectProgress({ audioStreamReady: true, phase: "connecting" });
      startDeepgram(stream);
      // Source-specific “audio attached” flags (used by UI).
      if (source === "tab") {
        setTabStreamReady(true);
        setCableStreamReady(false);
        try {
          sessionStorage.setItem(TAB_STREAM_READY_KEY, "1");
        } catch {}
      } else if (source === "virtualCable") {
        setTabStreamReady(false);
        setCableStreamReady(true);
      } else {
        // Physical mic: keep this legacy behavior.
        setTabStreamReady(false);
        setCableStreamReady(false);
      }
      setVirtualCableFailure(null);
      return true;
    },
    [bindStreamLifecycle, startDeepgram, critLog, ensureToneMonitor],
  );

  const startRecording = useCallback(async () => {
    try {
      connectAttemptIdRef.current += 1;
      resetConnectProgress();
      clearWatchdog();
      setConnectionState("connecting");
      // Mic mode wins over persisted VB-Cable — UI 🎤 must match STT path.
      // v4.151.1: ONE resolver decides the route for every connect attempt.
      // Mic mode must win here (v4.84 regression: it did not, so CONNECT
      // opened a tab picker / VB and Deepgram never started).
      const source = resolveSttSource({
        micTestMode: micTestModeRef.current,
        audioSourceMode: readAudioSourceMode(),
      });
      const useMic = source === "mic";


      // REUSE EXISTING STREAM IF AVAILABLE AND ACTIVE (same source type)
      // v4.153.0: the old check trusted `active && tracks>0`. A stream can be
      // alive and silent (share ended, all tracks muted) — reusing it opened
      // sockets to nothing, which is how "I pressed CONNECT and got no text"
      // used to happen silently. isReusableStream is now the only judge.
      const reusable = isReusableStream(streamRef.current, source, streamSourceRef.current);
      if (reusable.ok) {
        setConnectionMessage(
          source === "virtualCable"
            ? "Reusing Virtual Cable..."
            : useMic
              ? "Reusing Microphone..."
              : "Reusing Tab Audio...",
        );
        isActiveRef.current = true;
        setAttachedAudioSourceMode(source);
        if (source === "virtualCable") {
          setTabStreamReady(false);
          setCableStreamReady(true);
        } else if (source === "tab") {
          setCableStreamReady(false);
          setTabStreamReady(true);
          try {
            sessionStorage.setItem(TAB_STREAM_READY_KEY, "1");
          } catch {}
        } else {
          // Mic: neither tab nor cable attached (audioAttached reads micTestMode).
          setTabStreamReady(false);
          setCableStreamReady(false);
        }
        startDeepgram(streamRef.current);
        return true;
      }
      if (streamRef.current) {
        // v4.153.0: log + drop the dead stream so nothing can reuse it again.
        critLog("warn", "stale stream discarded", {
          why: reusable.why,
          wanted: source,
          had: streamSourceRef.current,
        });
        streamRef.current = null;
        streamSourceRef.current = null;
      }

      setConnectionMessage(
        source === "virtualCable"
          ? "Requesting Virtual Cable..."
          : useMic
            ? "Requesting Microphone..."
            : "Requesting Tab Audio...",
      );
      const stream = await acquireAudioStreamForSource(source);
      const ok = beginStream(stream, source);
      if (!NEVER_AUTO_FALLBACK_TO_PHYSICAL_MIC && !ok && source === "tab" && !micTestModeRef.current && hasSelectedMicDevice()) {
        // Tab capture didn't yield usable audio — switch to mic mode so `audioAttached` can unblock STT.
        setConnectionState("connecting");
        setConnectionMessage("No tab audio detected — falling back to microphone...");
        resetConnectProgress();
        clearWatchdog();
        setMicTestMode(true);
        const micStream = await acquireAudioStreamForSource("mic");
        return beginStream(micStream, "mic");
      }
      return ok;
    } catch (err) {
      console.error(err);
      const attemptedSource = resolveSttSource({
        micTestMode: micTestModeRef.current,
        audioSourceMode: readAudioSourceMode(),
      });

      if (attemptedSource === "tab") {
        const tabErr = classifyTabCaptureError(err);
        // v4.153.0: every failed tab connect leaves a one-step way out. A dead
        // end mid-call is how you end up with NO transcription and no idea.
        const withExit = (m) => `${m} — no tab? press M (mic) then CONNECT.`;
        if (isTabCaptureUserCancel(err)) {
          const msg = withExit(tabErr.message);
          // Clean the attempt up (timers, isActive) then SHOW the state — the
          // old path reset to "disconnected", which rendered nothing at all.
          abortConnectAttempt(msg);
          setConnectionState("error");
          critLog("warn", "tab capture cancelled by user", { source: attemptedSource });
          recordLastConnect(
            buildConnectSummary({ source: attemptedSource, ok: false, reason: msg }),
          );
          return false;
        }
        if (!NEVER_AUTO_FALLBACK_TO_PHYSICAL_MIC && tabErr.suggestMicFallback) {
          try {
            setConnectionState("connecting");
            setConnectionMessage("Tab capture unavailable — trying microphone...");
            resetConnectProgress();
            clearWatchdog();
            setMicTestMode(true);
            const micStream = await acquireAudioStreamForSource("mic");
            const ok = beginStream(micStream, "mic");
            return ok;
          } catch (_) {
            // Fall through to tab-specific message below.
          }
        }
        const tabMsg = withExit(tabErr.message);
        setConnectionState("error");
        setConnectionMessage(tabMsg);
        syncConnectProgress({ phase: "error", lastError: tabMsg });
        recordLastConnect(
          buildConnectSummary({
            source: attemptedSource,
            ok: false,
            reason: tabMsg,
            closeCode: err?.name || null,
          }),
        );
        return false;
      }

      if (attemptedSource === "virtualCable") {
        const ui = buildVirtualCableFailureUiState(err);
        setVirtualCableFailure(ui);
        setConnectionState("error");
        setConnectionMessage(ui.message);
        syncConnectProgress({ phase: "error", lastError: ui.message });
        return false;
      }

      const msg = attemptedSource === "mic"
        ? "Microphone capture failed. Allow mic access in the browser, then press CONNECT."
        : classifyTabCaptureError(err).message;
      setConnectionState("error");
      setConnectionMessage(msg);
      syncConnectProgress({ phase: "error", lastError: msg });
      return false;
    }
  }, [beginStream, startDeepgram, clearWatchdog, setMicTestMode, resetConnectProgress, abortConnectAttempt]);

  startRecordingRef.current = startRecording; // idle-ear wake path (v4.92.0)

  // Force re-open picker (tab) or re-request mic (double-tap connect).
  const startRecordingFresh = useCallback(async () => {
    try {
      connectAttemptIdRef.current += 1;
      clearWatchdog();
      // v4.151.1: ONE resolver decides the route for every connect attempt.
      // Mic mode must win here (v4.84 regression: it did not, so CONNECT
      // opened a tab picker / VB and Deepgram never started).
      const source = resolveSttSource({
        micTestMode: micTestModeRef.current,
        audioSourceMode: readAudioSourceMode(),
      });
      const useMic = source === "mic";
      closeConnections();
      stopStreamTracks();
      resetConnectProgress();
      setConnectionState("connecting");
      setConnectionMessage(
        useMic
          ? "Requesting Microphone (fresh)..."
          : source === "virtualCable"
            ? "Requesting Virtual Cable (fresh)..."
            : "Requesting Tab Audio (fresh)...",
      );
      if (source === "tab") {
        // Force "tab needs reconnect" UX until we successfully reacquire a stream.
        setTabStreamReady(false);
        try {
          sessionStorage.setItem(TAB_STREAM_READY_KEY, "0");
        } catch {}
      } else if (source === "virtualCable") {
        setCableStreamReady(false);
      }

      setConnectionMessage(
        source === "virtualCable"
          ? "Requesting Virtual Cable..."
          : useMic
            ? "Requesting Microphone..."
            : "Requesting Tab Audio...",
      );
      const stream = await acquireAudioStreamForSource(source);
      const ok = beginStream(stream, source);
      if (!NEVER_AUTO_FALLBACK_TO_PHYSICAL_MIC && !ok && source === "tab" && !micTestModeRef.current && hasSelectedMicDevice()) {
        // Tab capture didn't yield usable audio — switch to mic mode so `audioAttached` can unblock STT.
        setConnectionState("connecting");
        setConnectionMessage("No tab audio detected — falling back to microphone...");
        resetConnectProgress();
        clearWatchdog();
        setMicTestMode(true);
        const micStream = await acquireAudioStreamForSource("mic");
        return beginStream(micStream, "mic");
      }
      return ok;
    } catch (err) {
      console.error(err);
      const attemptedSource = resolveSttSource({
        micTestMode: micTestModeRef.current,
        audioSourceMode: readAudioSourceMode(),
      });

      if (attemptedSource === "tab") {
        const tabErr = classifyTabCaptureError(err);
        // v4.153.0: every failed tab connect leaves a one-step way out. A dead
        // end mid-call is how you end up with NO transcription and no idea.
        const withExit = (m) => `${m} — no tab? press M (mic) then CONNECT.`;
        if (isTabCaptureUserCancel(err)) {
          const msg = withExit(tabErr.message);
          // Clean the attempt up (timers, isActive) then SHOW the state — the
          // old path reset to "disconnected", which rendered nothing at all.
          abortConnectAttempt(msg);
          setConnectionState("error");
          critLog("warn", "tab capture cancelled by user", { source: attemptedSource });
          recordLastConnect(
            buildConnectSummary({ source: attemptedSource, ok: false, reason: msg }),
          );
          return false;
        }
        if (!NEVER_AUTO_FALLBACK_TO_PHYSICAL_MIC && tabErr.suggestMicFallback) {
          try {
            setConnectionState("connecting");
            setConnectionMessage("Tab capture unavailable — trying microphone...");
            resetConnectProgress();
            clearWatchdog();
            setMicTestMode(true);
            const micStream = await acquireAudioStreamForSource("mic");
            const ok = beginStream(micStream, "mic");
            return ok;
          } catch (_) {
            // Fall through to tab-specific message below.
          }
        }
        const tabMsg = withExit(tabErr.message);
        setConnectionState("error");
        setConnectionMessage(tabMsg);
        syncConnectProgress({ phase: "error", lastError: tabMsg });
        recordLastConnect(
          buildConnectSummary({
            source: attemptedSource,
            ok: false,
            reason: tabMsg,
            closeCode: err?.name || null,
          }),
        );
        return false;
      }
      if (attemptedSource === "virtualCable") {
        const ui = buildVirtualCableFailureUiState(err);
        setVirtualCableFailure(ui);
        setConnectionState("error");
        setConnectionMessage(ui.message);
        syncConnectProgress({ phase: "error", lastError: ui.message });
        return false;
      }

      const msg = attemptedSource === "mic"
        ? "Microphone capture failed. Allow mic access in the browser, then press CONNECT."
        : classifyTabCaptureError(err).message;
      setConnectionState("error");
      setConnectionMessage(msg);
      syncConnectProgress({ phase: "error", lastError: msg });
      return false;
    }
  }, [beginStream, closeConnections, stopStreamTracks, clearWatchdog, setMicTestMode, resetConnectProgress, abortConnectAttempt]);

  /**
   * Safe in-call audio source switching:
   * - Acquire the NEW stream first.
   * - Only if acquisition succeeds do we swap deepgram sockets/MediaRecorder.
   * - If virtual cable fails, the old working stream keeps running.
   *
   * This avoids the “stop audio first, then fail” transcript loss risk.
   */
  const switchAudioSourceModeSafely = useCallback(
    async (requestedMode) => {
      const targetSource =
        requestedMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE
          ? "virtualCable"
          : "tab";

      const oldStream = streamRef.current;
      const oldSource = streamSourceRef.current;

      if (oldStream?.active && oldSource === targetSource) return true;

      // Clear warning only if we’re trying another route.
      if (targetSource !== "virtualCable") setVirtualCableFailure(null);

      let newStream;
      try {
        newStream = await acquireAudioStreamForSource(targetSource);
      } catch (err) {
        if (targetSource === "virtualCable") {
          setVirtualCableFailure(buildVirtualCableFailureUiState(err));
        }
        return false;
      }

      // Validate audio tracks exist before swapping deepgram.
      const audioTrackCount = newStream.getAudioTracks?.().length ?? 0;
      if (audioTrackCount === 0) {
        try {
          newStream.getTracks?.().forEach((t) => t.stop());
        } catch (_) {}
        if (targetSource === "virtualCable") {
          setVirtualCableFailure(
            buildVirtualCableFailureUiState(new Error("No audio tracks detected")),
          );
        }
        return false;
      }

      // Swap: close old deepgram pipeline and start the new one.
      // Then stop the old MediaStream tracks after the new pipeline is running.
      closeConnections();
      const ok = beginStream(newStream, targetSource);
      if (!ok) return false;

      try {
        oldStream?.getTracks?.().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      } catch (_) {}

      return true;
    },
    [beginStream, closeConnections],
  );

  const reconnectStream = useCallback(() => {
    critLog("warn", "manual reconnectStream()");
    connectAttemptIdRef.current += 1;
    clearWatchdog();
    reconnectAttemptsRef.current = 0; // Reset manual attempts
    closeConnections();
    resetConnectProgress();
    setConnectionState("connecting");
    setConnectionMessage("Reconnecting to Deepgram...");
    // v4.136.0: the text clock restarts with the connection — the chip must
    // never keep ageing a pre-Zap transcript once the new sockets are live.
    setLastDataTime(Date.now());
    setTimeout(() => {
      if (streamRef.current && isActiveRef.current)
        startDeepgram(streamRef.current);
      else {
        // If stream is dead, we need a full restart
        startRecording();
      }
    }, 400);
  }, [closeConnections, startDeepgram, startRecording, clearWatchdog, resetConnectProgress, critLog]);

  const toggleLanguage = useCallback(() => {
    setSttLanguage((prev) => {
      const next = prev === "auto" ? "left" : prev === "left" ? "right" : "auto";
      langModeRef.current = next;
      if (overrideTimeoutRef.current) clearTimeout(overrideTimeoutRef.current);
      if (next !== "auto") {
        overrideTimeoutRef.current = setTimeout(() => {
          setSttLanguage("auto");
          langModeRef.current = "auto";
        }, 30000);
      }
      return next;
    });
  }, []);

  reconnectStreamRef.current = reconnectStream;

  // v4.100.2: auto-Zap — a silent Deepgram stall (connected, audio flowing,
  // but no data) used to leave the app dead until manual ZAP.
  // v4.136.0: "silent" means Deepgram sent NOTHING — empty keepalive Results
  // during dead air count as life, so a quiet stretch can't trigger reconnects.
  // v4.148.1: 65s → 35s. The clock is trustworthy now and the recorder-must-
  // still-be-sending + 120s-cooldown guards stay, so the loop risk that sized
  // the old 65s wait is gone. Rules are the pure, tested shouldAutoZap().
  const lastAutoZapAtRef = useRef(0);
  useEffect(() => {
    if (!isActive || connectionState !== "connected") return undefined;
    const t = setInterval(() => {
      const now = Date.now();
      const lastMsgAt = connectFlagsRef.current.lastDeepgramMessageAt || 0;
      if (
        !shouldAutoZap({
          msgAgeMs: lastMsgAt ? now - lastMsgAt : Infinity,
          audioProgressAgeMs: now - (lastAudioProgressAtRef.current || 0),
          sinceLastZapMs: now - lastAutoZapAtRef.current,
          speakingAgeMs: lastLoudAudioAtRef.current
            ? now - lastLoudAudioAtRef.current
            : Infinity,
        })
      ) {
        return;
      }
      lastAutoZapAtRef.current = now;
      critLog("warn", "auto reconnectStream: Deepgram silent 15s+ while speaking (or 35s+ total)");
      reconnectStream();
    }, 5000);
    return () => clearInterval(t);
  }, [isActive, connectionState, reconnectStream, critLog]);

  useEffect(() => {
    const onPairChange = (e) => {
      languagePairRef.current = e.detail || loadLanguagePair();
      if (isActiveRef.current && streamRef.current) {
        reconnectStreamRef.current?.();
      }
    };
    window.addEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
    return () => window.removeEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
  }, []);

  useEffect(() => {
    const onLatencyChange = (e) => {
      sttLatencyModeRef.current = e.detail || loadSttLatencyMode();
      if (isActiveRef.current && streamRef.current) {
        reconnectStreamRef.current?.();
      }
    };
    window.addEventListener(STT_LATENCY_CHANGED_EVENT, onLatencyChange);
    return () => window.removeEventListener(STT_LATENCY_CHANGED_EVENT, onLatencyChange);
  }, []);

  // v4.92.0: unmount — release idle-ear resources (VAD context + intervals).
  useEffect(() => () => {
    endSttSession();
    idleEarActiveRef.current = false;
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    if (idleKeepAliveRef.current) clearInterval(idleKeepAliveRef.current);
    try { vadCtxRef.current?.close(); } catch (_) {}
  }, []);

  return {
    startRecording,
    startRecordingFresh,
    switchAudioSourceModeSafely,
    stopRecording,
    reconnectStream,
    armCaptionCapture,
    captions,
    clearCaptions,
    sttLanguage,
    toggleLanguage,
    connectionState,
    connectionMessage,
    sttLive, // v4.153.0: sockets open AND audio flowing — the only real truth.
    apiKeyRejected,
    connectProgress,
    lastDataTime,
    micTestMode,
    setMicTestMode,
    tabStreamReady,
    cableStreamReady,
    attachedAudioSourceMode,
    virtualCableFailure,
  };
};
