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
  FAILURE,
} from "../utils/deepgramDiagnostics";
import {
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  readAudioSourceMode,
  buildVirtualCableFailureUiState,
  classifyTabCaptureError,
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
  normalizeLang,
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
  getInterimFlushMs,
  getInterimProcessThrottleMs,
  getMediaRecorderTimeslice,
  loadSttLatencyMode,
} from "../utils/deepgramListenConfig";
import { readMicTestMode, writeMicTestMode } from "../utils/micMode";
import { traceCaptionArrayDiff } from "../utils/vanishTrace";

const CAPTIONS_CLEARED_EVENT = "catint_captions_cleared";
const STT_TRACE_LIMIT = 300;

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

const acquireAudioStreamForSource = async (source) => {
  const { stream } = await acquireInputSource(mapLegacySourceToKind(source));
  if (!stream) {
    throw new Error(`InputSource ${source} did not yield a MediaStream`);
  }
  return stream;
};

// Heuristic: only auto-switch to mic mode on small screens to avoid surprising desktop users.
const isLikelyMobile = () => {
  try {
    const w = typeof window !== "undefined" ? window.innerWidth : 9999;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    return w <= 600 || /Android|iPhone|iPad|iPod/i.test(ua);
  } catch (_) {
    return false;
  }
};

