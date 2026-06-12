import { useState, useRef, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';
import { applyTranscriptFormatting, splitLongTextAtCommas } from '../utils/transcriptFormat';
import {
  hallucinationGuard,
  removeOverlapPreservingDigitSequences,
} from '../utils/sensitiveDataProtector';

const TAB_STREAM_READY_KEY = 'catint_tab_stream_ok_v1';
const readTabStreamReady = () => {
  try {
    return sessionStorage.getItem(TAB_STREAM_READY_KEY) === '1';
  } catch {
    return false;
  }
};

/** Split leading complete sentences (ends with . ! ?) from trailing fragment. */
const peelCompleteSentences = (text) => {
  const sentences = [];
  let rest = (text || '').trim();
  while (rest) {
    const m = rest.match(/^(.+?[.!?…]+)(?:\s+)([\s\S]+)$/);
    if (!m) break;
    const sent = m[1].trim();
    if (!sent) break;
    sentences.push(sent);
    rest = m[2].trim();
  }
  return { sentences, remainder: rest };
};

const sealText = (raw, lang) => applyTranscriptFormatting(raw.trim(), lang);

const buildSealedBubble = (sentence, template, bubbleIdCounterRef, turnWordCount) => {
  const lang = template.lang || 'en';
  const text = sealText(sentence, lang);
  return {
    ...template,
    id: `${Date.now()}-${++bubbleIdCounterRef.current}-s`,
    text,
    turnId: template.turnId,
    turnWordCount,
    enFinalized: lang === 'en' ? text : '',
    esFinalized: lang === 'es' ? text : '',
    enInterim: '',
    esInterim: '',
    enFull: lang === 'en' ? text : template.enFull,
    esFull: lang === 'es' ? text : template.esFull,
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
  return { sealed, remainder: '' };
};

const MIC_TEST_KEY = 'catint_mic_test_mode_v1';
const MIC_DEVICE_KEY = 'CATINTASSIST_MIC_ID';

const readMicTestMode = () => {
  try {
    return localStorage.getItem(MIC_TEST_KEY) === '1';
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
  } = useSession();
  
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const [sttLanguage, setSttLanguage] = useState('auto');
  const [lastDataTime, setLastDataTime] = useState(0);
  const [micTestMode, setMicTestModeState] = useState(readMicTestMode);
  const [tabStreamReady, setTabStreamReady] = useState(readTabStreamReady);
  
  const langModeRef = useRef('auto');
  const micTestModeRef = useRef(readMicTestMode());
  const streamSourceRef = useRef(null); // 'mic' | 'tab'
  const socketRefEn = useRef(null);
  const socketRefEs = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());
  const lastEnglishActivityPulseRef = useRef(0);
  const turnWordsBaseRef = useRef(0); // words already sealed in the current silence-to-silence turn
  const currentTurnIdRef = useRef(null);
  const bubbleIdCounterRef = useRef(0);
  const overrideTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const closeConnections = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch(e) { console.warn("Failed to stop recorder:", e); }
    mediaRecorderRef.current = null;

    if (socketRefEn.current) { socketRefEn.current.close(); socketRefEn.current = null; }
    if (socketRefEs.current) { socketRefEs.current.close(); socketRefEs.current = null; }
    setConnectionState('disconnected');
    setConnectionMessage('Disconnected');
  }, []);

  const stopStreamTracks = useCallback(() => {
    try {
      const s = streamRef.current;
      if (!s) return;
      s.getTracks?.().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
    } catch (_) {}
    streamRef.current = null;
    streamSourceRef.current = null;
    setTabStreamReady(false);
    try {
      sessionStorage.setItem(TAB_STREAM_READY_KEY, '0');
    } catch {}
  }, []);

  const setMicTestMode = useCallback((enabled) => {
    const on = !!enabled;
    micTestModeRef.current = on;
    setMicTestModeState(on);
    try {
      localStorage.setItem(MIC_TEST_KEY, on ? '1' : '0');
    } catch (_) {}
    // Drop cached stream if source type would change on next connect.
    if (streamRef.current && streamSourceRef.current !== (on ? 'mic' : 'tab')) {
      stopStreamTracks();
    }
  }, [stopStreamTracks]);

  const startDeepgram = useCallback((stream) => {
    const API_KEY = localStorage.getItem('DEEPGRAM_API_KEY') || process.env.REACT_APP_DEEPGRAM_API_KEY;
    if (!API_KEY || API_KEY.trim() === '' || API_KEY === 'your_deepgram_api_key_here') {
      alert("Deepgram API Key Missing");
      setConnectionState('error');
      return;
    }

    setConnectionState('connecting');
    setConnectionMessage('Initializing Sockets...');

    const createSocket = (lang) => {
      const url = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&filler_words=true&language=${lang}&interim_results=true&endpointing=300`;
      const ws = new WebSocket(url, ['token', API_KEY]);

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0; // Reset on successful open
        if (socketRefEn.current?.readyState === 1 && socketRefEs.current?.readyState === 1) {
          setConnectionState('connected');
          setConnectionMessage('Live');
          try {
            if (!mediaRecorderRef.current) {
              mediaRecorderRef.current = new MediaRecorder(stream);
              mediaRecorderRef.current.addEventListener('dataavailable', (e) => {
                if (e.data.size > 0) {
                  if (socketRefEn.current?.readyState === 1) socketRefEn.current.send(e.data);
                  if (socketRefEs.current?.readyState === 1) socketRefEs.current.send(e.data);
                }
              });
              mediaRecorderRef.current.start(250);
            }
          } catch(err) { console.error(err); }
        }
      };

      ws.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const alt = received.channel?.alternatives?.[0];
        const transcript = alt?.transcript;
        if (!transcript || transcript.trim().length === 0) return;

        const confidence = alt?.confidence || 0;
        const isFinal = received.is_final;

        if (isCallDetectionEnabled && confidence > 0.4) {
          updateActivity();
          setLastDataTime(Date.now());
        }

        const lowTrans = transcript.toLowerCase();
        if (lowTrans.includes('stay on the line') || 
            lowTrans.includes('please hold') || 
            lowTrans.includes('hold please') || 
            lowTrans.includes('put you on hold') || 
            lowTrans.includes('one moment') || 
            lowTrans.includes('one minute') || 
            (lowTrans.includes('hold') && lowTrans.includes('interpreter'))) {
          requestHoldIntent();
        }

        const now = Date.now();
        const timeSinceLast = now - lastTranscriptTimeRef.current;
        lastTranscriptTimeRef.current = now;
        const isSilentBreak = timeSinceLast > 2500;

        updateCaptions(prev => {
          let last = prev[prev.length - 1];
          const lastText = (lang === 'en' ? last?.enFull : last?.esFull) || '';
          // New bubble only after silence or at stream start — sentence splits handled below
          const isNewTurn = isSilentBreak || !last;

          if (isNewTurn) {
            const lastCreationTime = last ? parseInt(last.id.split('-')[0]) : 0;
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
                enFinalized: '', enInterim: '', esFinalized: '', esInterim: '',
                turnId: currentTurnIdRef.current,
                turnWordCount: turnWordsBaseRef.current,
                isSplit: !isSilentBreak
              };
              prev = [...prev, last];
            }
          }

          const current = { ...last };
          const historyText = prev.slice(-4, -1).map(c => c.text || '').join(' ');
          const currentFinalized = (lang === 'en' ? current.enFinalized : current.esFinalized) || '';
          const baseContext = (historyText + ' ' + currentFinalized).trim();

          const cleaned = removeOverlapPreservingDigitSequences(baseContext, transcript);
          if (!cleaned.trim() && !isFinal) return prev; 

          if (isFinal) {
            if (lang === 'en') {
              current.enFinalized = hallucinationGuard((current.enFinalized + ' ' + cleaned).trim());
              current.enInterim = '';
            } else {
              current.esFinalized = hallucinationGuard((current.esFinalized + ' ' + cleaned).trim());
              current.esInterim = '';
            }
          } else {
            if (lang === 'en') current.enInterim = cleaned;
            else current.esInterim = cleaned;
          }

          const enFull = (current.enFinalized + ' ' + current.enInterim).trim();
          const esFull = (current.esFinalized + ' ' + current.esInterim).trim();
          const enW = enFull.split(/\s+/).filter(Boolean).length;
          const esW = esFull.split(/\s+/).filter(Boolean).length;
          
          let winner = 'en';
          if (esW >= enW + 2) winner = 'es';
          else if (enW >= esW + 2) winner = 'en';
          else winner = (confidence > 0.8 && esW > 0) ? 'es' : 'en';
          
          if (langModeRef.current !== 'auto') winner = langModeRef.current;

          // Non-doctor hold timer reset: reset only when English speech is detected.
          // Throttle to avoid spamming updates during interim packets.
          if (
            isCallDetectionEnabled &&
            winner === 'en' &&
            confidence > 0.4 &&
            transcript &&
            transcript.trim().length > 0 &&
            now - lastEnglishActivityPulseRef.current > 500
          ) {
            updateEnglishActivity();
            lastEnglishActivityPulseRef.current = now;
          }

          current.lang = winner;
          current.text = winner === 'en' ? enFull : esFull;
          current.enFull = enFull;
          current.esFull = esFull;
          current.isFinal = isFinal;
          const currentWords = current.text.split(/\s+/).filter(Boolean).length;
          current.turnId = current.turnId || currentTurnIdRef.current || `turn-${now}`;
          current.turnWordCount = turnWordsBaseRef.current + currentWords;

          let newArr = [...prev];
          newArr[newArr.length - 1] = current;

          // Finalize complete sentences, then comma-chunk long breathless runs
          if (isFinal && current.text?.trim()) {
            const { sentences, remainder: sentRemainder } = peelCompleteSentences(current.text);
            let sealedAll = [];
            let tailText = sentRemainder;

            if (sentences.length > 0) {
              let acc = turnWordsBaseRef.current;
              sealedAll = sentences.map((sent) => {
                const w = sent.trim().split(/\s+/).filter(Boolean).length;
                acc += w;
                return buildSealedBubble(sent, current, bubbleIdCounterRef, acc);
              });
              turnWordsBaseRef.current = acc;
            }

            if (tailText?.trim()) {
              const { sealed: commaSealed, remainder: commaRemainder } = peelCommaChunks(
                tailText,
                current,
                bubbleIdCounterRef,
                turnWordsBaseRef.current
              );
              if (commaSealed.length) {
                sealedAll = [...sealedAll, ...commaSealed];
                turnWordsBaseRef.current = commaSealed[commaSealed.length - 1].turnWordCount;
                tailText = commaRemainder;
              }
            }

            if (!sentences.length && !sealedAll.length && current.text?.trim()) {
              const { sealed: commaOnly, remainder: commaRemainder } = peelCommaChunks(
                current.text,
                current,
                bubbleIdCounterRef,
                turnWordsBaseRef.current
              );
              if (commaOnly.length) {
                sealedAll = commaOnly;
                turnWordsBaseRef.current = commaOnly[commaOnly.length - 1].turnWordCount;
                tailText = commaRemainder;
              }
            }

            if (sealedAll.length > 0) {
              newArr = [...prev.slice(0, -1), ...sealedAll];
              if (tailText?.trim()) {
                const lang = current.lang || 'en';
                const formatted = sealText(tailText, lang);
                newArr.push({
                  ...current,
                  id: `${Date.now()}-${++bubbleIdCounterRef.current}`,
                  turnId: current.turnId,
                  turnWordCount: turnWordsBaseRef.current,
                  text: formatted,
                  enFinalized: lang === 'en' ? formatted : '',
                  esFinalized: lang === 'es' ? formatted : '',
                  enInterim: lang === 'en' ? current.enInterim : '',
                  esInterim: lang === 'es' ? current.esInterim : '',
                  enFull: lang === 'en' ? `${formatted} ${current.enInterim || ''}`.trim() : current.enFull,
                  esFull: lang === 'es' ? `${formatted} ${current.esInterim || ''}`.trim() : current.esFull,
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
               if (lang === 'en') socketRefEn.current = createSocket('en');
               else socketRefEs.current = createSocket('es');
            }
          }, delay);
        }
      };
      ws.onerror = (e) => console.error(e);
      return ws;
    };

    socketRefEn.current = createSocket('en');
    socketRefEs.current = createSocket('es');
  }, [isCallDetectionEnabled, updateActivity, updateCaptions, requestHoldIntent]);

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    turnWordsBaseRef.current = 0;
    currentTurnIdRef.current = null;
    closeConnections();
    clearCaptions();
  }, [closeConnections, clearCaptions]);

  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  const bindStreamLifecycle = useCallback((stream, source) => {
    streamSourceRef.current = source;
    const onStreamEnded = () => {
      streamRef.current = null;
      streamSourceRef.current = null;
      stopRecordingRef.current();
    };
    if (source === 'tab') {
      const vt = stream.getVideoTracks()[0];
      if (vt) vt.onended = onStreamEnded;
      return;
    }
    stream.getAudioTracks().forEach((track) => {
      track.onended = onStreamEnded;
    });
  }, []);

  const beginStream = useCallback((stream, source) => {
    if (stream.getAudioTracks().length === 0) {
      setConnectionState('error');
      setConnectionMessage('No Audio Track');
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      return false;
    }
    streamRef.current = stream;
    isActiveRef.current = true;
    bindStreamLifecycle(stream, source);
    startDeepgram(stream);
    if (source === 'tab') {
      setTabStreamReady(true);
      try {
        sessionStorage.setItem(TAB_STREAM_READY_KEY, '1');
      } catch {}
    }
    return true;
  }, [bindStreamLifecycle, startDeepgram]);

  const startRecording = useCallback(async () => {
    try {
      setConnectionState('connecting');
      const useMic = micTestModeRef.current;
      const source = useMic ? 'mic' : 'tab';

      // REUSE EXISTING STREAM IF AVAILABLE AND ACTIVE (same source type)
      if (
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getAudioTracks().length > 0 &&
        streamSourceRef.current === source
      ) {
        setConnectionMessage(useMic ? 'Reusing Microphone...' : 'Reusing Tab Audio...');
        isActiveRef.current = true;
        startDeepgram(streamRef.current);
        return true;
      }

      setConnectionMessage(useMic ? 'Requesting Microphone...' : 'Requesting Tab Audio...');
      const stream = await acquireAudioStream(useMic);
      return beginStream(stream, source);
    } catch (err) {
      console.error(err);
      setConnectionState('error');
      setConnectionMessage(micTestModeRef.current ? 'Mic Access Denied' : 'Tab Share Cancelled');
      return false;
    }
  }, [beginStream, startDeepgram]);

  // Force re-open picker (tab) or re-request mic (double-tap connect).
  const startRecordingFresh = useCallback(async () => {
    try {
      const useMic = micTestModeRef.current;
      const source = useMic ? 'mic' : 'tab';
      setConnectionState('connecting');
      setConnectionMessage(useMic ? 'Requesting Microphone (fresh)...' : 'Requesting Tab Audio (fresh)...');

      closeConnections();
      stopStreamTracks();
      if (source === 'tab') {
        // Force "tab needs reconnect" UX until we successfully reacquire a stream.
        setTabStreamReady(false);
        try {
          sessionStorage.setItem(TAB_STREAM_READY_KEY, '0');
        } catch {}
      }

      setConnectionMessage(useMic ? 'Requesting Microphone...' : 'Requesting Tab Audio...');
      const stream = await acquireAudioStream(useMic);
      return beginStream(stream, source);
    } catch (err) {
      console.error(err);
      setConnectionState('error');
      setConnectionMessage(micTestModeRef.current ? 'Mic Access Denied' : 'Tab Share Cancelled');
      return false;
    }
  }, [beginStream, closeConnections, stopStreamTracks]);

  const reconnectStream = useCallback(() => {
    setConnectionState('connecting');
    reconnectAttemptsRef.current = 0; // Reset manual attempts
    closeConnections();
    setTimeout(() => {
      if (streamRef.current && isActiveRef.current) startDeepgram(streamRef.current);
      else {
        // If stream is dead, we need a full restart
        startRecording();
      }
    }, 400);
  }, [closeConnections, startDeepgram, startRecording]);

  const toggleLanguage = useCallback(() => {
    setSttLanguage(prev => {
      const next = prev === 'auto' ? 'en' : (prev === 'en' ? 'es' : 'auto');
      langModeRef.current = next;
      if (overrideTimeoutRef.current) clearTimeout(overrideTimeoutRef.current);
      if (next !== 'auto') {
        overrideTimeoutRef.current = setTimeout(() => {
          setSttLanguage('auto');
          langModeRef.current = 'auto';
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
    lastDataTime,
    micTestMode,
    setMicTestMode,
    tabStreamReady,
  };
};
