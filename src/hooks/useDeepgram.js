import { useState, useRef, useCallback } from 'react';

// Helper to remove overlapping prefix from a new string based on a base string
// Example: base="Hello world", addition="world how are you" -> returns "how are you"
const removeOverlap = (base, addition) => {
  if (!base || !addition) return addition;
  const baseWords = base.trim().split(/\s+/);
  const additionWords = addition.trim().split(/\s+/);
  
  // Look for the longest suffix of base that matches prefix of addition
  for (let i = Math.min(baseWords.length, additionWords.length); i > 0; i--) {
    const baseSuffix = baseWords.slice(-i).join(' ').toLowerCase();
    const additionPrefix = additionWords.slice(0, i).join(' ').toLowerCase();
    // Use simple string comparison but normalize. We could also use fuzzy but let's keep it simple as requested.
    if (baseSuffix === additionPrefix) {
      return additionWords.slice(i).join(' ');
    }
  }
  return addition;
};

export const useDeepgram = () => {
  const [captions, setCaptions] = useState([]);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const [sttLanguage, setSttLanguage] = useState('auto');
  const langModeRef = useRef('auto');
  const socketRefEn = useRef(null);
  const socketRefEs = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());
  const overrideTimeoutRef = useRef(null);

  const closeConnections = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (socketRefEn.current) { socketRefEn.current.close(); socketRefEn.current = null; }
    if (socketRefEs.current) { socketRefEs.current.close(); socketRefEs.current = null; }
    setConnectionState('disconnected');
    setConnectionMessage('Disconnected');
  };

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
          mediaRecorderRef.current = new MediaRecorder(stream);
          mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0) {
              if (socketRefEn.current?.readyState === 1) socketRefEn.current.send(event.data);
              if (socketRefEs.current?.readyState === 1) socketRefEs.current.send(event.data);
            }
          });
          mediaRecorderRef.current.start(250);
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

        if (transcript) {
          const now = Date.now();
          const timeSinceLast = now - lastTranscriptTimeRef.current;
          lastTranscriptTimeRef.current = now;
          // Break into a new bubble if there's >1.0s of silence (a breath). 
          // We removed the forced 25-word chunking because forcing a new bubble while the slower pipeline 
          // is still emitting interims causes it to dump its residual buffer into the new bubble, creating duplicate sentences!
          const isSilentBreak = timeSinceLast > 1000;

          setCaptions(prev => {
            const isNewTurn = isSilentBreak;

            let last = prev[prev.length - 1];
            if (!last || isNewTurn) {
              last = { 
                id: Date.now(), 
                enFinalized: '', enInterim: '', enConf: 0,
                esFinalized: '', esInterim: '', esConf: 0,
              };
              prev = [...prev, last];
            }

            const current = { ...last };
            
            // Clean the transcript of any overlap with its own finalized text (internal dedupe)
            // If it's a new turn, we ALSO check against the PREVIOUS bubble's finalized text
            const prevBubbleText = isNewTurn ? (prev[prev.length - 2]?.text || '') : '';
            
            if (lang === 'en') {
              const cleanedTranscript = removeOverlap(current.enFinalized || prevBubbleText, transcript);
              if (!cleanedTranscript.trim()) return prev; // Avoid empty word bubbles

              if (isFinal) { 
                current.enFinalized = (current.enFinalized + ' ' + cleanedTranscript).trim(); 
                current.enInterim = ''; 
              } else { 
                current.enInterim = cleanedTranscript; 
              }
              if (confidence > 0) current.enConf = confidence; 
            } else {
              const cleanedTranscript = removeOverlap(current.esFinalized || prevBubbleText, transcript);
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
            current.isFinal = false; // We just keep updating styles actively
            
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
        if (event.code === 1006) {
          setConnectionState('error');
          setConnectionMessage('Connection Rejected (Check API Key)');
        }
      };
      
      return ws;
    };

    socketRefEn.current = createSocket('en');
    socketRefEs.current = createSocket('es');
  };

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
  }, []);

  const reconnectStream = useCallback(() => {
    closeConnections();
    if (streamRef.current) {
      setConnectionState('connecting');
      setConnectionMessage('Zapping WebSockets...');
      startDeepgram(streamRef.current);
    }
  }, []);

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

  return { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage };
};