export const useDeepgram = () => {
  const {
    updateActivity,
    updateEnglishActivity,
    isCallDetectionEnabled,
    requestHoldIntent,
    captions,
    updateCaptions,
    clearCaptions,
    isCaptionsLoaded,
    isActive,
    isZombieCall,
    hipaaGraceActiveRef,
    notifySpeechDuringCall,
    trySpeechAutoStart,
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
    lastTranscriptStringAt: 0,
    lastCaptionCommitAt: 0,
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
  const [micTestMode, setMicTestModeState] = useState(readMicTestMode);
  const [tabStreamReady, setTabStreamReady] = useState(readTabStreamReady);
  const [cableStreamReady, setCableStreamReady] = useState(false);
  const [attachedAudioSourceMode, setAttachedAudioSourceMode] = useState("tab"); // 'tab' | 'mic' | 'virtualCable'
  const [virtualCableFailure, setVirtualCableFailure] = useState(null); // { message, suggestedActionLabel }

  const langModeRef = useRef("auto");
  const languagePairRef = useRef(loadLanguagePair());
  const reconnectStreamRef = useRef(null);
  const micTestModeRef = useRef(readMicTestMode());
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
    lastTranscriptStringAt: 0,
    lastCaptionCommitAt: 0,
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
    console.info(`[CAT STT] ${stage}`, entry);
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
      lastTranscriptStringAt: 0,
      lastCaptionCommitAt: 0,
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

  // Only store transcript bubbles during an active or zombie-resumed call.
  useEffect(() => {
    shouldCaptureCaptionsRef.current = !!(isActive || isZombieCall);
  }, [isActive, isZombieCall]);

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

  const closeConnections = useCallback(() => {
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
  }, [clearKeepalive]);

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

      setConnectionState("error");
      setConnectionMessage(message);
      const keyInfo = getDeepgramKeyInfo();
      const cat = extra.failureCategory;
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
    [clearWatchdog, clearKeepalive, isLikelyApiKeyRejected],
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

  // Mobile UX: if the user selected a physical mic device, default to mic-mode STT.
  // This keeps the green Connect button and the actual audio route in sync.
  useEffect(() => {
    const ensureMicModeForMobile = () => {
      if (!isLikelyMobile()) return;
      try {
        const micId = localStorage.getItem(MIC_DEVICE_KEY);
        if (micId && !micTestModeRef.current) setMicTestMode(true);
      } catch (_) {}
    };

    const onMicDeviceChanged = (e) => {
      const deviceId = e?.detail?.deviceId ?? "";
      if (!deviceId) return;
      if (!isLikelyMobile()) return;
      if (micTestModeRef.current) return;
      setMicTestMode(true);
    };

    ensureMicModeForMobile();
    window.addEventListener("catint_mic_device_changed", onMicDeviceChanged);
    return () => window.removeEventListener("catint_mic_device_changed", onMicDeviceChanged);
  }, [setMicTestMode]);

  const startDeepgram = useCallback(
    (stream) => {
      const API_KEY = getEffectiveDeepgramKey();
      if (!API_KEY) {
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

      setConnectionState("connecting");
      setConnectionMessage("Initializing Sockets...");

      const pair = languagePairRef.current;
      const multiMode = usesMultiSocket(pair);
      const protectionsOn = isEnEsProtectionMode(pair);

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
        });
        startKeepalive();
        const attemptId = connectAttemptIdRef.current;
        clearWatchdog();
        watchdogTimeoutRef.current = setTimeout(() => {
          const stillSameAttempt = connectAttemptIdRef.current === attemptId;
          if (!stillSameAttempt) return;
          if (connectFlagsRef.current.audioChunksSent) return;
          if (connectFlagsRef.current.transcriptReceived) return;

          failConnection(
            "TIMEOUT: Sockets open but no audio reached Deepgram. Check Share audio on tab, unmute call, or try mic mode.",
            { failureCategory: FAILURE.TIMEOUT },
          );
        }, 12000);

        setConnectionState("connected");
        setConnectionMessage("Live");
        try {
          if (!mediaRecorderRef.current) {
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.addEventListener("dataavailable", (e) => {
              if (e.data.size > 0) {
                const audioNow = Date.now();
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
                      lanes,
                      firstAudioChunk,
                    });
                    syncConnectProgress({
                      audioChunksSent: true,
                      lastAudioChunkAt: audioNow,
                      lastAudioChunkSize: e.data.size,
                    });
                  }
                }
                if (firstAudioChunk) {
                  clearKeepalive();
                  clearWatchdog();
                }
              }
            });
            mediaRecorderRef.current.start(
              getMediaRecorderTimeslice(sttLatencyModeRef.current),
            );

          }
        } catch (err) {
          console.error(err);
          failConnection(`MediaRecorder failed: ${err.message}`, {
            failureCategory: FAILURE.AUDIO,
          });
        }
      };

      const createSocket = (lang, stream, { socketSide = "En", isFirst = false } = {}) => {
        const url = buildListenUrl(lang, sttLatencyModeRef.current);
        const ws = new WebSocket(url, ["token", API_KEY]);
        const sk = socketSide === "En" ? "socketEn" : "socketEs";
        const skClose = socketSide === "En" ? "socketEnClose" : "socketEsClose";

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          syncConnectProgress({ [sk]: "open" });
          if (isFirst && !multiMode) {
            syncConnectProgress({ socketEs: "connecting" });
            socketRefEs.current = createSocket(pair.right, stream, {
              socketSide: "Es",
              isFirst: false,
            });
          }
          tryStartStreaming(stream);
        };

        ws.onmessage = (message) => {
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
          sttTrace("3 Deepgram websocket message received", {
            lang,
            type: received?.type || "transcript",
            isFinal: !!received?.is_final,
            speechFinal: !!received?.speech_final,
          });
          syncConnectProgress({ lastDeepgramMessageAt: dgMessageAt, ...socketMsgPatch });
          const errType = (received?.type || "").toString().toLowerCase();
          if (errType === "error" || received?.error) {
            const errText =
              received?.error?.message ||
              received?.error?.code ||
              received?.description ||
              JSON.stringify(received?.error || received);
            if (isLikelyApiKeyRejected(errText)) {
              const msg = deepgramKeyRejectedMessage();
              failConnection(msg, {
                failureCategory: FAILURE.AUTH,
                [sk]: "error",
              });
              return;
            }
          }
          const alt = received.channel?.alternatives?.[0];
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
            syncConnectProgress(socketConfidencePatch);
            sttTrace("4 Deepgram processed empty transcript", {
              lang,
              confidence: alt?.confidence ?? null,
              words: alt?.words?.length || 0,
            });
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
          sttTrace("4 Deepgram processed + 5 returned string", {
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

          if (confidence > 0.4) {
            if (isActive) {
              notifySpeechDuringCall();
            } else if (speechAutoConnect && !isZombieCall) {
              if (trySpeechAutoStart()) {
                shouldCaptureCaptionsRef.current = true;
                notifySpeechDuringCall();
              }
            }
          }

          if (!connectFlagsRef.current.transcriptReceived) {
            syncConnectProgress({ transcriptReceived: true, phase: "ready" });
          }
          syncConnectProgress({
            lastTranscriptStringAt: Date.now(),
            lastTranscriptText: transcript.slice(0, 120),
            lastTranscriptConfidence: confidence,
            lastWordConfidenceCount: wordConfidenceCount,
            ...socketConfidencePatch,
          });

          if (isCallDetectionEnabled && confidence > 0.4) {
            updateActivity();
            setLastDataTime(Date.now());
          }

          const lowTrans = transcript.toLowerCase();
          if (
            lowTrans.includes("stay on the line") ||
            lowTrans.includes("please hold") ||
            lowTrans.includes("hold please") ||
            lowTrans.includes("put you on hold") ||
            lowTrans.includes("one moment") ||
            lowTrans.includes("one minute") ||
            (lowTrans.includes("hold") && lowTrans.includes("interpreter"))
          ) {
            requestHoldIntent();
          }

          const now = Date.now();
          const timeSinceLast = now - lastTranscriptTimeRef.current;
          lastTranscriptTimeRef.current = now;
          const isSilentBreak = timeSinceLast > 2500;

          if (!shouldCaptureCaptionsRef.current) {
            if (!didLogCaptureGateWhileNotActiveRef.current && typeof window !== "undefined") {
              didLogCaptureGateWhileNotActiveRef.current = true;
              sttTrace("blocked before render: capture gate off", {
                isActive,
                isZombieCall,
                text: transcript.slice(0, 120),
              });
            }
            return;
          }

          // Throttle interim transcript processing: final/speech-final always processed.
          const isFinalish = !!isFinal || !!speechFinal;
          if (!isFinalish) {
            const nowPerf = performance.now();
            const interimGate = getInterimProcessThrottleMs(sttLatencyModeRef.current);
            if (nowPerf - lastInterimAtRef.current < interimGate) return;
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
          const dt = performance.now() - t0;
          sttTrace("6 caption engine committed", {
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

          const lastRow = newArr[newArr.length - 1];
          if (
            isCallDetectionEnabled &&
            lastRow &&
            normalizeLang(lastRow.lang) === "en" &&
            confidence > 0.4 &&
            lastRow.text?.trim() &&
            now - lastEnglishActivityPulseRef.current > 500
          ) {
            updateEnglishActivity();
            lastEnglishActivityPulseRef.current = now;
          }
        };

        ws.onclose = (event) => {
          const code = event?.code;
          const reason = event?.reason || "";
          if (process.env.NODE_ENV !== "production") {
            console.log(`[Deepgram] ${lang} Close`, code, reason);
          }
          syncConnectProgress({
            [sk]: "error",
            [skClose]: `${code}${reason ? `: ${reason}` : ""}`,
            lastCloseCode: code,
            lastCloseReason: reason,
          });

          if (connectFlagsRef.current.phase === "connecting") {
            if (code !== 1000) {
              scheduleConnectFail(lang, code, reason, socketSide);
            }
            return;
          }

          if (isActiveRef.current && reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++;
            const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
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

        ws.onerror = () => {
          if (connectFlagsRef.current.phase === "ready") return;
          if (connectFlagsRef.current.phase !== "connecting") return;
          syncConnectProgress({ [sk]: "error" });
          console.warn(`[Deepgram] ${lang} WebSocket error (awaiting close code…)`);
        };
        return ws;
      };

      const firstLang = multiMode ? "multi" : pair.left;
      socketRefEn.current = createSocket(firstLang, stream, {
        socketSide: "En",
        isFirst: true,
      });
    },
    [
      isCallDetectionEnabled,
      updateActivity,
      flushCaptionsToSession,
      scheduleInterimFlush,
      updateEnglishActivity,
      requestHoldIntent,
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
    ],
  );

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    turnWordsBaseRef.current = 0;
    currentTurnIdRef.current = null;
    closeConnections();
    // HIPAA grace: do not destroy transcription/translation immediately;
    // defer to SessionContext finalizer (15s leeway for quick reconnect).
    if (!hipaaGraceActiveRef?.current) {
      resetCaptionEngine();
      clearCaptions();
    }
  }, [closeConnections, clearCaptions, hipaaGraceActiveRef, resetCaptionEngine]);

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
  }, []);

  const beginStream = useCallback(
    (stream, source) => {
      const audioTrackCount = stream.getAudioTracks().length;

      if (audioTrackCount === 0) {
        setConnectionState("error");
        setConnectionMessage(
          "No audio track was detected. Make sure your selected tab or microphone includes audio, then press Connect again."
        );
        syncConnectProgress({
          phase: "error",
          lastError: "No audio track was detected. Make sure your selected tab or microphone includes audio, then press Connect again.",
        });
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
        return false;
      }
      streamRef.current = stream;
      isActiveRef.current = true;
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
    [bindStreamLifecycle, startDeepgram],
  );

  const startRecording = useCallback(async () => {
    try {
      connectAttemptIdRef.current += 1;
      resetConnectProgress();
      clearWatchdog();
      setConnectionState("connecting");
      const configuredMode = readAudioSourceMode();
      const useVirtualCable = configuredMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE;
      const source = useVirtualCable ? "virtualCable" : micTestModeRef.current ? "mic" : "tab";
      const useMic = source === "mic";


      // REUSE EXISTING STREAM IF AVAILABLE AND ACTIVE (same source type)
      if (
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getAudioTracks().length > 0 &&
        streamSourceRef.current === source
      ) {
        setConnectionMessage(
          source === "virtualCable"
            ? "Reusing Virtual Cable..."
            : useMic
              ? "Reusing Microphone..."
              : "Reusing Tab Audio...",
        );
        isActiveRef.current = true;
        startDeepgram(streamRef.current);
        return true;
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
      if (!ok && source === "tab" && !micTestModeRef.current && hasSelectedMicDevice()) {
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
      const configuredMode = readAudioSourceMode();
      const attemptedSource =
        configuredMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE
          ? "virtualCable"
          : micTestModeRef.current
            ? "mic"
            : "tab";

      if (attemptedSource === "tab" && !micTestModeRef.current) {
        const tabErr = classifyTabCaptureError(err);
        if (tabErr.suggestMicFallback) {
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
        setConnectionState("error");
        setConnectionMessage(tabErr.message);
        syncConnectProgress({ phase: "error", lastError: tabErr.message });
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

      const msg = micTestModeRef.current
        ? "Microphone access was denied. Please allow microphone permissions and press Connect again."
        : classifyTabCaptureError(err).message;
      setConnectionState("error");
      setConnectionMessage(msg);
      syncConnectProgress({ phase: "error", lastError: msg });
      return false;
    }
  }, [beginStream, startDeepgram, clearWatchdog, setMicTestMode, resetConnectProgress]);

  // Force re-open picker (tab) or re-request mic (double-tap connect).
  const startRecordingFresh = useCallback(async () => {
    try {
      connectAttemptIdRef.current += 1;
      clearWatchdog();
      const configuredMode = readAudioSourceMode();
      const useVirtualCable = configuredMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE;
      const source = useVirtualCable
        ? "virtualCable"
        : micTestModeRef.current
          ? "mic"
          : "tab";
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
      if (!ok && source === "tab" && !micTestModeRef.current && hasSelectedMicDevice()) {
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
      const configuredMode = readAudioSourceMode();
      const attemptedSource =
        configuredMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE
          ? "virtualCable"
          : micTestModeRef.current
            ? "mic"
            : "tab";

      if (attemptedSource === "tab" && !micTestModeRef.current) {
        const tabErr = classifyTabCaptureError(err);
        if (tabErr.suggestMicFallback) {
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
        setConnectionState("error");
        setConnectionMessage(tabErr.message);
        syncConnectProgress({ phase: "error", lastError: tabErr.message });
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

      const msg = micTestModeRef.current
        ? "Microphone access was denied. Please allow microphone permissions and press Connect again."
        : classifyTabCaptureError(err).message;
      setConnectionState("error");
      setConnectionMessage(msg);
      syncConnectProgress({ phase: "error", lastError: msg });
      return false;
    }
  }, [beginStream, closeConnections, stopStreamTracks, clearWatchdog, setMicTestMode, resetConnectProgress]);

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
    connectAttemptIdRef.current += 1;
    clearWatchdog();
    reconnectAttemptsRef.current = 0; // Reset manual attempts
    closeConnections();
    resetConnectProgress();
    setConnectionState("connecting");
    setConnectionMessage("Reconnecting to Deepgram...");
    setTimeout(() => {
      if (streamRef.current && isActiveRef.current)
        startDeepgram(streamRef.current);
      else {
        // If stream is dead, we need a full restart
        startRecording();
      }
    }, 400);
  }, [closeConnections, startDeepgram, startRecording, clearWatchdog, resetConnectProgress]);

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

  return {
    startRecording,
    startRecordingFresh,
    switchAudioSourceModeSafely,
    stopRecording,
    reconnectStream,
    captions,
    clearCaptions,
    sttLanguage,
    toggleLanguage,
    connectionState,
    connectionMessage,
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
