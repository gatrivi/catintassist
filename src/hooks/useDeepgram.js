import { useState, useRef, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';

const normalize = (s) => 
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric


const hallucinationGuard = (text) => {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
  
  // Noise filtering: skip isolated "bueno", "um", etc.
  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (w === 'bueno' || w === 'um' || w === 'eh' || w === 'uh' || w === 'ah') return '';
  }
  
  if (words.length < 2) return text;

  let cleaned = [];
  let lastWord = '';
  let lastPair = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const norm = normalize(word);
    const pair = i > 0 ? normalize(words[i-1] + word) : '';
    
    if (norm === lastWord && norm.length > 1 && !/^\d+$/.test(norm)) continue; 
    if (pair === lastPair && pair.length > 4) continue;

    cleaned.push(word);
    lastWord = norm;
    lastPair = pair;
  }

  if (words.length > 15 && cleaned.length < words.length * 0.6) {
     return cleaned.slice(0, 12).join(' ') + "... [Stutter Pruned]";
  }

  return cleaned.join(' ');
};

const removeOverlap = (base, addition) => {
  if (!base || !addition) return addition;
  
  const normBase = normalize(base);
  const normAddition = normalize(addition);

  // 1. EXACT SUBSET CHECK
  if (normBase.includes(normAddition)) return '';
  
  // 2. WORD-WALK DEDUPLICATION (The "Toddler" logic: check if start of addition matches end of history)
  const bWords = base.trim().split(/\s+/).map(normalize);
  const aWords = addition.trim().split(/\s+/).map(normalize);
  const aWordsRaw = addition.trim().split(/\s+/);
  
  let bestOverlap = 0;
  const maxCheck = Math.min(aWords.length, bWords.length, 50);

  // We look for the longest possible overlap of words
  for (let i = 1; i <= maxCheck; i++) {
    const aPrefix = aWords.slice(0, i).join('');
    const bSuffix = bWords.slice(-i).join('');
    if (aPrefix === bSuffix) {
      bestOverlap = i;
    }
  }

  return aWordsRaw.slice(bestOverlap).join(' ');
};


