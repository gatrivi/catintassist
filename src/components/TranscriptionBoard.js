import React, { useEffect, useRef, useState } from 'react';

import { useTTS } from '../hooks/useTTS';
import { useTranslate } from '../hooks/useTranslate';
import { useSession, safeSet } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { ScrambleText } from './ScrambleText';

// EL TABLERO DE TEXTO: Aquí es donde aparece todo lo que dicen en la llamada.
// Muestra quién habla, lo traduce y te deja copiar los números con un clic.
const getBubbleStyle = (text, isCurrent, lang) => {
  if (!text) return {};
  const wordCount = text.trim().split(/\s+/).length;
  
  let baseBorder = lang === 'es' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)';
  let baseBg = lang === 'es' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(59, 130, 246, 0.03)';

  if (wordCount >= 40) {
    baseBorder = 'rgba(239, 68, 68, 0.6)';
    baseBg = 'rgba(239, 68, 68, 0.03)';
  } else if (wordCount >= 34) {
    baseBorder = 'rgba(245, 158, 11, 0.6)';
    baseBg = 'rgba(245, 158, 11, 0.03)';
  }

  return { borderLeft: `3px solid ${baseBorder}`, backgroundColor: baseBg };
};

const convertNumberWords = (text) => {
  const map = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
    'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
    'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
    'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
    'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
    'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
    'dieciseis': '16', 'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19', 'veinte': '20',
    'veintiuno': '21', 'veintidos': '22', 'veintitres': '23', 'veinticuatro': '24', 'veinticinco': '25',
    'veintiseis': '26', 'veintisiete': '27', 'veintiocho': '28', 'veintinueve': '29',
    'treinta': '30', 'cuarenta': '40', 'cincuenta': '50', 'sesenta': '60', 'setenta': '70', 'ochenta': '80', 'noventa': '90'
  };
  const keys = Object.keys(map).join('|');
  const re = new RegExp(`\\b(${keys})\\b`, 'gi');
  return text.replace(re, (matched) => map[matched.toLowerCase()] || matched);
};

const InteractiveText = ({ text, scramble = true }) => {
  if (!text) return null;
  // GROUP PHONE NUMBERS / SSN: If we see 9-12 digits read out singly (with spaces), join and format them.
  // Phone (10 digits) → XXX-XXX-XXXX | SSN (9 digits) → XXX-XX-XXXX | Other → just clean
  const groupedDigits = text.replace(/\b(\d[\s.,-:]*){9,12}\b/g, (m) => {
    const clean = m.replace(/[\s.,-:]+/g, '');
    if (clean.length === 10) return clean.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    if (clean.length === 9) return clean.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
    return clean;
  });
  const processedText = convertNumberWords(groupedDigits);
  
  // NYC ZIP REPAIR: In NYC, people often say "one hundred thirty four" for 10034.
  // Deepgram might transcribe "New York 134". We fix it to "New York 10034".
  const repairedText = processedText.replace(/\b(New York|NY|N\.Y\.)\s*,?\s*(\d{3})\b/gi, (m, city, zip) => {
    const suffix = zip.slice(-2);
    return `${city} 100${suffix}`;
  });

  // NÚMEROS MÁGICOS: Detectamos números de teléfono, años y códigos.
  // Los resaltamos para que puedas copiarlos rápido si haces clic.
  const numRegex = /(\+?\(?\d{1,4}?\)?[\s.-]?\(?\d{2,4}?\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b\d+[\d.,/\\-]*\b)/g;

  const parts = repairedText.split(numRegex);

  const handleCopy = (num) => {
    const clean = num.trim();
    if (!clean) return;
    navigator.clipboard.writeText(clean);
  };

  return (
    <>
      {parts.map((p, i) => {
        // STABLE KEYS: We use the bubble ID + part index + hash of content to ensure 
        // React doesn't reuse the wrong ScrambleText instance during unshifts.
        const partKey = `${i}-${p.length}`;
        if (p && p.match(numRegex)) {
          return (
            <span 
              key={partKey} 
              className="phone-number highlight-number" 
              onClick={(e) => { e.stopPropagation(); handleCopy(p); }} 
              title={`Click to copy number: ${p}`}
              style={{ cursor: 'copy', backgroundColor: 'rgba(252, 211, 77, 0.1)', color: '#fcd34d', padding: '0 2px', borderRadius: '2px', fontWeight: 600 }}
            >
              {scramble ? <ScrambleText value={p} duration={300} /> : p}
            </span>
          );
        }
        return scramble ? <ScrambleText key={partKey} value={p} duration={300} /> : <span key={partKey}>{p}</span>;
      })}
    </>
  );
};

const StatusProgress = ({ status }) => {
  const steps = ['translating', 'processing', 'ready'];
  const currentIndex = steps.indexOf(status === 'buffering' ? 'processing' : status);
  const labels = ['T', 'P', 'R'];
  const tooltips = [
    'Transcribing: Converting audio to text...',
    'Processing: Routing through translation engines...',
    'Ready: Translation delivered and ready for playback'
  ];
  
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', height: '6px', width: '100%', marginBottom: '4px' }}>
      {steps.map((step, i) => (
        <div 
          key={step} 
          title={tooltips[i]}
          className="status-bar-segment"
          style={{ 
            flex: 1, 
            height: '100%', 
            borderRadius: '1px',
            background: i <= currentIndex ? (step === 'ready' ? '#10b981' : '#3b82f6') : 'rgba(255,255,255,0.1)',
            boxShadow: (i === currentIndex && step !== 'ready') ? '0 0 4px #3b82f6' : 'none',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.4rem',
            color: 'rgba(255,255,255,0.8)',
            fontWeight: 900,
            cursor: 'help'
          }}
        >
          {labels[i]}
        </div>
      ))}
    </div>
  );
};

