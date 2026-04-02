import React, { useEffect, useRef, useState } from 'react';

import { useTTS } from '../hooks/useTTS';
import { useTranslate } from '../hooks/useTranslate';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

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

const InteractiveText = ({ text }) => {
  if (!text) return null;
  // Matches (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 555 555 5555, +15555555555
  // Also 7 digits like 555-4444 or 555 4444
  const phoneRegex = /(\+?\(?\d{1,4}?\)?[\s.\-]?\(?\d{2,4}?\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4})/g;

  const parts = text.split(phoneRegex);

  const handleCopy = (num) => {
    navigator.clipboard.writeText(num.trim());
  };

  return (
    <>
      {parts.map((p, i) => {
        if (p.match(phoneRegex)) {
          return (
            <span 
              key={i} 
              className="phone-number" 
              onClick={(e) => { e.stopPropagation(); handleCopy(p); }} 
              title="Click to copy phone number"
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

const TranslatedBubble = ({ text, lang, playTTS, stopTTS, playingUrl, prefetchTTS, reverse = false, ttsMode, wordCount, shouldPrefetch, emphasisMode }) => {
  const { translation, audioUrl, isTranslating, targetLang } = useTranslate(text, lang, prefetchTTS, shouldPrefetch);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    // Only autoplay if it hasn't played this exact string yet, it's not empty, and mode is auto
    if (ttsMode === 'auto' && translation && audioUrl && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      playTTS(translation, targetLang, audioUrl);
    }
    if (!translation) {
      hasAutoPlayedRef.current = false; // Reset if text was cleared
    }
  }, [translation, ttsMode, playTTS, targetLang, audioUrl]);

  const isThisPlaying = playingUrl && audioUrl && playingUrl === audioUrl;

  // Color logic: 'original' = white text / gray translation; 'flipped' = deep blue text / light blue translation
  const transcriptColor = emphasisMode === 'flipped' ? '#93c5fd' : '#ffffff';
  const translationColor = emphasisMode === 'flipped' ? '#bfdbfe' : 'rgba(255,255,255,0.4)';

  return (
    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.1rem', flexDirection: reverse ? 'row-reverse' : 'row', alignItems: 'center' }}>
      <div style={{ flex: 1, textAlign: reverse ? 'right' : 'left' }}>
        <div style={{ color: transcriptColor, fontWeight: emphasisMode === 'flipped' ? 400 : 400, lineHeight: 1.3, fontSize: '0.9rem' }}>
          <InteractiveText text={text} />
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '0 0.5rem',
        opacity: 0.6
      }}>
        <span style={{ 
          fontSize: '0.65rem', 
          fontWeight: 700, 
          color: wordCount >= 40 ? 'var(--danger)' : wordCount >= 34 ? '#f59e0b' : 'var(--text-muted)'
        }}>
          {wordCount}
        </span>
        <button 
          onClick={() => isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl)} 
          disabled={!isThisPlaying && (!translation || !audioUrl)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: (!isThisPlaying && (!translation || !audioUrl)) ? 'not-allowed' : 'pointer',
            fontSize: '1.2rem',
            padding: 0,
            opacity: (!isThisPlaying && (!translation || !audioUrl)) ? 0.3 : 1
          }}
          title={isThisPlaying ? "Stop TTS" : (!audioUrl ? "Buffering audio..." : "Play Translation (TTS)")}
        >
          {isThisPlaying ? '⏹️' : '🔊'}
        </button>
      </div>

      <div style={{ 
        flex: 1, 
        color: translationColor,
        textAlign: reverse ? 'left' : 'right'
      }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', lineHeight: 1.3, fontSize: '0.85rem' }}>
          {translation ? <InteractiveText text={translation} /> : <span style={{ opacity: 0.2 }}>...</span>}
        </div>
      </div>
    </div>
  );
};

export const TranscriptionBoard = ({ captions, onClear, isToolsOpen, onToggleTools }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const [ttsMode, setTtsMode] = useState('manual');
  const [emphasisMode, setEmphasisMode] = useState('original'); // 'original' | 'flipped'
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();
  const { playWarningPing } = useProgressiveAudio();
  const { isEditingScoreboard, visibleCards, toggleCard, isActive, isBreakActive } = useSession();
  const warnedBubblesRef = useRef(new Set());

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
    }, 15000); // Resume auto-scroll after 15 seconds of inactivity to allow thorough reading
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
    // If they scroll, INSTANTLY consider it scrolled up / reset timer
    isScrolledUpRef.current = true;
    resetScrollTimer();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handleDoubleClick = () => {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      const url = `https://www.linguee.com/english-spanish/search?source=auto&query=${encodeURIComponent(selection)}`;
      window.open(url, 'LingueeLookup', 'width=800,height=600,scrollbars=yes');
    }
  };

  return (
    <div className="glass-panel transcription-area">
      {(isEditingScoreboard || visibleCards.transcription) && (
      <div className="notepad-header transcription-toolbar" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.4rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', opacity: (!visibleCards.transcription && isEditingScoreboard) ? 0.3 : 1, position: 'relative' }}>
        {isEditingScoreboard && <input type="checkbox" checked={visibleCards.transcription} onChange={() => toggleCard('transcription')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: isEditingScoreboard ? '1.5rem' : '0' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Livestream 
            <button onClick={onToggleTools} className="btn" style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }} title="Toggle Soundboard and Notes">
              {isToolsOpen ? '▶ Hide Tools' : '◀ Show Tools'}
            </button>
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
        onDoubleClick={handleDoubleClick} 
        title="Double-click any word to instantly translate it via Linguee"
      >
        <div style={{ flex: '1 1 auto' }} />
        
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
        {captions.reduce((acc, cap, i) => {
          if (!cap.text || !cap.text.trim()) return acc;
          const words = cap.text.trim().split(/\s+/);
          // 55 words is around 5 visual lines on a desktop transcription area
          if (words.length > 55) {
             const mid = Math.ceil(words.length / 2);
             acc.push({ ...cap, text: words.slice(0, mid).join(' '), id: `${cap.id || i}-a`, isSplit: true });
             acc.push({ ...cap, text: words.slice(mid).join(' '), id: `${cap.id || i}-b`, isSplit: true });
          } else {
             acc.push(cap);
          }
          return acc;
        }, []).map((cap, i, flattened) => {
          if (!cap.text || !cap.text.trim()) return null;
          const isSameAsPrevious = i > 0 && flattened[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          
          return (
            <div key={cap.id || i} className="transcript-bubble" style={{ 
              opacity: cap.isFinal === false ? 0.8 : 1,
              marginTop: (isSameAsPrevious || cap.isSplit) ? '0rem' : '0.4rem',
              padding: '0.1rem 0',
              ...getBubbleStyle(cap.text, cap.isFinal === false, cap.lang)
            }}>
              {(!isSameAsPrevious && !cap.isSplit) && (
                <div style={{ display: 'flex', marginBottom: '0.1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {cap.lang === 'es' ? 'Spanish' : 'English'}
                  </span>
                </div>
              )}
              <TranslatedBubble text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} reverse={cap.lang === 'es'} ttsMode={ttsMode} wordCount={wordCount} shouldPrefetch={i >= flattened.length - 3} emphasisMode={emphasisMode} />
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '60px', flexShrink: 0 }} />
      </div>
    </div>
  );
};