export const useDeepgram = () => {
  const { updateActivity, isCallDetectionEnabled, requestHoldIntent } = useSession();
  const [captions, setCaptions] = useState([]);
  const captionsRef = useRef([]); // Critical sync for deduplication
  
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const [sttLanguage, setSttLanguage] = useState('auto');
  const [lastDataTime, setLastDataTime] = useState(0); // FIXED: Initialize to 0 so it doesn't trigger 'Call Detected' alert on refresh
  
  const langModeRef = useRef('auto');
  const socketRefEn = useRef(null);
  const socketRefEs = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());
  const turnWordCountRef = useRef(0);
  const bubbleIdCounterRef = useRef(0);
  const overrideTimeoutRef = useRef(null);

  // Sync state and ref
  const updateCaptionsState = useCallback((newCapsOrFn) => {
    setCaptions(prev => {
      const next = typeof newCapsOrFn === 'function' ? newCapsOrFn(prev) : newCapsOrFn;
      captionsRef.current = next;
      return next;
    });
  }, []);

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
        if (socketRefEn.current?.readyState === 1 && socketRefEs.current?.readyState === 1) {
          setConnectionState('connected');
          setConnectionMessage('Live');
          try {
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.addEventListener('dataavailable', (e) => {
              if (e.data.size > 0) {
                if (socketRefEn.current?.readyState === 1) socketRefEn.current.send(e.data);
                if (socketRefEs.current?.readyState === 1) socketRefEs.current.send(e.data);
              }
            });
            mediaRecorderRef.current.start(250);
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

        // Filter out noise/hallucinations (confidence > 0.4) to ensure only real speech 
        // from the tab updates the activity metrics.
        if (isCallDetectionEnabled && confidence > 0.4) {
          updateActivity();
          setLastDataTime(Date.now());
        }

        // SMART HOLD PHRASE DETECTION
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

        updateCaptionsState(prev => {
          let last = prev[prev.length - 1];
          const lastText = (lang === 'en' ? last?.enFull : last?.esFull) || '';
          const lastWords = lastText.trim().split(/\s+/).filter(Boolean);
          const lastWordCount = lastWords.length;
          
          // Only split on punctuation if it's at the very end of the text (prevents splits on "Okay. So...")
          const hasSentenceEnd = /[.!?]\s*$/.test(lastText); 
          const isNewTurn = isSilentBreak || !last || (lastWordCount >= 10 && hasSentenceEnd) || lastWordCount >= 80;

          if (isNewTurn) {
            // Only finalize if we haven't already created a bubble for this exact moment (debounce)
            const lastCreationTime = last ? parseInt(last.id.split('-')[0]) : 0;
            if (now - lastCreationTime < 400 && !isSilentBreak) {
              // Skip redundant split
            } else {
              if (last) turnWordCountRef.current += lastWordCount;
              if (isSilentBreak || !last) turnWordCountRef.current = 0;
              
              last = {
                id: `${Date.now()}-${++bubbleIdCounterRef.current}`,
                enFinalized: '', enInterim: '', esFinalized: '', esInterim: '',
                turnWordCount: turnWordCountRef.current,
                isSplit: !isSilentBreak
              };
              prev = [...prev, last];
            }
          }

          const current = { ...last };
          // AGGRESSIVE DEDUPLICATION: Look at the last 3 bubbles for any overlap
          const historyText = prev.slice(-4, -1).map(c => c.text || '').join(' ');
          const currentFinalized = (lang === 'en' ? current.enFinalized : current.esFinalized) || '';
          const baseContext = (historyText + ' ' + currentFinalized).trim();

          const cleaned = removeOverlap(baseContext, transcript);
          if (!cleaned.trim() && !isFinal) return prev; // Ignore empty interim updates

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

          // Winner logic
          const enFull = (current.enFinalized + ' ' + current.enInterim).trim();
          const esFull = (current.esFinalized + ' ' + current.esInterim).trim();
          const enW = enFull.split(/\s+/).filter(Boolean).length;
          const esW = esFull.split(/\s+/).filter(Boolean).length;
          
          let winner = 'en';
          if (esW >= enW + 2) winner = 'es';
          else if (enW >= esW + 2) winner = 'en';
          else winner = (confidence > 0.8 && esW > 0) ? 'es' : 'en';
          
          if (langModeRef.current !== 'auto') winner = langModeRef.current;

          current.lang = winner;
          current.text = winner === 'en' ? enFull : esFull;
          current.enFull = enFull;
          current.esFull = esFull;
          current.isFinal = isFinal;
          // Important: Recalculate word count precisely
          const currentWords = current.text.split(/\s+/).filter(Boolean).length;
          current.turnWordCount = turnWordCountRef.current + currentWords;

          const newArr = [...prev];
          newArr[newArr.length - 1] = current;
          return newArr.slice(-150);
        });
      };

      ws.onclose = () => console.log(`[Deepgram] ${lang} Close`);
      ws.onerror = (e) => console.error(e);
      return ws;
    };

    socketRefEn.current = createSocket('en');
    socketRefEs.current = createSocket('es');
  }, [isCallDetectionEnabled, updateActivity, updateCaptionsState, requestHoldIntent]);

  const startRecording = async () => {
    try {
      setConnectionState('connecting');
      setConnectionMessage('Requesting Tab Audio...');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (stream.getAudioTracks().length === 0) {
        setConnectionState('error');
        setConnectionMessage('No Audio Track');
        return false;
      }
      streamRef.current = stream;
      isActiveRef.current = true;
      startDeepgram(stream);
      stream.getVideoTracks()[0].onended = () => stopRecording();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    if (streamRef.current) {
      // FIXED: Stop all tracks to release the browser 'Sharing Tab' indicator and stop audio processing
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    closeConnections();
    setCaptions([]);
    captionsRef.current = [];
  }, [closeConnections]);

  const reconnectStream = useCallback(() => {
    setConnectionState('connecting');
    closeConnections();
    setTimeout(() => {
      if (streamRef.current && isActiveRef.current) startDeepgram(streamRef.current);
    }, 400);
  }, [closeConnections, startDeepgram]);

  const clearCaptions = () => {
    setCaptions([]);
    captionsRef.current = [];
  };

  const toggleLanguage = () => {
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
  };

  return { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage, lastDataTime };
};
