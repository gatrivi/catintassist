import { useState, useRef, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';
import { applyTranscriptFormatting, splitLongTextAtCommas } from '../utils/transcriptFormat';

const normalize = (s) => 
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric

// Number-word detection for EN and ES to protect phone/SSN/address data
const NUMBER_WORDS = new Set([
  'zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen',
  'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety',
  'hundred', 'thousand',
  'cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
  'once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve',
  'veinte','veintiuno','veintidos','veintitres','veinticuatro','veinticinco','veintiseis',
  'veintisiete','veintiocho','veintinueve','treinta','cuarenta','cincuenta','sesenta','setenta',
  'ochenta','noventa',
  'cien', 'ciento', 'mil'
]);

const normalizeWord = (w) =>
  w.toLowerCase().replace(/[^a-z0-9]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isNumberLike = (word) => {
  if (!word) return false;
  const norm = normalizeWord(word);
  return /^\d+$/.test(norm) || NUMBER_WORDS.has(norm);
};

const containsNumberSequence = (text, minLength = 2) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  let count = 0;
  let numberWords = 0;
  for (const w of words) {
    if (isNumberLike(w)) {
      count++;
      numberWords++;
      if (count >= minLength) return true;
    } else {
      count = 0;
    }
  }
  // Protect number-dense text (>30% number-like words)
  if (numberWords / words.length > 0.30) return true;
  return false;
};

const FILLER_WORDS = new Set(['um','uh','eh','ah','like','well','so','okay','ok','yeah','yep','nope','hmm','hm','bueno','pues','este','ees','ehm']);
const PHRASE_FILLERS = ['you know', 'i mean', 'sort of', 'kind of'];

const cleanFillerWords = (text) => {
  if (!text) return text;
  let t = text;
  // Strip common phrase fillers (case insensitive)
  PHRASE_FILLERS.forEach(phrase => {
    const re = new RegExp(`\\b${phrase}\\b`, 'gi');
    t = t.replace(re, '');
  });
  // Strip standalone filler words from the start of the string
  const words = t.trim().split(/\s+/);
  let startIdx = 0;
  while (startIdx < words.length && FILLER_WORDS.has(words[startIdx].toLowerCase().replace(/[^a-z]/g, ''))) {
    startIdx++;
  }
  if (startIdx > 0) {
    t = words.slice(startIdx).join(' ');
  }
  return t.replace(/\s+/g, ' ').trim();
};

const hallucinationGuard = (text) => {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
  
  // Noise filtering: skip isolated "bueno", "um", etc.
  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (isNumberLike(w)) return text; // Never filter single numbers
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
    
    // Protection: allow repeated numbers ("one one one", "2 2 2")
    if (norm === lastWord && norm.length > 1 && !isNumberLike(word)) continue; 
    if (pair === lastPair && pair.length > 4 && !containsNumberSequence(words.slice(i-1, i+1).join(' '))) continue;

    cleaned.push(word);
    lastWord = norm;
    lastPair = pair;
  }

  // Adaptive pruning: Only prune if it doesn't look like a valid list of data (numbers)
  // Lowered threshold to 2 consecutive number-words to protect phone numbers like "five five five"
  if (words.length > 15 && cleaned.length < words.length * 0.5 && !containsNumberSequence(text, 2)) {
     console.log('[PRUNED]', text, '→', cleaned.slice(0, 12).join(' '));
     return cleaned.slice(0, 12).join(' ') + "... [Stutter Pruned]";
  }

  return cleanFillerWords(cleaned.join(' '));
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

const removeOverlap = (base, addition) => {
  if (!base || !addition) return addition;
  
  // 1. WORD-WALK DEDUPLICATION (The "Toddler" logic: check if start of addition matches end of history)
  // This is position-aware and much safer than a global subset check.
  const bWords = base.trim().split(/\s+/).map(normalize);
  const aWords = addition.trim().split(/\s+/).map(normalize);
  const aWordsRaw = addition.trim().split(/\s+/);
  
  let bestOverlap = 0;
  const maxCheck = Math.min(aWords.length, bWords.length, 50);

  // We look for the longest possible overlap of words at the boundary
  for (let i = 1; i <= maxCheck; i++) {
    const aPrefix = aWords.slice(0, i).join('');
    const bSuffix = bWords.slice(-i).join('');
    if (aPrefix === bSuffix) {
      bestOverlap = i;
    }
  }

  // CRITICAL: Never strip digit sequences at chunk boundaries.
  // Phone numbers and SSNs straddling a boundary must not be lost.
  if (bestOverlap > 0) {
    const overlapSlice = aWordsRaw.slice(0, bestOverlap);
    const overlapText = overlapSlice.join(' ');
    console.log('[OVERLAP]', bestOverlap, 'words:', overlapText);
    if (/\d/.test(overlapText) || overlapSlice.some(isNumberLike)) {
      bestOverlap = 0;
    }
  }

  return aWordsRaw.slice(bestOverlap).join(' ');
};


export const useDeepgram = () => {
  const { updateActivity, isCallDetectionEnabled, requestHoldIntent, captions, updateCaptions, clearCaptions } = useSession();
  
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const [sttLanguage, setSttLanguage] = useState('auto');
  const [lastDataTime, setLastDataTime] = useState(0); 
  
  const langModeRef = useRef('auto');
  const socketRefEn = useRef(null);
  const socketRefEs = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());
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

          const cleaned = removeOverlap(baseContext, transcript);
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

  const startRecording = useCallback(async () => {
    try {
      setConnectionState('connecting');

      // REUSE EXISTING STREAM IF AVAILABLE AND ACTIVE
      if (streamRef.current && streamRef.current.active && streamRef.current.getAudioTracks().length > 0) {
        setConnectionMessage('Reusing Tab Audio...');
        isActiveRef.current = true;
        startDeepgram(streamRef.current);
        return true;
      }

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
      stream.getVideoTracks()[0].onended = () => {
         streamRef.current = null;
         stopRecording();
      };
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }, [startDeepgram, stopRecording]);

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

  return { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage, lastDataTime };
};
