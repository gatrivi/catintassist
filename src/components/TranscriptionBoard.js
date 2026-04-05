import React, { useEffect, useRef, useState } from 'react';

import { useTTS } from '../hooks/useTTS';
import { useTranslate } from '../hooks/useTranslate';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

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
    'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90'
  };
  return text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi, (matched) => map[matched.toLowerCase()] || matched);
};

const InteractiveText = ({ text }) => {
  if (!text) return null;
  const processedText = convertNumberWords(text);
  // NÚMEROS MÁGICOS: Detectamos números de teléfono, años y códigos.
  // Los resaltamos para que puedas copiarlos rápido si haces clic.
  const numRegex = /(\+?\(?\d{1,4}?\)?[\s.\-]?\(?\d{2,4}?\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4}|\b\d+[\d.,/\\\-]*\b)/g;

  const parts = processedText.split(numRegex);

  const handleCopy = (num) => {
    const clean = num.trim();
    if (!clean) return;
    navigator.clipboard.writeText(clean);
  };

  return (
    <>
      {parts.map((p, i) => {
        if (p && p.match(numRegex)) {
          return (
            <span 
              key={i} 
              className="phone-number highlight-number" 
              onClick={(e) => { e.stopPropagation(); handleCopy(p); }} 
              title={`Click to copy number: ${p}`}
              style={{ cursor: 'copy', backgroundColor: 'rgba(252, 211, 77, 0.1)', color: '#fcd34d', padding: '0 2px', borderRadius: '2px', fontWeight: 600 }}
            >
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
};

const StatusProgress = ({ status }) => {
  const steps = ['translating', 'buffering', 'ready'];
  const currentIndex = steps.indexOf(status);
  
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', height: '3px', width: '100%', marginBottom: '4px' }}>
      {steps.map((step, i) => (
        <div key={step} style={{ 
          flex: 1, 
          height: '100%', 
          borderRadius: '1px',
          background: i <= currentIndex ? (step === 'ready' ? '#10b981' : '#3b82f6') : 'rgba(255,255,255,0.1)',
          boxShadow: (i === currentIndex && step !== 'ready') ? '0 0 4px #3b82f6' : 'none',
          transition: 'all 0.3s'
        }} />
      ))}
    </div>
  );
};

const TranslatedBubble = ({ id, text, lang, playTTS, stopTTS, playingUrl, prefetchTTS, reverse = false, ttsMode, wordCount, shouldPrefetch, emphasisMode, isPinned, onTogglePin }) => {
  const { translation, audioUrl, isTranslating, engineStatus, targetLang } = useTranslate(text, lang, prefetchTTS, shouldPrefetch);
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
  const translationColor = emphasisMode === 'flipped' ? '#bfdbfe' : 'rgba(255,255,255,0.4)';

  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem', flexDirection: reverse ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, textAlign: reverse ? 'right' : 'left', minWidth: 0 }}>
        <div style={{ color: transcriptColor, fontWeight: 400, lineHeight: 1.25, fontSize: '0.9rem', wordBreak: 'break-word' }}>
          <InteractiveText text={text} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', flexShrink: 0, marginTop: '2px' }}>
        <button 
          onClick={() => onTogglePin(id)} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '0', opacity: isPinned ? 1 : 0.15, marginBottom: '2px' }}
          title={isPinned ? "Unpin" : "Pin"}
        >
          📌
        </button>
        <StatusProgress status={engineStatus} />
        <span style={{ fontSize: '0.55rem', fontWeight: 700, color: wordCount >= 40 ? 'var(--danger)' : wordCount >= 34 ? '#f59e0b' : 'var(--text-muted)', marginBottom: '1px' }}>{wordCount}</span>
        <button 
          onClick={() => isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl)} 
          disabled={!isThisPlaying && (!translation || !audioUrl)}
          style={{ background: 'transparent', border: 'none', cursor: (!isThisPlaying && (!translation || !audioUrl)) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', padding: 0, opacity: (!isThisPlaying && (!translation || !audioUrl)) ? 0.3 : 1 }}
          title={isThisPlaying ? "Stop" : (!audioUrl ? "Engine working..." : "Play")}
        >
          {isThisPlaying ? '🔊' : '🔊'}
        </button>
      </div>

      <div style={{ flex: 1, color: translationColor, textAlign: reverse ? 'left' : 'right', minWidth: 0 }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', lineHeight: 1.25, fontSize: '0.85rem', wordBreak: 'break-word' }}>
          {translation ? <InteractiveText text={translation} /> : <span style={{ opacity: 0.2 }}>...</span>}
        </div>
      </div>
    </div>
  );
};


export const TranscriptionBoard = ({ captions, onClear }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const [ttsMode, setTtsMode] = useState('manual');
  const [emphasisMode, setEmphasisMode] = useState('original'); 
  const [pinnedIds, setPinnedIds] = useState(() => JSON.parse(localStorage.getItem('catint_pinned')) || []);
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();
  const { playWarningPing } = useProgressiveAudio();
  const { isEditingScoreboard, visibleCards, toggleCard, isActive, isBreakActive, isToolbarVisible } = useSession();
  const warnedBubblesRef = useRef(new Set());
  
  const [popover, setPopover] = useState({ show: false, x: 0, y: 0, text: '' });
  const popoverTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('catint_pinned', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  const togglePin = (id) => {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (!isScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 10;
    
    if (isAtBottom) {
      isScrolledUpRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    } else {
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  const handleWheel = (e) => {
    isScrolledUpRef.current = true;
    resetScrollTimer();
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
      
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text && text.length < 50) { // Limit to words/short phrases
        popoverTimerRef.current = setTimeout(() => {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPopover({
            show: true,
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 40,
            text
          });
        }, 800); // Wait 800ms
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
    <div className="glass-panel transcription-area" style={{ position: 'relative' }}>
      {popover.show && (
        <div style={{
          position: 'fixed',
          top: popover.y,
          left: popover.x,
          zIndex: 10000,
          background: '#3b82f6',
          color: 'white',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          animation: 'fadeSlideIn 0.2s ease-out'
        }} onClick={() => handleLookup(popover.text)}>
          🔍 Look up "{popover.text}"
        </div>
      )}

      {isToolbarVisible && (isEditingScoreboard || visibleCards.transcription) && (
      <div className="notepad-header transcription-toolbar" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.4rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', opacity: (!visibleCards.transcription && isEditingScoreboard) ? 0.3 : 1, position: 'relative' }}>
        {isEditingScoreboard && <input type="checkbox" checked={visibleCards.transcription} onChange={() => toggleCard('transcription')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: isEditingScoreboard ? '1.5rem' : '0' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Livestream 
          </h2>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button 
              onClick={() => setEmphasisMode(m => m === 'original' ? 'flipped' : 'original')}
              className="btn"
              style={{
                background: emphasisMode === 'flipped' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                color: emphasisMode === 'flipped' ? '#93c5fd' : 'var(--text-muted)',
                border: emphasisMode === 'flipped' ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--panel-border)',
                padding: '0.2rem 0.5rem',
                fontSize: '0.7rem'
              }}
              title="Toggle text emphasis: original (white) vs translation-first (blue)"
            >
              {emphasisMode === 'flipped' ? '🔵 Transl. Focus' : '⚪ Source Focus'}
            </button>
            <button
              onClick={() => setTtsMode(m => m === 'manual' ? 'auto' : 'manual')}
              className="btn" 
              style={{ 
                background: ttsMode === 'auto' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', 
                color: ttsMode === 'auto' ? '#10b981' : 'var(--text-muted)', 
                border: ttsMode === 'auto' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--panel-border)',
                boxShadow: ttsMode === 'auto' ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'none',
                padding: '0.2rem 0.5rem', 
                fontSize: '0.7rem' 
              }}
              title="Toggle Auto TTS Mode"
            >
              {ttsMode === 'auto' ? '🤖 Auto AI' : '⚙️ Auto OFF'}
            </button>
            <button 
              onClick={stopTTS} 
              className="btn" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', opacity: isPlaying ? 1 : 0.5 }}
              disabled={!isPlaying}
            >
              🛑 Stop AI
            </button>
            {onClear && (
              <button onClick={onClear} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--panel-border)', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                🗑️ Clear
              </button>
            )}
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.6, marginLeft: '0.2rem' }} title="Translating long bubbles over 40 words is not recommended. Turns orange at 34 words.">
              ⚠️ 40 words limit
            </span>
          </div>
        </div>
      </div>
      )}
      <div 
        className="scroll-area" 
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={scrollAreaRef}
        title="Selecting any word will show a dictionary popover after a brief moment"
      >
        <div style={{ flex: '1 1 auto' }} />
        
        {/* Pinned Reference Section REMOVED - Pins now highlight in-place */}

        {captions.length === 0 && (
          <div style={{ 
            color: isActive ? 'var(--text-muted)' : (isBreakActive ? '#fb923c' : '#ef4444'), 
            fontStyle: 'italic', 
            fontWeight: isActive ? 400 : 700, 
            textAlign: 'center', 
            marginBottom: '20vh',
            animation: (!isActive && !isBreakActive) ? 'pulseWarning 2s infinite' : 'none',
            opacity: isBreakActive ? 0.8 : 1
          }}>
            {isActive ? 'Livestream audio capture active... waiting for speech.' : 
             (isBreakActive ? '⏸️ You are currently on Break. Timer is ticking, get some rest!' : 
             '⚠️ You are OFFLINE. Press Connect above to start capturing audio!')}
          </div>
        )}
        {captions.map((cap, i) => {
          if (!cap.text || !cap.text.trim()) return null;
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          const isPinned = pinnedIds.includes(cap.id);
          const isSplitContinuation = isSameAsPrevious && wordCount < 50; // Simple heuristic for split segments
          
          return (
            <div key={cap.id || i} className="transcript-bubble" style={{ 
              opacity: cap.isFinal === false ? 0.8 : 1,
              marginTop: isSplitContinuation ? '0rem' : '0.1rem',
              padding: '0rem',
              position: 'relative',
              border: isPinned ? '2px solid #3b82f6' : 'none',
              borderRadius: isPinned ? '8px' : '6px',
              backgroundColor: isPinned ? 'rgba(59, 130, 246, 0.08)' : (getBubbleStyle(cap.text, cap.isFinal === false, cap.lang).backgroundColor),
              boxShadow: isPinned ? '0 0 15px rgba(59, 130, 246, 0.2)' : 'none',
              ...getBubbleStyle(cap.text, cap.isFinal === false, cap.lang)
            }}>
              {(!isSameAsPrevious && !cap.isSplit) && (
                <div style={{ position: 'absolute', top: '2px', left: '4px', zIndex: 5, pointerEvents: 'none' }}>
                  <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 900 }}>
                    {cap.lang === 'es' ? 'SPA' : 'ENG'}
                  </span>
                </div>
              )}
              <TranslatedBubble 
                id={cap.id} text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} 
                reverse={cap.lang === 'es'} ttsMode={ttsMode} wordCount={wordCount} shouldPrefetch={i >= captions.length - 3} 
                emphasisMode={emphasisMode} isPinned={isPinned} onTogglePin={togglePin} 
              />
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '24px', flexShrink: 0 }} />
      </div>
    </div>
  );
};
