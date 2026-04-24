import { useState, useRef, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const hallucinationGuard = (text) => {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
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

  // 1. GLOBAL DUPLICATE CHECK
  if (normBase.includes(normAddition)) return '';

  const baseWords = base.trim().split(/\s+/);
  const addWords = addition.trim().split(/\s+/);

  // 2. THE SLIDING PIVOT (Word-based)
  // Finds the longest sequence of words at the START of addition that is a SUFFIX of the base.
  let pivotIdx = 0;
  const maxOverlap = Math.min(addWords.length, baseWords.length, 50);

  for (let i = 1; i <= maxOverlap; i++) {
    const head = normalize(addWords.slice(0, i).join(''));
    if (normBase.endsWith(head)) {
      pivotIdx = i;
    }
  }

  if (pivotIdx > 0) return addWords.slice(pivotIdx).join(' ');

  // 3. ANCHOR SEARCH (Correction handling)
  // If no suffix-prefix match found, search for a 3-word anchor anywhere in the recent context.
  if (addWords.length >= 3) {
    for (let i = 0; i <= Math.min(addWords.length - 3, 15); i++) {
      const anchor = normalize(addWords.slice(i, i + 3).join(''));
      const lastMatch = normBase.lastIndexOf(anchor);
      if (lastMatch !== -1 && lastMatch > normBase.length * 0.4) {
        // Recurse with a strictly smaller subset to guarantee termination
        return removeOverlap(base, addWords.slice(i + 1).join(' '));
      }
    }
  }

  // 4. FUZZY CHARACTER MATCH (Last Resort)
  const baseTailChar = normBase.slice(-15);
  const addHeadChar = normAddition.slice(0, 15);
  if (baseTailChar.includes(addHeadChar) || addHeadChar.includes(baseTailChar)) {
     for (let i = 15; i >= 6; i--) {
       const sub = normAddition.slice(0, i);
       if (normBase.endsWith(sub)) {
         let charLen = 0;
         for (let w = 0; w < addWords.length; w++) {
           charLen += normalize(addWords[w]).length;
           if (charLen >= i) return addWords.slice(w + 1).join(' ');
         }
       }
     }
  }

  return addition;
};

export const useDeepgram = () => {
  const { updateActivity, isCallDetectionEnabled } = useSession();
  const [captions, setCaptions] = useState([]);
  const captionsRef = useRef([]); // Critical sync for deduplication
  
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const [sttLanguage, setSttLanguage] = useState('auto');
  const [lastDataTime, setLastDataTime] = useState(Date.now());
  
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

        if (isCallDetectionEnabled) {
          updateActivity();
          setLastDataTime(Date.now());
        }

        const now = Date.now();
        const timeSinceLast = now - lastTranscriptTimeRef.current;
        lastTranscriptTimeRef.current = now;
        const isSilentBreak = timeSinceLast > 2500;

        updateCaptionsState(prev => {
          let last = prev[prev.length - 1];
          const lastText = (lang === 'en' ? last?.enFull : last?.esFull) || '';
          const lastWordCount = lastText.split(/\s+/).filter(Boolean).length;
          
          const hasSentenceEnd = /[.!?]/.test(lastText);
          const isNewTurn = isSilentBreak || !last || (lastWordCount >= 10 && hasSentenceEnd) || lastWordCount >= 80;

          if (isNewTurn) {
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

          const current = { ...last };
          // CORRECTED SLICE: prev.slice(-5) includes the most recent bubble. 
          // prev.slice(-5, -1) was skipping the immediate history!
          const historyText = prev.slice(-5).map(c => (lang === 'en' ? c.enFinalized : c.esFinalized)).join(' ');
          const baseContext = historyText + ' ' + (lang === 'en' ? current.enFinalized : current.esFinalized);

          if (isFinal) {
            const cleaned = removeOverlap(baseContext, transcript);
            if (lang === 'en') {
              current.enFinalized = hallucinationGuard((current.enFinalized + ' ' + cleaned).trim());
              current.enInterim = '';
            } else {
              current.esFinalized = hallucinationGuard((current.esFinalized + ' ' + cleaned).trim());
              current.esInterim = '';
            }
          } else {
            if (lang === 'en') current.enInterim = transcript;
            else current.esInterim = transcript;
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
          current.turnWordCount = turnWordCountRef.current + current.text.split(/\s+/).filter(Boolean).length;

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
  }, [isCallDetectionEnabled, updateActivity, updateCaptionsState]);

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
