import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "../contexts/SessionContext";
import {
  getEffectiveDeepgramKey,
  getDeepgramKeyInfo,
} from "../utils/deepgramRuntimeKey";
import {
  classifyDeepgramClose,
  buildFailureMessage,
  FAILURE,
} from "../utils/deepgramDiagnostics";
import {
  loadLanguagePair,
  isEnEsProtectionMode,
  usesMultiSocket,
  laneSideForLang,
  normalizeLang,
  LANG_PAIR_CHANGED_EVENT,
} from "../utils/languageConfig";
import {
  INTERIM_THROTTLE_MS,
  mergeCaptionsForUi,
  splitCaptionRows,
  initEngineFromPersisted,
  reduceTranscriptEvent,
  shouldFlushImmediately,
  createCaptionEngineState,
} from "../utils/captionEngine";

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

const MIC_TEST_KEY = "catint_mic_test_mode_v1";
const MIC_DEVICE_KEY = "CATINTASSIST_MIC_ID";

const readMicTestMode = () => {
  try {
    return localStorage.getItem(MIC_TEST_KEY) === "1";
  } catch {
    return false;
  }
};

/** Tab capture vs physical mic — mic mode skips getDisplayMedia picker. */
const acquireAudioStream = async (useMic) => {
  if (useMic) {
    const micId = localStorage.getItem(MIC_DEVICE_KEY);
    const audio = micId
      ? {
          deviceId: { exact: micId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : true;
    return navigator.mediaDevices.getUserMedia({ audio });
  }
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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
  const captionsHydratedRef = useRef(false);

  // After refresh there is no live MediaStream — clear stale tab-ready flag.
  useEffect(() => {
    if (!streamRef.current?.active) {
      setTabStreamReady(false);
      try {
        sessionStorage.removeItem(TAB_STREAM_READY_KEY);
      } catch (_) {}
    }
  }, []);

  const shouldCaptureCaptionsRef = useRef(false);
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

  const resetCaptionEngine = useCallback(() => {
    captionEngineRef.current = createCaptionEngineState();
    if (interimFlushTimerRef.current) {
      clearTimeout(interimFlushTimerRef.current);
      interimFlushTimerRef.current = null;
    }
  }, []);

  const flushCaptionsToSession = useCallback(() => {
    updateCaptions(mergeCaptionsForUi(captionEngineRef.current));
  }, [updateCaptions]);

  const scheduleInterimFlush = useCallback(() => {
    if (interimFlushTimerRef.current) return;
    interimFlushTimerRef.current = setTimeout(() => {
      interimFlushTimerRef.current = null;
      flushCaptionsToSession();
    }, INTERIM_THROTTLE_MS);
  }, [flushCaptionsToSession]);

  useEffect(() => {
    if (captions.length > 0 && !captionsHydratedRef.current) {
      captionsHydratedRef.current = true;
      captionEngineRef.current = initEngineFromPersisted(captions);
    }
    if (captions.length === 0 && captionsHydratedRef.current) {
      resetCaptionEngine();
      captionsHydratedRef.current = false;
    }
  }, [captions, resetCaptionEngine]);

  const resetConnectProgress = () => {
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
      transcriptReceived: false,
      lastCloseCode: null,
      lastCloseReason: null,
      failureCategory: null,
      lastError: null,
    });
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
    syncConnectProgress({
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
      syncConnectProgress({
        phase: "error",
        lastError: message,
        ...extra,
      });
      const cat = extra.failureCategory;
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
    try {
      sessionStorage.setItem(TAB_STREAM_READY_KEY, "0");
    } catch {}
  }, []);

  const setMicTestMode = useCallback(
    (enabled) => {
      const on = !!enabled;
      micTestModeRef.current = on;
      setMicTestModeState(on);
      try {
        localStorage.setItem(MIC_TEST_KEY, on ? "1" : "0");
      } catch (_) {}
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

  const startDeepgram = useCallback(
    (stream) => {
      const API_KEY = getEffectiveDeepgramKey();
      if (!API_KEY) {
        setConnectionState("error");
        const msg =
          "Deepgram API key is missing. Click the gear (top-right) → paste your key → try again.";
        setConnectionMessage(msg);
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
                let sentAny = false;
                if (socketRefEn.current?.readyState === 1) {
                  sentAny = true;
                  socketRefEn.current.send(e.data);
                }
                if (!multiMode && socketRefEs.current?.readyState === 1) {
                  sentAny = true;
                  socketRefEs.current.send(e.data);
                }
                if (sentAny && !connectFlagsRef.current.audioChunksSent) {
                  syncConnectProgress({ audioChunksSent: true });
                  clearKeepalive();
                  clearWatchdog();
                }
              }
            });
            mediaRecorderRef.current.start(250);
          }
        } catch (err) {
          console.error(err);
          failConnection(`MediaRecorder failed: ${err.message}`, {
            failureCategory: FAILURE.AUDIO,
          });
        }
      };

      const createSocket = (lang, stream, { socketSide = "En", isFirst = false } = {}) => {
        const url = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&filler_words=true&language=${lang}&interim_results=true&endpointing=300`;
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
          if (!transcript || transcript.trim().length === 0) return;

          const confidence = alt?.confidence || 0;
          const isFinal = received.is_final;
          const speechFinal = received.speech_final;
          const startTime = received.start ?? 0;
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

          if (!shouldCaptureCaptionsRef.current) return;

          const merged = mergeCaptionsForUi(captionEngineRef.current);
          const newArr = reduceTranscriptEvent(
            merged,
            {
              transcript,
              isFinal,
              speechFinal,
              confidence,
              laneSide,
              channelKey: lang,
              startTime,
              now,
              isSilentBreak,
              protectionsOn,
              langMode: langModeRef.current,
              pair,
            },
            {
              turnWordsBaseRef,
              currentTurnIdRef,
              bubbleIdCounterRef,
              lastBubbleStartedRef,
            },
          );
          captionEngineRef.current = splitCaptionRows(newArr);

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
          console.log(`[Deepgram] ${lang} Close`, code, reason);
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
      if (stream.getAudioTracks().length === 0) {
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
      bindStreamLifecycle(stream, source);
      syncConnectProgress({ audioStreamReady: true, phase: "connecting" });
      startDeepgram(stream);
      if (source === "tab") {
        setTabStreamReady(true);
        try {
          sessionStorage.setItem(TAB_STREAM_READY_KEY, "1");
        } catch {}
      }
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
      const useMic = micTestModeRef.current;
      const source = useMic ? "mic" : "tab";

      // REUSE EXISTING STREAM IF AVAILABLE AND ACTIVE (same source type)
      if (
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getAudioTracks().length > 0 &&
        streamSourceRef.current === source
      ) {
        setConnectionMessage(
          useMic ? "Reusing Microphone..." : "Reusing Tab Audio...",
        );
        isActiveRef.current = true;
        startDeepgram(streamRef.current);
        return true;
      }

      setConnectionMessage(
        useMic ? "Requesting Microphone..." : "Requesting Tab Audio...",
      );
      const stream = await acquireAudioStream(useMic);
      return beginStream(stream, source);
    } catch (err) {
      console.error(err);
      const msg = micTestModeRef.current
        ? "Microphone access was denied. Please allow microphone permissions and press Connect again."
        : "Tab sharing was cancelled. Please start tab sharing again and press Connect again.";
      setConnectionState("error");
      setConnectionMessage(msg);
      syncConnectProgress({ phase: "error", lastError: msg });
      return false;
    }
  }, [beginStream, startDeepgram, clearWatchdog]);

  // Force re-open picker (tab) or re-request mic (double-tap connect).
  const startRecordingFresh = useCallback(async () => {
    try {
      connectAttemptIdRef.current += 1;
      clearWatchdog();
      const useMic = micTestModeRef.current;
      const source = useMic ? "mic" : "tab";
      closeConnections();
      stopStreamTracks();
      resetConnectProgress();
      setConnectionState("connecting");
      setConnectionMessage(
        useMic
          ? "Requesting Microphone (fresh)..."
          : "Requesting Tab Audio (fresh)...",
      );
      if (source === "tab") {
        // Force "tab needs reconnect" UX until we successfully reacquire a stream.
        setTabStreamReady(false);
        try {
          sessionStorage.setItem(TAB_STREAM_READY_KEY, "0");
        } catch {}
      }

      setConnectionMessage(
        useMic ? "Requesting Microphone..." : "Requesting Tab Audio...",
      );
      const stream = await acquireAudioStream(useMic);
      return beginStream(stream, source);
    } catch (err) {
      console.error(err);
      const msg = micTestModeRef.current
        ? "Microphone access was denied. Please allow microphone permissions and press Connect again."
        : "Tab sharing was cancelled. Please start tab sharing again and press Connect again.";
      setConnectionState("error");
      setConnectionMessage(msg);
      syncConnectProgress({ phase: "error", lastError: msg });
      return false;
    }
  }, [beginStream, closeConnections, stopStreamTracks, clearWatchdog]);

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
  }, [closeConnections, startDeepgram, startRecording, clearWatchdog]);

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

  return {
    startRecording,
    startRecordingFresh,
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
  };
};
