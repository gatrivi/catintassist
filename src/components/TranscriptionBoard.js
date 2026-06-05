import React, { useEffect, useMemo, useRef, useState } from 'react';

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

const normalizeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// English STT only — avoids "ten" → "10" inside Spanish words like "tenía"
const convertEnglishNumberWords = (text) => {
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
  return text.replace(re, (matched) => map[normalizeAccents(matched)] || matched);
};

const InteractiveText = ({ text, scramble = true, applyNumberWords = false }) => {
  if (!text) return null;
  
  const processedText = applyNumberWords ? convertEnglishNumberWords(text) : text;

  // 2. GROUP PHONE NUMBERS / SSN: If we see 8-16 digits read out singly (with spaces), join and format them.
  const groupedDigits = processedText.replace(
    /\b(?:\d[\s.,-:]*){7,15}\d\b/g,
    (m) => {
      const digitsOnly = m.replace(/\D/g, '');
      if (digitsOnly.length === 10) {
        return `${digitsOnly.slice(0,3)}-${digitsOnly.slice(3,6)}-${digitsOnly.slice(6)}`;
      }
      if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `+1 ${digitsOnly.slice(1,4)}-${digitsOnly.slice(4,7)}-${digitsOnly.slice(7)}`;
      }
      return digitsOnly.replace(/(\d{3})(?=\d)/g, '$1-');
    }
  );
  
  // NYC ZIP REPAIR: In NYC, people often say "one hundred thirty four" for 10034.
  // Deepgram might transcribe "New York 134". We fix it to "New York 10034".
  const repairedText = groupedDigits.replace(/\b(New York|NY|N\.Y\.)\s*,?\s*(\d{3})\b/gi, (m, city, zip) => {
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
        const partKey = `${i}`;
        if (p && p.match(numRegex)) {
          return (
            <span 
              key={partKey} 
              className="phone-number highlight-number" 
              onClick={(e) => { e.stopPropagation(); handleCopy(p); }} 
              title={`Click to copy number: ${p}`}
              style={{ cursor: 'copy', backgroundColor: 'rgba(252, 211, 77, 0.1)', color: '#fcd34d', padding: '0 2px', borderRadius: '2px', fontWeight: 600, display: 'inline' }}
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

/** Compact T/P/R + word count + play — one line, ~6ch wide (split-pane friendly). */
const BubbleRail = ({
  engineStatus,
  turnWordCount,
  showTurnWordCount,
  isThisPlaying,
  canPlay,
  onPlayClick,
}) => {
  const steps = ['translating', 'processing', 'ready'];
  const currentIndex = steps.indexOf(engineStatus === 'buffering' ? 'processing' : engineStatus);
  const wc = turnWordCount || 0;
  const showWc = showTurnWordCount && wc > 0;
  const wcColor = wc >= 40 ? 'var(--danger)' : wc >= 34 ? '#f59e0b' : 'var(--text-muted)';
  const tprTitle = 'T=transcribe · P=process · R=ready · Word count = whole turn (resets after ~2.5s silence)';

  return (
    <div className="bubble-rail" title={tprTitle}>
      <svg className="bubble-rail-tpr" width="11" height="8" viewBox="0 0 11 8" aria-hidden>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={i * 4}
            y="0"
            width="2.5"
            height="8"
            rx="0.5"
            fill={
              i <= currentIndex
                ? i === 2
                  ? '#10b981'
                  : '#3b82f6'
                : 'rgba(255,255,255,0.12)'
            }
          />
        ))}
      </svg>
      {showWc && (
        <span className="bubble-rail-wc" style={{ color: wcColor }} title={`${wc} words`}>
          {wc > 99 ? '99' : wc}
        </span>
      )}
      <button
        type="button"
        className="bubble-rail-play"
        onClick={onPlayClick}
        disabled={!isThisPlaying && !canPlay}
        title={isThisPlaying ? 'Stop' : canPlay ? 'Play translation' : 'Waiting for audio'}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          {isThisPlaying ? (
            <>
              <rect x="2" y="2" width="3" height="8" fill="currentColor" />
              <rect x="7" y="2" width="3" height="8" fill="currentColor" />
            </>
          ) : (
            <path d="M2 1.5 L9 6 L2 10.5 Z" fill="currentColor" />
          )}
        </svg>
      </button>
    </div>
  );
};

const TranslatedBubble = ({ id, text, lang, playTTS, stopTTS, playingUrl, prefetchTTS, reverse = false, ttsMode, turnWordCount, showTurnWordCount, shouldPrefetch, isPinned, onTogglePin }) => {
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
  const transcriptColor = '#ffffff';
  const translationColor = '#a1a1aa';
  const sourceUsesNumberWords = (lang || 'en').toLowerCase().startsWith('en');
  const targetUsesNumberWords = (targetLang || 'en').toLowerCase().startsWith('en');

  return (
    <div className={`translated-bubble-row${reverse ? ' is-reverse' : ''}`}>
      <div className="bubble-col bubble-col-source" style={{ textAlign: reverse ? 'right' : 'left' }}>
        <div className="bubble-line" style={{ color: transcriptColor }}>
          <InteractiveText text={text} scramble={true} applyNumberWords={sourceUsesNumberWords} />
        </div>
      </div>

      <div data-guide="bubble-rail" className="bubble-col bubble-col-rail">
      <BubbleRail
        engineStatus={engineStatus}
        turnWordCount={turnWordCount}
        showTurnWordCount={showTurnWordCount}
        isThisPlaying={isThisPlaying}
        canPlay={Boolean(translation && audioUrl)}
        onPlayClick={() => (isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl))}
      />
      </div>

      <div className="bubble-col bubble-col-translation" style={{ color: translationColor, textAlign: reverse ? 'left' : 'right' }}>
        <div className="bubble-line bubble-line-translation">
          {translation ? (
            <InteractiveText text={translation} scramble={true} applyNumberWords={targetUsesNumberWords} />
          ) : engineStatus === 'ready' ? (
            <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>⚠️ translation failed</span>
          ) : (
            <span style={{ opacity: 0.2 }}>...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const TranscriptionBoard = ({ captions, onClearAll, onReconnect, lastDataTime, connectionState = 'disconnected' }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const [ttsMode, setTtsMode] = useState('manual');
  const [pinnedCaptions, setPinnedCaptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('catint_pinned_msgs')) || [];
    } catch {
      return [];
    }
  });
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();
  const { playWarningPing } = useProgressiveAudio();
  const { isActive, isZombieCall, lastCallSummary, setLastCallSummary } = useSession();
  const warnedBubblesRef = useRef(new Set());
  
  const [popover, setPopover] = useState({ show: false, x: 0, y: 0, text: '' });
  const popoverTimerRef = useRef(null);
  
  // Smart Bubble Compression: auto-collapse long bubbles to reduce reading fatigue
  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    safeSet('catint_pinned_msgs', JSON.stringify(pinnedCaptions));
  }, [pinnedCaptions]);

  const pinnedIds = pinnedCaptions.map((p) => p.id);

  /** One word count per silence-to-silence turn — show only on the last bubble of that turn. */
  const turnDisplayMeta = useMemo(() => {
    const lastIndexByTurn = {};
    const maxCountByTurn = {};
    captions.forEach((cap, i) => {
      const tid = cap.turnId || `solo-${cap.id}`;
      lastIndexByTurn[tid] = i;
      const tc = cap.turnWordCount ?? 0;
      if (tc > (maxCountByTurn[tid] ?? 0)) maxCountByTurn[tid] = tc;
    });
    return { lastIndexByTurn, maxCountByTurn };
  }, [captions]);

  const togglePin = (cap) => {
    if (!cap?.id || !cap.text?.trim()) return;
    setPinnedCaptions((prev) => {
      if (prev.some((p) => p.id === cap.id)) {
        return prev.filter((p) => p.id !== cap.id);
      }
      return [...prev, { id: cap.id, text: cap.text, lang: cap.lang || 'en' }];
    });
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

      {isZombieCall && connectionState !== 'connected' && (
        <div 
          onClick={onReconnect}
          className="zombie-reattach-banner"
          style={{
            position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1001,
            background: '#f59e0b', color: '#000', padding: '0.8rem',
            borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.2rem', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem',
            border: '2px solid #000', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'pulseGlow 2s infinite'
          }}
        >
          <div style={{ fontSize: '1.2rem' }}>🟡 AUDIO DISCONNECTED — CALL STILL ACTIVE</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, textAlign: 'center', maxWidth: '36rem' }}>
            Click here or press the yellow 🟡 button above. Transcript and call timer are preserved — no need to Stop.
          </div>
          <div style={{ fontSize: '0.7rem', marginTop: '4px', textDecoration: 'underline' }}>[RE-ATTACH AUDIO]</div>
        </div>
      )}

      {/* Post-Call Summary Toast */}
      {(!isActive && lastCallSummary) && (
        <div style={{
          position: 'absolute', top: '8px', left: '8px', right: '8px', zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '6px', padding: '0.5rem 0.7rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📋 LAST CALL SUMMARY · {lastCallSummary.timestamp}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              {lastCallSummary.numbers.length > 0 && (
                <span>🔢 {lastCallSummary.numbers.join(', ')}</span>
              )}
              {lastCallSummary.dollars.length > 0 && (
                <span style={{ color: '#fcd34d' }}>💰 {lastCallSummary.dollars.join(', ')}</span>
              )}
              {lastCallSummary.numbers.length === 0 && lastCallSummary.dollars.length === 0 && (
                <span style={{ opacity: 0.5 }}>No key data extracted</span>
              )}
            </div>
          </div>
          <button onClick={() => setLastCallSummary(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }} title="Dismiss">✕</button>
        </div>
      )}

      <div 
        className="scroll-area"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={scrollAreaRef}
      >
        {pinnedCaptions.length > 0 && (
          <div className="pinned-transcript-section" style={{
            flexShrink: 0,
            marginBottom: '0.5rem',
            paddingBottom: '0.4rem',
            borderBottom: '1px solid rgba(34, 197, 94, 0.35)',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '0.35rem', letterSpacing: '0.06em' }}>
              📌 PINNED ({pinnedCaptions.length})
            </div>
            {pinnedCaptions.map((cap) => (
              <div key={`pin-${cap.id}`} className="transcript-bubble pinned-transcript-bubble" style={{
                marginTop: '0.35rem',
                border: '1px solid var(--accent-primary)',
                background: 'rgba(34, 197, 94, 0.1)',
                ...getBubbleStyle(cap.text, true, cap.lang),
              }}>
                <TranslatedBubble
                  id={cap.id}
                  text={cap.text}
                  lang={cap.lang}
                  playTTS={playTTS}
                  stopTTS={stopTTS}
                  playingUrl={playingUrl}
                  prefetchTTS={prefetchTTS}
                  reverse={cap.lang === 'es'}
                  ttsMode={ttsMode}
                  wordCount={cap.text.trim().split(/\s+/).length}
                  shouldPrefetch={false}
                  isPinned={true}
                  onTogglePin={() => togglePin(cap)}
                />
                <button
                  type="button"
                  className="bubble-pin-btn is-pinned"
                  onClick={() => togglePin(cap)}
                  title="Unpin message"
                  aria-label="Unpin message"
                >
                  📌
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: '1 1 auto' }} />
        
        {captions.length === 0 && pinnedCaptions.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isZombieCall ? 0.55 : 0.2 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', textAlign: 'center', padding: '0 1rem', color: isZombieCall ? '#fbbf24' : undefined }}>
              {isZombieCall && connectionState !== 'connected'
                ? '> RE-ATTACH_AUDIO — timer & transcript saved'
                : isActive ? '> STANDBY_FOR_AUDIO...' : '> SYSTEM_IDLE'}
            </div>
          </div>
        )}

        {captions.map((cap, i) => {
          if (!cap.text || !cap.text.trim()) return null;
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          const tid = cap.turnId || `solo-${cap.id}`;
          const turnWordCount = turnDisplayMeta.maxCountByTurn[tid] ?? cap.turnWordCount ?? 0;
          const showTurnWordCount = i === turnDisplayMeta.lastIndexByTurn[tid];
          const isPinned = pinnedIds.includes(cap.id);
          if (isPinned) return null;
          const isSplitContinuation = isSameAsPrevious && wordCount < 50;
          const isLongBubble = wordCount > 50 && cap.isFinal !== false;
          const isExpanded = expandedIds.has(cap.id);
          
          return (
            <div key={cap.id || i} className="transcript-bubble" style={{
              opacity: cap.isFinal === false ? 0.6 : 1,
              marginTop: isSplitContinuation ? '0rem' : '0.25rem',
              border: '1px solid transparent',
              background: getBubbleStyle(cap.text, cap.isFinal === false, cap.lang).backgroundColor,
              ...getBubbleStyle(cap.text, cap.isFinal === false, cap.lang)
            }}>
              
              <div style={{ maxHeight: isLongBubble && !isExpanded ? '5.5rem' : 'none', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                <TranslatedBubble 
                  id={cap.id} text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} 
                  reverse={cap.lang === 'es'} ttsMode={ttsMode} turnWordCount={turnWordCount} showTurnWordCount={showTurnWordCount} shouldPrefetch={i >= captions.length - 3} 
                  isPinned={false} onTogglePin={() => togglePin(cap)}
                />
              </div>
              
              {isLongBubble && (
                <button className="bubble-expand-btn" onClick={() => toggleExpand(cap.id)}>
                  {isExpanded ? '▲ collapse' : `··· ${wordCount} words ···`}
                </button>
              )}
              
              <button
                type="button"
                className="bubble-pin-btn"
                onClick={() => togglePin(cap)}
                title="Pin message (keeps it visible at top for voicemail / callouts)"
                aria-label="Pin message"
              >
                📍
              </button>
            </div>
          );
        })}
        <div id="scroll-bottom-anchor" ref={bottomRef} style={{ height: '48px', flexShrink: 0, pointerEvents: 'none' }} />
      </div>

      {/* Simplified Footer Toolbar */}
      <div className="transcription-footer" data-guide="pin" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px',
        borderTop: '1px solid #18181b', background: 'var(--panel-bg)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.65rem'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setTtsMode(m => m === 'manual' ? 'auto' : 'manual')} style={{ background: 'transparent', color: ttsMode === 'auto' ? 'var(--accent-primary)' : '#fff', border: 'none', cursor: 'pointer' }}>
            TTS:{ttsMode === 'auto' ? 'AUTO' : 'OFF'}
          </button>
          {pinnedCaptions.length > 0 && (
            <button
              onClick={() => {
                const pinnedText = pinnedCaptions
                  .map((c) => `[${(c.lang || 'en').toUpperCase()}] ${c.text}`)
                  .join('\n---\n');
                navigator.clipboard.writeText(pinnedText);
              }}
              style={{ background: 'transparent', color: '#34d399', border: 'none', cursor: 'pointer' }}
              title={`Copy ${pinnedCaptions.length} pinned message(s)`}
            >
              📋 COPY_PINNED({pinnedCaptions.length})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClearAll} style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>[CLEAR_LOG]</button>
          <button onClick={stopTTS} disabled={!isPlaying} style={{ background: 'transparent', color: isPlaying ? 'var(--danger)' : '#333', border: 'none', cursor: 'pointer' }}>[STOP_AI]</button>
        </div>
      </div>
    </div>
  );
};
