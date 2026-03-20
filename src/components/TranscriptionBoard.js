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

const TranslatedBubble = ({ text, lang, playTTS, isPlaying, reverse = false, ttsMode }) => {
  const [translation, setTranslation] = useState('');
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!text.trim()) {
        setTranslation('');
        return;
      }
      try {
        const targetLang = lang === 'en' ? 'es' : 'en';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        setTranslation(json[0].map(x => x[0]).join(''));
        hasAutoPlayedRef.current = false; // Reset flag so new translations can play
      } catch (e) {
        setTranslation('Error translating...');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [text, lang]);

  const targetLang = lang === 'en' ? 'es' : 'en';

  useEffect(() => {
    // Only autoplay if it hasn't played this exact string yet, it's not empty, and mode is auto
    if (ttsMode === 'auto' && translation && translation !== 'Error translating...' && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      playTTS(translation, targetLang);
    }
  }, [translation, ttsMode, playTTS, targetLang]);

  return (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', flexDirection: reverse ? 'row-reverse' : 'row' }}>
      <div style={{ flex: 1, textAlign: reverse ? 'right' : 'left' }}>
        <div style={{ fontWeight: 400, marginBottom: '0.5rem', lineHeight: 1.4 }}>{text}</div>
      </div>
      <div style={{ 
        flex: 1, 
        borderLeft: reverse ? 'none' : '1px dashed rgba(255,255,255,0.1)', 
        borderRight: reverse ? '1px dashed rgba(255,255,255,0.1)' : 'none', 
        paddingLeft: reverse ? 0 : '1rem', 
        paddingRight: reverse ? '1rem' : 0, 
        color: 'rgba(255,255,255,0.3)',
        textAlign: reverse ? 'left' : 'right'
      }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', marginBottom: '0.5rem', lineHeight: 1.4 }}>
          {translation || <span style={{ opacity: 0.2 }}>...</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: reverse ? 'flex-start' : 'flex-end' }}>
          <button 
            onClick={() => playTTS(translation, targetLang)} 
            className="btn" 
            disabled={isPlaying || !translation}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              fontSize: '0.75rem', 
              padding: '0.2rem 0.6rem',
              opacity: isPlaying || !translation ? 0.5 : 1
            }}
            title="Play Translated Audio via Inworld TTS"
          >
            🔊 Synthesize ({targetLang.toUpperCase()})
          </button>
        </div>
      </div>
    </div>
  );
};

export const TranscriptionBoard = ({ captions, onClear, viewMode }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const [ttsMode, setTtsMode] = useState('manual');
  const { playTTS, stopTTS, isPlaying } = useTTS();

  useEffect(() => {
    if (!isScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [captions]);

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    // If user scrolled up even slightly, stop auto-scrolling
    isScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 5;
  };

  const handleWheel = (e) => {
    // If they scroll up, instantly pause auto-scroll before Deepgram overrides it
    if (e.deltaY < 0) {
      isScrolledUpRef.current = true;
    }
  };

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
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Livestream Transcription</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              onClick={() => setTtsMode(m => m === 'manual' ? 'auto' : 'manual')} 
              className="btn" 
              style={{ 
                background: ttsMode === 'auto' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', 
                color: ttsMode === 'auto' ? 'var(--success)' : 'white', 
                padding: '0.2rem 0.6rem', 
                fontSize: '0.75rem' 
              }}
            >
              {ttsMode === 'auto' ? '🤖 Supervised Auto-Playback' : '⚙️ Manual Playback'}
            </button>
            <button 
              onClick={stopTTS} 
              className="btn btn-danger" 
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', opacity: isPlaying ? 1 : 0.5, animation: 'none' }}
              disabled={!isPlaying}
            >
              🛑 Stop AI
            </button>
            {onClear && (
              <button onClick={onClear} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                🗑️ Clear Transcript
              </button>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approaching 40 words will turn Orange/Red</span>
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
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.2rem' 
              }}>
                <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {!isSameAsPrevious ? (cap.lang === 'es' ? 'Spanish' : 'English') : ''}
                </span>
                <span style={{ 
                  fontSize: '0.70rem', 
                  fontWeight: 600,
                  color: wordCount >= 40 ? 'var(--danger)' : wordCount >= 34 ? '#f59e0b' : 'var(--text-muted)'
                }}>
                  {wordCount} words
                </span>
              </div>
              <TranslatedBubble text={cap.text} lang={cap.lang} playTTS={playTTS} isPlaying={isPlaying} reverse={cap.lang === 'es'} ttsMode={ttsMode} />
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '60px', flexShrink: 0 }} />
      </div>
    </div>
  );
};
