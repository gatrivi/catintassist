import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { useTTS } from '../hooks/useTTS';

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

const TranslatedBubble = ({ text, lang, playTTS, stopTTS, playingUrl, prefetchTTS, reverse = false, ttsMode, wordCount }) => {
  const [translation, setTranslation] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!text.trim()) {
        setTranslation('');
        setAudioUrl(null);
        return;
      }
      try {
        const targetLang = lang === 'en' ? 'es' : 'en';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        const translatedText = json[0].map(x => x[0]).join('');
        setTranslation(translatedText);
        hasAutoPlayedRef.current = false; // Reset flag so new translations can play
        
        // Prefetch audio in the background!
        const urlObj = await prefetchTTS(translatedText, targetLang);
        setAudioUrl(urlObj);
      } catch (e) {
        setTranslation('Error translating...');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [text, lang, prefetchTTS]);

  const targetLang = lang === 'en' ? 'es' : 'en';

  useEffect(() => {
    // Only autoplay if it hasn't played this exact string yet, it's not empty, and mode is auto
    if (ttsMode === 'auto' && translation && audioUrl && translation !== 'Error translating...' && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      playTTS(translation, targetLang, audioUrl);
    }
  }, [translation, ttsMode, playTTS, targetLang, audioUrl]);

  const isThisPlaying = playingUrl && audioUrl && playingUrl === audioUrl;

  return (
    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.1rem', flexDirection: reverse ? 'row-reverse' : 'row', alignItems: 'center' }}>
      <div style={{ flex: 1, textAlign: reverse ? 'right' : 'left' }}>
        <div style={{ color: '#ffffff', fontWeight: 400, lineHeight: 1.3, fontSize: '0.9rem' }}>{text}</div>
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
        color: 'rgba(255,255,255,0.4)',
        textAlign: reverse ? 'left' : 'right'
      }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', lineHeight: 1.3, fontSize: '0.85rem' }}>
          {translation || <span style={{ opacity: 0.2 }}>...</span>}
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
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();

  useEffect(() => {
    if (!isScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [captions]);

  const resetScrollTimer = () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrolledUpRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 4500); // Resume auto-scroll after 4.5 seconds of inactivity
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
      <div className="notepad-header" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.4rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Livestream 
            <button onClick={onToggleTools} className="btn" style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }} title="Toggle Soundboard and Notes">
              {isToolsOpen ? '▶ Hide Tools' : '◀ Show Tools'}
            </button>
          </h2>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
      <div 
        className="scroll-area" 
        style={{ flex: 1, overflowY: 'auto' }} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={scrollAreaRef}
        onDoubleClick={handleDoubleClick} 
        title="Double-click any word to instantly translate it via Linguee"
      >
        {captions.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '20vh' }}>
            Waiting for audio capture to begin...
          </div>
        )}
        {captions.map((cap, i) => {
          if (!cap.text || !cap.text.trim()) return null;
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          
          return (
            <div key={i} className="transcript-bubble" style={{ 
              opacity: cap.isFinal === false ? 0.8 : 1,
              marginTop: isSameAsPrevious ? '0.2rem' : '1rem',
              ...getBubbleStyle(cap.text, cap.isFinal === false, cap.lang)
            }}>
              {(!isSameAsPrevious) && (
                <div style={{ display: 'flex', marginBottom: '0.1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {cap.lang === 'es' ? 'Spanish' : 'English'}
                  </span>
                </div>
              )}
              <TranslatedBubble text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} reverse={cap.lang === 'es'} ttsMode={ttsMode} wordCount={wordCount} />
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '60px', flexShrink: 0 }} />
      </div>
    </div>
  );
};
