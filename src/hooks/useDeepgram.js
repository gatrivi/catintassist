import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "../contexts/SessionContext";
import {
  applyTranscriptFormatting,
  splitLongTextAtCommas,
  peelCompleteSentences,
} from "../utils/transcriptFormat";
import {
  hallucinationGuard,
  removeOverlapPreservingDigitSequences,
} from "../utils/sensitiveDataProtector";
import {
  getEffectiveDeepgramKey,
  getDeepgramKeyInfo,
} from "../utils/deepgramRuntimeKey";

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

const sealText = (raw, lang) => applyTranscriptFormatting(raw.trim(), lang);

const buildSealedBubble = (
  sentence,
  template,
  bubbleIdCounterRef,
  turnWordCount,
) => {
  const lang = template.lang || "en";
  const text = sealText(sentence, lang);
  return {
    ...template,
    id: `${Date.now()}-${++bubbleIdCounterRef.current}-s`,
    text,
    turnId: template.turnId,
    turnWordCount,
    enFinalized: lang === "en" ? text : "",
    esFinalized: lang === "es" ? text : "",
    enInterim: "",
    esInterim: "",
    enFull: lang === "en" ? text : template.enFull,
    esFull: lang === "es" ? text : template.esFull,
    isFinal: true,
  };
};

