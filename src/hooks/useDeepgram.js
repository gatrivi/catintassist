import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const hallucinationGuard = (text) => {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return text;

  let cleaned = [];
  let repeatCount = 0;
  let lastWord = '';

  for (let word of words) {
    const norm = normalize(word);
    const isNumber = /^\d+$/.test(norm);
    if (norm === lastWord && norm.length > 0 && !isNumber) {
      repeatCount++;
    } else {
      repeatCount = 0;
      lastWord = norm;
    }

    if (repeatCount < 2) { // Allow "word word", prune "word word word..."
      cleaned.push(word);
    }
  }

  // If the result is significantly shorter due to pruning, it was likely a stutter hallucination
  if (words.length > 15 && cleaned.length < words.length * 0.5) {
     return cleaned.slice(0, 10).join(' ') + "... [Stutter Pruned]";
  }

  return cleaned.join(' ');
};

const removeOverlap = (base, addition) => {
  if (!base || !addition) return addition;
  
  const normBase = normalize(base);
  const normAddition = normalize(addition);
  
  // 1. EXACT OR SUBSET MATCH: If addition is already fully contained in base, it's a duplicate
  if (normBase.includes(normAddition)) return '';

  const baseWords = base.trim().split(/\s+/);
  const additionWords = addition.trim().split(/\s+/);
  
  // 2. CLASSIC JUNCTION OVERLAP: Check if suffix of base matches prefix of addition
  // This is the most reliable way to join contiguous segments.
  for (let i = Math.min(baseWords.length, additionWords.length); i > 0; i--) {
    const baseSuffix = normalize(baseWords.slice(-i).join(''));
    const additionPrefix = normalize(additionWords.slice(0, i).join(''));
    
    if (baseSuffix === additionPrefix && baseSuffix.length > 0) {
      return additionWords.slice(i).join(' ');
    }
  }

  // 3. ROBUST PREFIX-IN-BODY MATCH: If addition starts with words found elsewhere in history
  // This catches cases where Deepgram re-sends a segment from the middle of a previous bubble.
  // We check prefixes of increasing length (at least 3 words or 12 chars).
  let maxPrefixIdx = 0;
  for (let i = 1; i <= additionWords.length; i++) {
    const prefix = normalize(additionWords.slice(0, i).join(''));
    if (prefix.length < 12 && i < 3) continue; // Minimum significance
    
    if (normBase.includes(prefix)) {
      maxPrefixIdx = i;
    } else {
      break; // Diverged
    }
  }

  if (maxPrefixIdx > 0) {
    return additionWords.slice(maxPrefixIdx).join(' ');
  }

  // 4. CHARACTER-BASED SLIDING WINDOW (Deepgram re-formatting fallback)
  const minOverlap = 15;
  const maxCheck = Math.min(normBase.length, normAddition.length);
  for (let i = maxCheck; i >= minOverlap; i--) {
    if (normBase.endsWith(normAddition.substring(0, i))) {
      let currentNormLen = 0;
      let splitIdx = 0;
      for (let j = 0; j < additionWords.length; j++) {
        currentNormLen += normalize(additionWords[j]).length;
        if (currentNormLen >= i) {
          splitIdx = j + 1;
          break;
        }
      }
      return additionWords.slice(splitIdx).join(' ');
    }
  }

  return addition;
};

