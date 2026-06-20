import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTTS } from '../hooks/useTTS';
import { useTranslate } from '../hooks/useTranslate';
import { useSession, safeSet } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { formatTranscriptForDisplay, isSpellingBlock } from '../utils/transcriptFormat';
import {
  convertEnglishNumberWords,
  formatPhoneAndSSNDigits,
  getNumberHighlightRegex,
  repairNYCZipNumbers,
} from '../utils/sensitiveDataProtector';
import { ScrambleText } from './ScrambleText';
import { NewcomerIdleGuide } from './NewcomerIdleGuide';
import { isNewcomerGuideDismissed } from '../utils/newcomerGuide';
import { isTranslationStuckForRetranslate } from '../utils/translationQuality';

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

const InteractiveText = ({ text, scramble = true, applyNumberWords = false, lang = 'en' }) => {
  if (!text) return null;

  const spelled = formatTranscriptForDisplay(text, lang);
  const processedText = applyNumberWords ? convertEnglishNumberWords(spelled) : spelled;
  const spellingLayout = isSpellingBlock(text);

  // 2. GROUP PHONE NUMBERS / SSN: If we see 8-16 digits read out singly (with spaces), join and format them.
  const groupedDigits = formatPhoneAndSSNDigits(processedText);
  
  // NYC ZIP REPAIR: In NYC, people often say "one hundred thirty four" for 10034.
  // Deepgram might transcribe "New York 134". We fix it to "New York 10034".
  const repairedText = repairNYCZipNumbers(groupedDigits);

  // NÚMEROS MÁGICOS: Detectamos números de teléfono, años y códigos.
  // Los resaltamos para que puedas copiarlos rápido si haces clic.
  const numRegex = getNumberHighlightRegex();

  const parts = repairedText.split(numRegex);

  const handleCopy = (num) => {
    const clean = num.trim();
    if (!clean) return;
    navigator.clipboard.writeText(clean);
  };

  const renderPart = (p, i) => {
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
          {scramble ? <ScrambleText value={p} /> : p}
        </span>
      );
    }
    return scramble ? <ScrambleText key={partKey} value={p} /> : <span key={partKey}>{p}</span>;
  };

  if (spellingLayout && processedText.includes('\n')) {
    return (
      <span className="bubble-spelling-lines" style={{ whiteSpace: 'pre-line', lineHeight: 1.35 }}>
        {processedText.split('\n').map((line, li) => (
          <span key={li} style={{ display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {scramble ? <ScrambleText value={line} /> : line}
          </span>
        ))}
      </span>
    );
  }

  return (
    <>
      {parts.map((p, i) => renderPart(p, i))}
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

const TranslatedBubble = ({
  id,
  text,
  lang,
  playTTS,
  stopTTS,
  playingUrl,
  prefetchTTS,
  reverse = false,
  ttsMode,
  turnWordCount,
  showTurnWordCount,
  shouldPrefetch,
  isPinned,
  onTogglePin,
  forceTranslateKey = 0,
  onManualRetranslate,
  isTailMovedSection = false,
  isFinal = true,
}) => {
  const { translationMood } = useSession();
  const { translation, audioUrl, engineStatus, translationMeta, targetLang } = useTranslate(
    text,
    lang,
    prefetchTTS,
    shouldPrefetch,
    translationMood,
    forceTranslateKey,
    { isFinal },
  );
  const hasAutoPlayedRef = useRef(false);

  // Tail highlight occasionally flashes and disappears due to rapid interim flag flips.
  // We lock the blue class for a short window to match the flowed/move cue duration.
  const tailLockTimerRef = useRef(null);
  const [tailBlueLocked, setTailBlueLocked] = useState(false);

  useEffect(() => {
    if (!isTailMovedSection) return;

    setTailBlueLocked(true);
    if (tailLockTimerRef.current) {
      clearTimeout(tailLockTimerRef.current);
    }
    tailLockTimerRef.current = setTimeout(() => {
      setTailBlueLocked(false);
    }, 350);

    return () => {
      if (tailLockTimerRef.current) clearTimeout(tailLockTimerRef.current);
    };
  }, [isTailMovedSection, id]);

  useEffect(() => {
    return () => {
      if (tailLockTimerRef.current) clearTimeout(tailLockTimerRef.current);
    };
  }, []);

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

  const isTranslationStuck = isTranslationStuckForRetranslate(
    text,
    translation,
    lang,
    targetLang,
    translationMeta,
  );
  const isTranslationMissing = engineStatus === 'ready' && !translation?.trim();

  // UX: if a message is clearly "untranslated", we should just try again,
  // and only show a ↻ button as a fallback.
  const shouldAutoRetranslate =
    !isPinned && engineStatus === 'ready' && (isTranslationStuck || isTranslationMissing);
  const [autoRetranslatePending, setAutoRetranslatePending] = useState(false);
  const [hasAutoRetranslated, setHasAutoRetranslated] = useState(false);

  useEffect(() => {
    setAutoRetranslatePending(false);
    setHasAutoRetranslated(false);
  }, [id]);

  useEffect(() => {
    if (!shouldAutoRetranslate) return;
    if (hasAutoRetranslated || autoRetranslatePending) return;

    setAutoRetranslatePending(true);
    const t = setTimeout(() => {
      onManualRetranslate?.();
      setHasAutoRetranslated(true);
      setAutoRetranslatePending(false);
    }, 200);

    return () => clearTimeout(t);
  }, [shouldAutoRetranslate, hasAutoRetranslated, autoRetranslatePending, onManualRetranslate]);

  const isProblemTranslation = isTranslationStuck || isTranslationMissing;
  const showManualRetranslateBtn =
    !isPinned && engineStatus === 'ready' && isProblemTranslation && hasAutoRetranslated && !autoRetranslatePending;
  // Pane contract (for outside agents/models):
  // - left column is the EN/transcript lane
  // - right column is the ES/translation lane
  // `convertEnglishNumberWords` must ONLY run when the lane language truly starts with `en`.
  // Bug example to avoid: Spanish "once" (meaning 11) must NOT be converted on the left EN lane.
  const sourceUsesNumberWords = (lang || 'en').toLowerCase().startsWith('en');
  const targetUsesNumberWords = (targetLang || 'en').toLowerCase().startsWith('en');
  const translationFailed =
    engineStatus === 'ready' && !translation?.trim() && translationMeta?.quality === 'failed';
  const translationTitle = translationFailed
    ? 'Translation failed — check Settings → Translation for engine status'
    : undefined;

  return (
    <div className={`translated-bubble-row${reverse ? ' is-reverse' : ''}`}>
      <div className="bubble-col bubble-col-source" style={{ textAlign: reverse ? 'right' : 'left', position: 'relative' }}>
        <div className={`bubble-line${tailBlueLocked ? ' is-tail-blue' : ''}`} style={{ color: transcriptColor }}>
          <InteractiveText text={text} scramble={true} applyNumberWords={sourceUsesNumberWords} lang={lang} />
        </div>
      </div>

      <div
        data-guide="bubble-rail"
        className="bubble-col bubble-col-rail"
        style={{ position: 'relative', minWidth: '6ch' }}
      >
        {showManualRetranslateBtn ? (
          <button
            type="button"
            className="bubble-rail-retranslate-btn"
            onClick={onManualRetranslate}
            title="Retrigger translation for this message"
            aria-label="Retrigger translation"
          >
            {reverse ? '←' : '→'} ↻
          </button>
        ) : (
          <BubbleRail
            engineStatus={engineStatus}
            turnWordCount={turnWordCount}
            showTurnWordCount={showTurnWordCount}
            isThisPlaying={isThisPlaying}
            canPlay={Boolean(translation && audioUrl)}
            onPlayClick={() => (isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl))}
          />
        )}
      </div>

      <div
        className="bubble-col bubble-col-translation"
        style={{ color: translationColor, textAlign: 'left', position: 'relative' }}
        title={translationTitle}
      >
        <div className="bubble-line bubble-line-translation">
          {translation ? (
            <InteractiveText text={translation} scramble={true} applyNumberWords={targetUsesNumberWords} lang={targetLang} />
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

const translatedBubblePropsEqual = (prev, next) =>
  prev.id === next.id &&
  prev.text === next.text &&
  prev.lang === next.lang &&
  prev.isFinal === next.isFinal &&
  prev.forceTranslateKey === next.forceTranslateKey &&
  prev.reverse === next.reverse &&
  prev.isTailMovedSection === next.isTailMovedSection &&
  prev.showTurnWordCount === next.showTurnWordCount &&
  prev.turnWordCount === next.turnWordCount &&
  prev.shouldPrefetch === next.shouldPrefetch &&
  prev.isPinned === next.isPinned &&
  prev.ttsMode === next.ttsMode &&
  prev.playingUrl === next.playingUrl;

const MemoTranslatedBubble = React.memo(TranslatedBubble, translatedBubblePropsEqual);

export const TranscriptionBoard = ({
  captions,
  onClearAll,
  onReconnect,
  lastDataTime,
  connectionState = 'disconnected',
  audioAttached = false,
  micTestMode = false,
}) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollKeyRef = useRef('');
  const [ttsMode, setTtsMode] = useState('manual');
  const [pinnedCaptions, setPinnedCaptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('catint_pinned_msgs')) || [];
    } catch {
      return [];
    }
  });
  const [translationBumps, setTranslationBumps] = useState({});
  const [newcomerSessionHidden, setNewcomerSessionHidden] = useState(false);
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

  // UX: new call start should clear pinned messages (without affecting transcript history).
  useEffect(() => {
    const onPinnedCleared = () => {
      setPinnedCaptions([]);
      safeSet('catint_pinned_msgs', JSON.stringify([]));
    };
    window.addEventListener('catint_pinned_cleared', onPinnedCleared);
    return () => window.removeEventListener('catint_pinned_cleared', onPinnedCleared);
  }, []);

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

  const bumpManualRetranslate = (cap) => {
    const capId = cap?.id;
    if (!capId) return;
    setTranslationBumps((prev) => ({
      ...prev,
      [capId]: (prev[capId] || 0) + 1,
    }));
  };

  useEffect(() => {
    const lastCap = captions[captions.length - 1];
    const count = captions.length;
    const lastId = lastCap?.id || '';
    const isFinal = lastCap?.isFinal !== false;
    const scrollKey = `${count}|${lastId}|${isFinal ? 'final' : 'live'}`;

    const prev = lastScrollKeyRef.current;
    const [prevCountStr, prevId, prevFinalFlag] = prev.split('|');
    const prevCount = parseInt(prevCountStr || '0', 10);
    const countIncreased = count > prevCount;
    const becameFinal = prevFinalFlag === 'live' && isFinal && prevId === lastId;

    if (!isScrolledUpRef.current && (countIncreased || becameFinal)) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    lastScrollKeyRef.current = scrollKey;

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
                <MemoTranslatedBubble
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
                  forceTranslateKey={translationBumps[cap.id] ?? 0}
                  onManualRetranslate={() => bumpManualRetranslate(cap)}
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isZombieCall ? 0.85 : 1 }}>
            {isZombieCall && connectionState !== 'connected' ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', textAlign: 'center', padding: '0 1rem', color: '#fbbf24' }}>
                Re-attach audio — your timer and transcript are saved. Press the green Re-attach button.
              </div>
            ) : !newcomerSessionHidden && !isNewcomerGuideDismissed() ? (
              <NewcomerIdleGuide
                audioAttached={audioAttached}
                micTestMode={micTestMode}
                connectionState={connectionState}
                isActive={isActive}
                onHideSession={() => setNewcomerSessionHidden(true)}
              />
            ) : null}
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
          // UI_SPLIT_HEURISTIC:
          // This is the current UI-only signal we use to trigger the "flow/move" look.
          // IMPORTANT: The real algorithm-selected moved text section happens inside
          // `useDeepgram.js` (see `ALGO_MOVED_SECTION` comment), and this heuristic may
          // differ. Blue should be attached to ONLY the moved section substring.
          const isSplitContinuation = isSameAsPrevious && wordCount < 50;
          const isLive = cap.isFinal === false;
          const isLongBubble = wordCount > 50 && !isLive;
          const isExpanded = expandedIds.has(cap.id);
          // ALGO_MOVED_SECTION (tailText remainder bubble):
          // In `useDeepgram`, the remainder bubble is created with `isFinal:false`
          // but still filled with the lane's `*Finalized` content, while the interim is empty.
          // We use that to flash only the moved remainder text (not the earlier sealed part).
          const isTailMovedSection =
            cap.isFinal === false &&
            ((cap.lang === 'en' && cap.enFinalized && !cap.enInterim) ||
              (cap.lang === 'es' && cap.esFinalized && !cap.esInterim));
          
          return (
            <div
              key={cap.id || i}
              className={`transcript-bubble${isLive ? ' is-live' : ''}${isSplitContinuation ? ' is-flowed' : ''}`}
              // UI_FLOW_ANIMATION_TRIGGER:
              // `.transcript-bubble.is-flowed` in `index.css` is currently what "animates the flow".
              // Once you wire blue-to-substring, this class should stop being used (or be text-only)
              // to avoid bubble height jitter during reading.
              style={{
              opacity: isLive ? 0.6 : 1,
              marginTop: isSplitContinuation ? '0rem' : '0.25rem',
              border: '1px solid transparent',
              background: getBubbleStyle(cap.text, isLive, cap.lang).backgroundColor,
              ...getBubbleStyle(cap.text, isLive, cap.lang)
            }}>
              
              <div style={{ maxHeight: isLongBubble && !isExpanded ? '5.5rem' : 'none', overflow: isLongBubble && !isExpanded ? 'hidden' : 'visible', transition: 'max-height 0.3s ease' }}>
                <MemoTranslatedBubble 
                  id={cap.id} text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} 
                  reverse={cap.lang === 'es'} ttsMode={ttsMode} turnWordCount={turnWordCount} showTurnWordCount={showTurnWordCount} shouldPrefetch={i >= captions.length - 3} 
                  isPinned={false} onTogglePin={() => togglePin(cap)}
                  forceTranslateKey={translationBumps[cap.id] ?? 0}
                  onManualRetranslate={() => bumpManualRetranslate(cap)}
                  isTailMovedSection={isTailMovedSection}
                  isFinal={cap.isFinal !== false}
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