/** Seal comma chunks when a fragment exceeds word limit without sentence end */
const peelCommaChunks = (text, template, bubbleIdCounterRef, turnWordsBase) => {
  const chunks = splitLongTextAtCommas(text, 40);
  if (!chunks.length) return { sealed: [], remainder: text };

  let acc = turnWordsBase;
  const sealed = chunks.map((chunk) => {
    const w = chunk.trim().split(/\s+/).filter(Boolean).length;
    acc += w;
    return buildSealedBubble(chunk, template, bubbleIdCounterRef, acc);
  });
  return { sealed, remainder: "" };
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
    phase: "idle", // idle | connecting | ready | error
    audioStreamReady: false,
    socketsOpen: false,
    audioChunksSent: false,
    transcriptReceived: false,
    lastUpdatedAt: 0,
    lastError: null,
  });
  const [sttLanguage, setSttLanguage] = useState("auto");
  const [lastDataTime, setLastDataTime] = useState(0);
  const [micTestMode, setMicTestModeState] = useState(readMicTestMode);
  const [tabStreamReady, setTabStreamReady] = useState(readTabStreamReady);

  const langModeRef = useRef("auto");
  const micTestModeRef = useRef(readMicTestMode());
  const streamSourceRef = useRef(null); // 'mic' | 'tab'
  const socketRefEn = useRef(null);
  const socketRefEs = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);

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
  const overrideTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectAttemptIdRef = useRef(0);
  const watchdogTimeoutRef = useRef(null);
  const connectFlagsRef = useRef({
    phase: "idle",
    audioStreamReady: false,
    socketsOpen: false,
    audioChunksSent: false,
    transcriptReceived: false,
    lastUpdatedAt: 0,
    lastError: null,
  });

  const syncConnectProgress = (patch) => {
    connectFlagsRef.current = { ...connectFlagsRef.current, ...patch, lastUpdatedAt: Date.now() };
    setConnectProgress(connectFlagsRef.current);
  };

  const resetConnectProgress = () => {
    syncConnectProgress({
      phase: "connecting",
      audioStreamReady: false,
      socketsOpen: false,
      audioChunksSent: false,
      transcriptReceived: false,
      lastError: null,
    });
  };

  const clearWatchdog = useCallback(() => {
    if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    watchdogTimeoutRef.current = null;
  }, []);

  // Only store transcript bubbles during an active or zombie-resumed call.
  useEffect(() => {
    shouldCaptureCaptionsRef.current = !!(isActive || isZombieCall);
  }, [isActive, isZombieCall]);

  const closeConnections = useCallback(() => {
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
      audioStreamReady: false,
      socketsOpen: false,
      audioChunksSent: false,
      transcriptReceived: false,
      lastError: null,
    });
  }, []);

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
    (message) => {
      // Stop Deepgram reconnect attempts and prevent further state flips.
      isActiveRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearWatchdog();
      try {
        if (overrideTimeoutRef.current) clearTimeout(overrideTimeoutRef.current);
      } catch {}

      // closeConnections flips state to "disconnected"; we override right after.
      closeConnections();
      setConnectionState("error");
      setConnectionMessage(message);
      syncConnectProgress({ phase: "error", lastError: message });
      if (isLikelyApiKeyRejected(message)) setApiKeyRejected(true);
    },
    [clearWatchdog, closeConnections, isLikelyApiKeyRejected],
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
        syncConnectProgress({ phase: "error", lastError: msg });
        return;
      }

      setConnectionState("connecting");
      setConnectionMessage("Initializing Sockets...");

      const createSocket = (lang) => {
        const url = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&filler_words=true&language=${lang}&interim_results=true&endpointing=300`;
        const ws = new WebSocket(url, ["token", API_KEY]);

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0; // Reset on successful open
          if (
            socketRefEn.current?.readyState === 1 &&
            socketRefEs.current?.readyState === 1
          ) {
            syncConnectProgress({ socketsOpen: true, phase: "connecting" });
            // If sockets open but we never send audio, the connection is likely stale.
            const attemptId = connectAttemptIdRef.current;
            clearWatchdog();
            watchdogTimeoutRef.current = setTimeout(() => {
              const stillSameAttempt = connectAttemptIdRef.current === attemptId;
              if (!stillSameAttempt) return;
              if (connectFlagsRef.current.audioChunksSent) return;
              // Only fail if we haven't received transcripts either (helps avoid false positives).
              if (connectFlagsRef.current.transcriptReceived) return;
              failConnection(
                "Deepgram sockets opened, but audio did not reach Deepgram. This usually means the connection is stale. Press Connect again (or ZAP ⚡) to refresh."
              );
            }, 9000);

            setConnectionState("connected");
            setConnectionMessage("Live");
            try {
              if (!mediaRecorderRef.current) {
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.addEventListener(
                  "dataavailable",
                  (e) => {
                    if (e.data.size > 0) {
                      let sentAny = false;
                      if (socketRefEn.current?.readyState === 1) {
                        sentAny = true;
                        socketRefEn.current.send(e.data);
                      }
                      if (socketRefEs.current?.readyState === 1) {
                        sentAny = true;
                        socketRefEs.current.send(e.data);
                      }
                      if (sentAny && !connectFlagsRef.current.audioChunksSent) {
                        syncConnectProgress({ audioChunksSent: true });
                        clearWatchdog();
                      }
                    }
                  },
                );
                mediaRecorderRef.current.start(250);
              }
            } catch (err) {
              console.error(err);
            }
          }
        };

        ws.onmessage = (message) => {
          const received = JSON.parse(message.data);
          // Deepgram may send structured auth errors over the socket.
          // If we detect "missing/invalid token", surface a targeted UX message.
          if (received?.type === "error" || received?.error || received?.message) {
            const errText =
              received?.error?.message ||
              received?.error?.code ||
              received?.message ||
              message?.data;
            if (isLikelyApiKeyRejected(errText)) {
              const msg = deepgramKeyRejectedMessage();
              setApiKeyRejected(true);
              failConnection(msg);
              return;
            }
          }
          const alt = received.channel?.alternatives?.[0];
          const transcript = alt?.transcript;
          if (!transcript || transcript.trim().length === 0) return;

          const confidence = alt?.confidence || 0;
          const isFinal = received.is_final;

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

          updateCaptions((prev) => {
            let last = prev[prev.length - 1];
            // New bubble only after silence or at stream start — sentence splits handled below
            const isNewTurn = isSilentBreak || !last;

            if (isNewTurn) {
              const lastCreationTime = last
                ? parseInt(last.id.split("-")[0])
                : 0;
              if (now - lastCreationTime < 400 && !isSilentBreak) {
                // Skip redundant split
              } else {
                if (isSilentBreak || !last) {
                  turnWordsBaseRef.current = 0;
                  currentTurnIdRef.current = `turn-${now}`;
                } else if (!currentTurnIdRef.current) {
                  currentTurnIdRef.current = last.turnId || `turn-${now}`;
                }

                last = {
                  id: `${Date.now()}-${++bubbleIdCounterRef.current}`,
                  enFinalized: "",
                  enInterim: "",
                  esFinalized: "",
                  esInterim: "",
                  turnId: currentTurnIdRef.current,
                  turnWordCount: turnWordsBaseRef.current,
                  isSplit: !isSilentBreak,
                };
                prev = [...prev, last];
              }
            }

            const current = { ...last };
            const historyText = prev
              .slice(-4, -1)
              .map((c) => c.text || "")
              .join(" ");
            const currentFinalized =
              (lang === "en" ? current.enFinalized : current.esFinalized) || "";
            const baseContext = (historyText + " " + currentFinalized).trim();

            const cleaned = removeOverlapPreservingDigitSequences(
              baseContext,
              transcript,
            );
            if (!cleaned.trim() && !isFinal) return prev;

            if (isFinal) {
              if (lang === "en") {
                current.enFinalized = hallucinationGuard(
                  (current.enFinalized + " " + cleaned).trim(),
                );
                current.enInterim = "";
              } else {
                current.esFinalized = hallucinationGuard(
                  (current.esFinalized + " " + cleaned).trim(),
                );
                current.esInterim = "";
              }
            } else {
              if (lang === "en") current.enInterim = cleaned;
              else current.esInterim = cleaned;
            }

            const enFull = (
              current.enFinalized +
              " " +
              current.enInterim
            ).trim();
            const esFull = (
              current.esFinalized +
              " " +
              current.esInterim
            ).trim();
            const enW = enFull.split(/\s+/).filter(Boolean).length;
            const esW = esFull.split(/\s+/).filter(Boolean).length;

            let winner = "en";
            if (esW >= enW + 2) winner = "es";
            else if (enW >= esW + 2) winner = "en";
            else winner = confidence > 0.8 && esW > 0 ? "es" : "en";

            if (langModeRef.current !== "auto") winner = langModeRef.current;

            // Non-doctor hold timer reset: reset only when English speech is detected.
            // Throttle to avoid spamming updates during interim packets.
            if (
              isCallDetectionEnabled &&
              winner === "en" &&
              confidence > 0.4 &&
              transcript &&
              transcript.trim().length > 0 &&
              now - lastEnglishActivityPulseRef.current > 500
            ) {
              updateEnglishActivity();
              lastEnglishActivityPulseRef.current = now;
            }

            current.lang = winner;
            current.text = winner === "en" ? enFull : esFull;
            current.enFull = enFull;
            current.esFull = esFull;
            current.isFinal = isFinal;
            const currentWords = current.text
              .split(/\s+/)
              .filter(Boolean).length;
            current.turnId =
              current.turnId || currentTurnIdRef.current || `turn-${now}`;
            current.turnWordCount = turnWordsBaseRef.current + currentWords;

            let newArr = [...prev];
            newArr[newArr.length - 1] = current;

            // Finalize complete sentences, then comma-chunk long breathless runs
            if (isFinal && current.text?.trim()) {
              // Preserve the previous bubble's id for the first sealed chunk.
              // This prevents React from remounting the "before split" bubble,
              // reducing the visible "dance" when the UI splits a long message.
              const originalLastId = last?.id;
              const { sentences, remainder: sentRemainder } =
                peelCompleteSentences(current.text);
              let sealedAll = [];
              // ALGO_SPLIT_FLAG: `tailText` is the exact string remainder selected
              // to be shown AFTER the UI decides to "flow" into the next bubble.
              // Everything in `sentences`/`sealedAll` is the part *not* moved.
              let tailText = sentRemainder;

              if (sentences.length > 0) {
                let acc = turnWordsBaseRef.current;
                sealedAll = sentences.map((sent) => {
                  const w = sent.trim().split(/\s+/).filter(Boolean).length;
                  acc += w;
                  return buildSealedBubble(
                    sent,
                    current,
                    bubbleIdCounterRef,
                    acc,
                  );
                });
                turnWordsBaseRef.current = acc;
              }

              if (tailText?.trim()) {
                // ALGO_SPLIT_FLAG: if tailText is still too long (comma chunking),
                // peelCommaChunks further selects a chunk to become the remainder bubble.
                const { sealed: commaSealed, remainder: commaRemainder } =
                  peelCommaChunks(
                    tailText,
                    current,
                    bubbleIdCounterRef,
                    turnWordsBaseRef.current,
                  );
                if (commaSealed.length) {
                  sealedAll = [...sealedAll, ...commaSealed];
                  turnWordsBaseRef.current =
                    commaSealed[commaSealed.length - 1].turnWordCount;
                  tailText = commaRemainder;
                }
              }

              if (
                !sentences.length &&
                !sealedAll.length &&
                current.text?.trim()
              ) {
                // ALGO_SPLIT_FLAG: rare case where there were no sentence endings,
                // so comma-chunking becomes the split selector.
                const { sealed: commaOnly, remainder: commaRemainder } =
                  peelCommaChunks(
                    current.text,
                    current,
                    bubbleIdCounterRef,
                    turnWordsBaseRef.current,
                  );
                if (commaOnly.length) {
                  sealedAll = commaOnly;
                  turnWordsBaseRef.current =
                    commaOnly[commaOnly.length - 1].turnWordCount;
                  tailText = commaRemainder;
                }
              }

              if (sealedAll.length > 0) {
                if (sealedAll[0] && originalLastId) {
                  sealedAll[0] = { ...sealedAll[0], id: originalLastId };
                }
                newArr = [...prev.slice(0, -1), ...sealedAll];
                if (tailText?.trim()) {
                  const lang = current.lang || "en";
                  const formatted = sealText(tailText, lang);
                  // ALGO_MOVED_SECTION: this `newArr.push` is the "to-be-flowed" remainder
                  // that will show up as its own bubble (isFinal:false) in the UI.
                  // Blue animation should be triggered for ONLY this remainder section,
                  // not for the already sealed part (sealedAll).
                  newArr.push({
                    ...current,
                    id: `${Date.now()}-${++bubbleIdCounterRef.current}`,
                    turnId: current.turnId,
                    turnWordCount: turnWordsBaseRef.current,
                    text: formatted,
                    enFinalized: lang === "en" ? formatted : "",
                    esFinalized: lang === "es" ? formatted : "",
                    enInterim: lang === "en" ? current.enInterim : "",
                    esInterim: lang === "es" ? current.esInterim : "",
                    enFull:
                      lang === "en"
                        ? `${formatted} ${current.enInterim || ""}`.trim()
                        : current.enFull,
                    esFull:
                      lang === "es"
                        ? `${formatted} ${current.esInterim || ""}`.trim()
                        : current.esFull,
                    isFinal: false,
                  });
                }
              }
            }

            return newArr.slice(-150);
          });
        };

        ws.onclose = () => {
          console.log(`[Deepgram] ${lang} Close`);
          // AUTO-RECONNECT: Unless "Boom" (intentional stop), attempt to recover sockets if stream is still alive
          if (isActiveRef.current && reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++;
            const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
            console.log(`[Deepgram] Reconnecting in ${delay}ms...`);
            setTimeout(() => {
              if (isActiveRef.current) {
                if (lang === "en") socketRefEn.current = createSocket("en");
                else socketRefEs.current = createSocket("es");
              }
            }, delay);
          }
        };
        ws.onerror = () => {
          // Only surface errors during an active connect attempt.
          if (connectFlagsRef.current.phase === "ready") return;
          // If this is happening after we already attached audio, don't spam the user.
          if (connectFlagsRef.current.phase !== "connecting") return;
          failConnection(
            "Deepgram WebSocket failed — check network connection, then try again. (Not an API key error.)"
          );
        };
        return ws;
      };

      socketRefEn.current = createSocket("en");
      socketRefEs.current = createSocket("es");
    },
    [
      isCallDetectionEnabled,
      updateActivity,
      updateCaptions,
      updateEnglishActivity,
      requestHoldIntent,
      notifySpeechDuringCall,
      trySpeechAutoStart,
      speechAutoConnect,
      isActive,
      isZombieCall,
    ],
  );

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    turnWordsBaseRef.current = 0;
    currentTurnIdRef.current = null;
    closeConnections();
    // HIPAA grace: do not destroy transcription/translation immediately;
    // defer to SessionContext finalizer (15s leeway for quick reconnect).
    if (!hipaaGraceActiveRef?.current) clearCaptions();
  }, [closeConnections, clearCaptions, hipaaGraceActiveRef]);

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
      const next = prev === "auto" ? "en" : prev === "en" ? "es" : "auto";
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