const TranslatedBubble = ({ id, text, lang, playTTS, stopTTS, playingUrl, prefetchTTS, reverse = false, ttsMode, wordCount, turnWordCount, shouldPrefetch, emphasisMode, isPinned, onTogglePin, isRedundantCount }) => {
  const { translationMood } = useSession();
  const { translation, audioUrl, engineStatus, targetLang } = useTranslate(text, lang, prefetchTTS, shouldPrefetch, translationMood);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    if (ttsMode === 'auto' && translation && audioUrl && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      playTTS(translation, targetLang, audioUrl);
    }
    if (!translation) hasAutoPlayedRef.current = false;
  }, [translation, ttsMode, playTTS, targetLang, audioUrl]);

  const isThisPlaying = playingUrl && audioUrl && playingUrl === audioUrl;
  const transcriptColor = emphasisMode === 'flipped' ? '#93c5fd' : '#ffffff';
  const translationColor = emphasisMode === 'flipped' ? '#bfdbfe' : 'rgba(255,255,255,0.85)';

  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem', flexDirection: reverse ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, textAlign: reverse ? 'right' : 'left', minWidth: 0 }}>
        <div style={{ color: transcriptColor, fontWeight: 400, lineHeight: 1.25, fontSize: '0.9rem', wordBreak: 'break-word' }}>
          <InteractiveText text={text} scramble={true} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', flexShrink: 0, marginTop: '2px' }}>
        <StatusProgress status={engineStatus} />
        {(!isRedundantCount && (turnWordCount || wordCount) > 0) && (
          <span 
            style={{ fontSize: '0.55rem', fontWeight: 700, color: (turnWordCount || wordCount) >= 40 ? 'var(--danger)' : (turnWordCount || wordCount) >= 34 ? '#f59e0b' : 'var(--text-muted)', marginBottom: '1px' }}
            title={turnWordCount ? `Current Turn: ${turnWordCount} words (Bubble: ${wordCount})` : ""}
          >
            {turnWordCount || wordCount}
          </span>
        )}
        <button 
          onClick={() => isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl)} 
          disabled={!isThisPlaying && (!translation || !audioUrl)}
          style={{ background: 'transparent', border: 'none', cursor: (!isThisPlaying && (!translation || !audioUrl)) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', padding: 0, opacity: (!isThisPlaying && (!translation || !audioUrl)) ? 0.3 : 1 }}
          title={isThisPlaying ? "Stop" : (!audioUrl ? "Engine working..." : "Play")}
        >
          🔊
        </button>
      </div>

      <div style={{ flex: 1, color: translationColor, textAlign: reverse ? 'left' : 'right', minWidth: 0 }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', lineHeight: 1.25, fontSize: '0.85rem', wordBreak: 'break-word' }}>
          {translation ? <InteractiveText text={translation} scramble={true} /> : <span style={{ opacity: 0.2 }}>...</span>}
        </div>
      </div>
    </div>
  );
};

export const TranscriptionBoard = ({ captions, onClearAll, onReconnect, lastDataTime }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const [ttsMode, setTtsMode] = useState('manual');
  const [emphasisMode, setEmphasisMode] = useState('original'); 
  const [pinnedIds, setPinnedIds] = useState(() => JSON.parse(localStorage.getItem('catint_pinned')) || []);
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();
  const { playWarningPing } = useProgressiveAudio();
  const { isActive, isZombieCall } = useSession();
  const warnedBubblesRef = useRef(new Set());
  
  const [popover, setPopover] = useState({ show: false, x: 0, y: 0, text: '' });
  const popoverTimerRef = useRef(null);

  useEffect(() => {
    safeSet('catint_pinned', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  const togglePin = (id) => {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (!isScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }

    const lastCap = captions[captions.length - 1];
    if (lastCap && lastCap.text) {
      const words = lastCap.text.trim().split(/\s+/).length;
      if (words >= 40 && !warnedBubblesRef.current.has(lastCap.id)) {
        playWarningPing();
        warnedBubblesRef.current.add(lastCap.id);
      }
    }
  }, [captions, playWarningPing]);

  const resetScrollTimer = () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrolledUpRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 15000); 
  };

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 35;
    if (isAtBottom) {
      isScrolledUpRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    } else {
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  const handleWheel = (e) => {
    if (e.deltaY < 0) {
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text && text.length < 50) {
        popoverTimerRef.current = setTimeout(() => {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPopover({ show: true, x: rect.left + window.scrollX, y: rect.top + window.scrollY - 40, text });
        }, 800);
      } else {
        if (popover.show) setPopover(p => ({ ...p, show: false }));
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
    };
  }, [popover.show]);

  const handleLookup = (text) => {
    const url = `https://www.linguee.com/english-spanish/search?source=auto&query=${encodeURIComponent(text)}`;
    window.open(url, 'LingueeLookup', 'width=800,height=600,scrollbars=yes');
    setPopover(p => ({ ...p, show: false }));
  };

  return (
    <div className="transcription-area" style={{ 
      position: 'relative', background: 'var(--panel-bg)', border: '1px solid #18181b', borderRadius: 0,
      display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      {popover.show && (
        <div style={{
          position: 'fixed', top: popover.y, left: popover.x, zIndex: 10000,
          background: 'var(--accent-primary)', color: '#000', padding: '4px 10px',
          borderRadius: 0, fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer'
        }} onClick={() => handleLookup(popover.text)}>
          LOOKUP: "{popover.text}"
        </div>
      )}

      {(!isActive && isZombieCall) && (
        <div 
          onClick={onReconnect}
          style={{
            position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1001,
            background: 'var(--danger)', color: '#fff', padding: '0.6rem',
            borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.8rem', cursor: 'pointer', fontWeight: 900, fontSize: '0.85rem',
            border: '1px solid #fff'
          }}
        >
          [!] ZOMBIE CALL: CLICK TO RE-ATTACH
        </div>
      )}

      <div 
        className="scroll-area" 
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '1rem' }} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={scrollAreaRef}
      >
        <div style={{ flex: '1 1 auto' }} />
        
        {captions.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              {isActive ? '> STANDBY_FOR_AUDIO...' : '> SYSTEM_IDLE'}
            </div>
          </div>
        )}

        {captions.map((cap, i) => {
          if (!cap.text || !cap.text.trim()) return null;
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          const isPinned = pinnedIds.includes(cap.id);
          const isSplitContinuation = isSameAsPrevious && wordCount < 50;
          
          return (
            <div key={cap.id || i} className="transcript-bubble" style={{ 
              opacity: cap.isFinal === false ? 0.6 : 1,
              marginTop: isSplitContinuation ? '0rem' : '0.4rem',
              padding: '0.4rem',
              position: 'relative',
              border: isPinned ? '1px solid var(--accent-primary)' : '1px solid transparent',
              background: isPinned ? 'rgba(34, 197, 94, 0.05)' : (getBubbleStyle(cap.text, cap.isFinal === false, cap.lang).backgroundColor),
              ...getBubbleStyle(cap.text, cap.isFinal === false, cap.lang)
            }}>
              {isPinned && (
                <div style={{ 
                  position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', 
                  fontSize: '0.5rem', background: 'var(--accent-primary)', color: '#000',
                  padding: '0 4px', fontWeight: 900, zIndex: 5
                }}>PINNED</div>
              )}
              
              <TranslatedBubble 
                id={cap.id} text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} 
                reverse={cap.lang === 'es'} ttsMode={ttsMode} wordCount={wordCount} turnWordCount={cap.turnWordCount} shouldPrefetch={i >= captions.length - 3} 
                emphasisMode={emphasisMode} isPinned={isPinned} onTogglePin={togglePin} 
                isRedundantCount={i > 0 && captions[i-1].turnWordCount === cap.turnWordCount}
              />
              
              <button 
                onClick={() => togglePin(cap.id)} 
                style={{ 
                  position: 'absolute', top: '2px', right: '2px', background: 'transparent', border: 'none',
                  fontSize: '0.6rem', cursor: 'pointer', opacity: isPinned ? 1 : 0.1, color: isPinned ? 'var(--accent-primary)' : '#fff'
                }}
              >
                [PIN]
              </button>
            </div>
          );
        })}
        <div id="scroll-bottom-anchor" ref={bottomRef} style={{ height: '24px', flexShrink: 0, pointerEvents: 'none' }} />
      </div>

      {/* Simplified Footer Toolbar */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px',
        borderTop: '1px solid #18181b', background: 'var(--panel-bg)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.65rem'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setEmphasisMode(m => m === 'original' ? 'flipped' : 'original')} style={{ background: 'transparent', color: emphasisMode === 'flipped' ? 'var(--accent-primary)' : '#fff', border: 'none', cursor: 'pointer' }}>
            MODE:{emphasisMode === 'flipped' ? 'TRSL' : 'SRC'}
          </button>
          <button onClick={() => setTtsMode(m => m === 'manual' ? 'auto' : 'manual')} style={{ background: 'transparent', color: ttsMode === 'auto' ? 'var(--accent-primary)' : '#fff', border: 'none', cursor: 'pointer' }}>
            TTS:{ttsMode === 'auto' ? 'AUTO' : 'OFF'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClearAll} style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>[CLEAR_LOG]</button>
          <button onClick={stopTTS} disabled={!isPlaying} style={{ background: 'transparent', color: isPlaying ? 'var(--danger)' : '#333', border: 'none', cursor: 'pointer' }}>[STOP_AI]</button>
        </div>
      </div>
    </div>
  );
};