export const useDeepgram = () => {
  const { updateActivity, isCallDetectionEnabled } = useSession();
  const [captions, setCaptions] = useState([]);
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

  const startDeepgram = (stream) => {
    const API_KEY = localStorage.getItem('DEEPGRAM_API_KEY') || process.env.REACT_APP_DEEPGRAM_API_KEY;
    if (!API_KEY || API_KEY.trim() === '' || API_KEY === 'your_deepgram_api_key_here') {
      alert("Deepgram API Key is missing! Please set it by clicking the Key icon in the header.");
      setConnectionState('error');
      setConnectionMessage('Missing API Key');
      return false;
    }

    setConnectionState('connecting');
    setConnectionMessage('Opening Dual WebSockets...');

    let socketsOpened = 0;

    const createSocket = (lang) => {
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=${lang}&interim_results=true&endpointing=300`, ['token', API_KEY]);
      
      ws.onopen = () => {
        socketsOpened++;
        if (socketsOpened === 2) {
          // Initialize recorder strictly when BOTH sockets are ready!
          setConnectionState('connected');
          setConnectionMessage('Dual Stream Ready');
          try {
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
              if (event.data.size > 0) {
                if (socketRefEn.current?.readyState === 1) socketRefEn.current.send(event.data);
                if (socketRefEs.current?.readyState === 1) socketRefEs.current.send(event.data);
              }
            });
            mediaRecorderRef.current.start(250);
          } catch(e) {
            console.error("Failed to start MediaRecorder:", e);
            setConnectionState('error');
            setConnectionMessage('Recorder Error');
          }
        }
      };

      ws.onmessage = (message) => {
        const received = JSON.parse(message.data);
        if (received.type === 'Error' || received.error) {
           console.error(`Deepgram ${lang} Error:`, received);
           return;
        }

        const alt = received.channel?.alternatives?.[0];
        const transcript = alt?.transcript;
        const confidence = alt?.confidence || 0;
        const isFinal = received.is_final;

        if (transcript && transcript.trim().length > 0) {
          const words = transcript.trim().split(/\s+/);
          // Stricter significance to filter out music lyrics/ambient noise
          const isSignificant = words.length >= 5 || (confidence > 0.9 && words.length >= 2);

          if (isSignificant && isCallDetectionEnabled) {
            updateActivity();
            setLastDataTime(Date.now());
          }

          const now = Date.now();
          const timeSinceLast = now - lastTranscriptTimeRef.current;
          lastTranscriptTimeRef.current = now;
          const isSilentBreak = timeSinceLast > 2000;
          const isMajorGap = timeSinceLast > 120000;

          setCaptions(prev => {
            // If it's a major gap and we already have some captions, clear them
            if (isMajorGap && prev.length > 0) {
              console.log("[Deepgram] Major silence gap detected (>120s). Clearing board.");
              turnWordCountRef.current = 0;
              return [];
            }
            
            let last = prev[prev.length - 1];
            const lastWordCount = (last && last.text) ? last.text.split(/\s+/).length : 0;
            
            // PRESERVE SENTENCE INTEGRITY: Split after 10 words IF there is a period/question/exclamation
            // This prevents cutting sentences in half. Hard cutoff remains at 80 for safety.
            const hasSentenceEnd = /[.!?]/.test(last?.text || '');
            const hasComma = /[,]/.test(last?.text || '');
            
            // Priority 1: 10 words + Sentence End
            // Priority 2: 25 words + Comma (softer break)
            // Priority 3: 80 words (Hard limit)
            const isNewTurn = isSilentBreak || 
                              (lastWordCount >= 10 && hasSentenceEnd) || 
                              (lastWordCount >= 25 && hasComma) ||
                              lastWordCount >= 80;

            if (!last || isNewTurn) {
              // FINALIZE PREVIOUS BUBBLE: If we are splitting, the previous one MUST be marked final
              // so the translation engine and UI treat it as a completed block.
              if (last) {
                last.isFinal = true;
                // Force word count update for the final state
                last.turnWordCount = turnWordCountRef.current + (last.text ? last.text.trim().split(/\s+/).length : 0);
              }

              // If this transcript is a full duplicate of the previous bubble, don't even create a new turn
              const prevB = prev[prev.length - 1];
              const prevText = lang === 'en' ? (prevB?.enFull || prevB?.text || '') : (prevB?.esFull || prevB?.text || '');
              if (normalize(prevText).includes(normalize(transcript))) {
                 return prev; 
              }

              if (isSilentBreak || !last) turnWordCountRef.current = 0;
              else {
                // If we split due to overflow (not silence), preserve the previous turn count
                const prevBubble = prev[prev.length - 1];
                if (prevBubble) turnWordCountRef.current = prevBubble.turnWordCount || 0;
              }
              
              last = { 
                id: `${Date.now()}-${++bubbleIdCounterRef.current}`, 
                enFinalized: '', enInterim: '', enConf: 0,
                esFinalized: '', esInterim: '', esConf: 0,
                turnWordCount: 0,
                isSplit: !isSilentBreak // Mark as split if not a silence break
              };
              prev = [...prev, last];
            }

            const current = { ...last };
            
            // Clean the transcript of any overlap with its own finalized text (internal dedupe)
            // If it's a new turn, we ALSO check against the PREVIOUS bubble's finalized text
            // Look back at the last 3 bubbles to catch cross-bubble repetitions
            const recentBubbles = prev.slice(-4, -1); // Current is at index length-1
            const baseContext = recentBubbles.map(b => lang === 'en' ? (b.enFinalized || b.enInterim || '') : (b.esFinalized || b.esInterim || '')).join(' ');
            
            // Internal Transcript Dedupe: Catch "evolving" fragments within the same incoming string
            // (e.g. "give you muscle relax Muscle relaxant" -> "give you muscle relaxant")
            const words = transcript.trim().split(/\s+/);
            if (words.length > 8) {
              const mid = Math.floor(words.length / 2);
              const head = words.slice(0, mid).join(' ');
              const tail = words.slice(mid).join(' ');
              const cleanedTail = removeOverlap(head, tail);
              transcript = (head + ' ' + cleanedTail).trim();
            }
            
            if (lang === 'en') {
              // Check overlap against BOTH current bubble's finalized text AND previous bubble's tail
              let cleanedTranscript = removeOverlap(baseContext + ' ' + (current.enFinalized || ''), transcript);
              cleanedTranscript = hallucinationGuard(cleanedTranscript);

              // Group 9-10 single digits back-to-back (phone numbers)
              cleanedTranscript = cleanedTranscript.replace(/\b(?:\d[\s.,\-:]*){8,11}\d+\b/g, m => m.replace(/[\s.,\-:]+/g, ''));
              
              if (!cleanedTranscript.trim()) return prev; // Avoid empty word bubbles

              if (isFinal) { 
                current.enFinalized = (current.enFinalized + ' ' + cleanedTranscript).trim(); 
                current.enInterim = ''; 
              } else { 
                current.enInterim = cleanedTranscript; 
              }
              if (confidence > 0) current.enConf = confidence; 
            } else {
              // Check overlap against BOTH current bubble's finalized text AND previous bubble's tail
              let cleanedTranscript = removeOverlap(baseContext + ' ' + (current.esFinalized || ''), transcript);
              cleanedTranscript = hallucinationGuard(cleanedTranscript);

              // Group 9-10 single digits back-to-back (phone numbers)
              cleanedTranscript = cleanedTranscript.replace(/\b(?:\d[\s.,\-:]*){8,11}\d+\b/g, m => m.replace(/[\s.,\-:]+/g, ''));

              if (!cleanedTranscript.trim()) return prev;

              if (isFinal) { 
                current.esFinalized = (current.esFinalized + ' ' + cleanedTranscript).trim(); 
                current.esInterim = ''; 
              } else { 
                current.esInterim = cleanedTranscript; 
              }
              if (confidence > 0) current.esConf = confidence;
            }

            // Derive winner
            const enFull = (current.enFinalized + ' ' + current.enInterim).trim();
            const esFull = (current.esFinalized + ' ' + current.esInterim).trim();
            
            const enWordCount = enFull.length > 0 ? enFull.split(/\s+/).length : 0;
            const esWordCount = esFull.length > 0 ? esFull.split(/\s+/).length : 0;
            
            let winnerLang = 'en'; // default
            
            // If one pipeline has significantly more transcribed words, trust it unconditionally. 
            // This prevents sparse hallucinations from hijacking the winning language.
            if (esWordCount >= enWordCount + 2) {
               winnerLang = 'es';
            } else if (enWordCount >= esWordCount + 2) {
               winnerLang = 'en';
            } else {
               // If word counts are tied or very close, fall back to the boosted confidence score comparison
               winnerLang = ((current.esConf * 1.25) > current.enConf && esWordCount > 0) ? 'es' : 'en';
            }
            
            if (langModeRef.current !== 'auto') {
               winnerLang = langModeRef.current;
            }
            
            current.lang = winnerLang;
            current.text = winnerLang === 'en' ? enFull : esFull;
            current.enFull = enFull;
            current.esFull = esFull;
            current.isFinal = isFinal; 
            
            // Calculate total turn words
            const currentBubbleWords = current.text.trim().split(/\s+/).filter(Boolean).length;
            current.turnWordCount = turnWordCountRef.current + currentBubbleWords;
            
            let newArr = [...prev];
            newArr[newArr.length - 1] = current;
            
            // Limit to 150 bubbles to prevent intense memory and DOM growth over long sessions
            if (newArr.length > 150) {
               newArr = newArr.slice(newArr.length - 150);
            }
            return newArr;
          });
        }
      };

      ws.onclose = (event) => {
        if (event.code === 1006 || event.code === 1001) {
          console.warn(`[Deepgram] Socket ${lang} closed unexpectedly (${event.code}).`);
          if (isActiveRef.current) {
            setConnectionMessage(`Reconnecting ${lang}...`);
            // Attempt auto-reconnect if still active
            setTimeout(() => {
              if (isActiveRef.current && streamRef.current) {
                console.log(`[Deepgram] Attempting auto-reconnect for ${lang}...`);
                if (lang === 'en') socketRefEn.current = createSocket('en');
                else socketRefEs.current = createSocket('es');
              }
            }, 2000);
          }
        } else if (event.code === 4000) {
           setConnectionState('error');
           setConnectionMessage('Connection Rejected (Check API Key)');
        }
      };
      
      return ws;
    };

    socketRefEn.current = createSocket('en');
    socketRefEs.current = createSocket('es');
  };

  // WATCHDOG: Check if sockets are still alive when we expect to be transcribing
  useEffect(() => {
    if (connectionState !== 'connected' || !isActiveRef.current) return;
    
    const watchdog = setInterval(() => {
      const enOpen = socketRefEn.current?.readyState === 1;
      const esOpen = socketRefEs.current?.readyState === 1;
      
      // If one is down but the other is up, try to fix the broken one
      if (!enOpen && isActiveRef.current && streamRef.current) {
        console.warn("[Deepgram] Watchdog: EN socket down. Reconnecting...");
        socketRefEn.current = startDeepgram(streamRef.current); // This is a bit recursive, better to just createSocket
      }
      
      if (!enOpen && !esOpen) {
        console.warn("[Deepgram] Watchdog: All sockets lost. Updating state.");
        setConnectionState('error');
        setConnectionMessage('Connection Timed Out - Reconnecting...');
        // Force a full zapping reconnect
        reconnectStream();
      }
    }, 15000); // Check every 15s
    
    return () => clearInterval(watchdog);
  }, [connectionState]);

  const startRecording = async () => {
    try {
      let stream = streamRef.current;
      
      // Check if existing stream is still active
      if (stream && stream.getTracks().some(track => track.readyState === 'ended')) {
        stream = null;
      }

      if (!stream) {
        setConnectionState('connecting');
        setConnectionMessage('Requesting Tab Audio...');
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        if (stream.getAudioTracks().length === 0) {
          alert("No audio track detected! You must check the 'Share tab audio' toggle when selecting the Chrome tab.");
          setConnectionState('error');
          setConnectionMessage('No audio track selected');
          stream.getTracks().forEach(track => track.stop());
          return false;
        }

        streamRef.current = stream;
        
        // Only attach onended when creating new stream
        stream.getVideoTracks()[0].onended = () => {
          stopRecording();
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        };
      }

      isActiveRef.current = true;
      startDeepgram(stream);
      return true;
    } catch (err) {
      console.error("Error capturing audio: ", err);
      return false;
    }
  };

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    closeConnections();
    setCaptions([]); // Clear transcript history after Call Ends
    // Intentionally NOT stopping tracks here so stream can be reused 
    // when clicking Connect again. Browser "Stop Sharing" handles actual track stop.
  }, [closeConnections]);

  const reconnectStream = useCallback(() => {
    setConnectionState('connecting');
    setConnectionMessage('Zapping WebSockets...');
    closeConnections();
    // Safety delay to allow sockets/recorder to fully clear
    setTimeout(() => {
      if (streamRef.current && isActiveRef.current) {
        startDeepgram(streamRef.current);
      } else {
        setConnectionState('disconnected');
        setConnectionMessage('Zap failed: No active stream');
      }
    }, 300);
  }, [closeConnections]);

  const clearCaptions = () => setCaptions([]);

  const toggleLanguage = () => {
    setSttLanguage(prev => {
      const next = prev === 'auto' ? 'en' : (prev === 'en' ? 'es' : 'auto');
      langModeRef.current = next;
      
      if (overrideTimeoutRef.current) clearTimeout(overrideTimeoutRef.current);
      
      if (next !== 'auto') {
        overrideTimeoutRef.current = setTimeout(() => {
          setSttLanguage('auto');
          langModeRef.current = 'auto';
        }, 30000); // Revert to auto after 30 seconds
      }
      
      return next;
    });
  };

  return { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage, lastDataTime };
};
