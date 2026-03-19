import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

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

const TranslatedBubble = ({ text, lang, playTTS, isPlaying }) => {
  const [translation, setTranslation] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!text.trim()) return;
      try {
        const targetLang = lang === 'en' ? 'es' : 'en';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        setTranslation(json[0].map(x => x[0]).join(''));
      } catch (e) {
        setTranslation('Error translating...');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [text, lang]);

  const targetLang = lang === 'en' ? 'es' : 'en';

  return (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 400, marginBottom: '0.5rem', lineHeight: 1.4 }}>{text}</div>
      </div>
      <div style={{ flex: 1, borderLeft: '1px dashed rgba(255,255,255,0.1)', paddingLeft: '1rem', color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', marginBottom: '0.5rem', lineHeight: 1.4 }}>
          {translation || <span style={{ opacity: 0.2 }}>...</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

export const TranscriptionBoard = ({ captions }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isScrolledUpRef = useRef(false);

  const playTTS = async (text, lang) => {
    if (!text || isPlaying) return;
    setIsPlaying(true);
    try {
      const voiceId = lang === 'es' ? 'default-p8cwhu21piysovy7xa6dwg__cat2' : 'default-p8cwhu21piysovy7xa6dwg__cat1';
      const url = 'https://api.inworld.ai/tts/v1/voice';
      const options = {
        method: 'POST',
        headers: {
          'Authorization': 'Basic a3M3bXFtUWlxakcwbmF1cTRYR0Z5emRFcGNJbGRzMVU6TmdiZkVFU2ZsQll1b0t6aFM5S2Vhb1BJMGxLbTNTNWwyNGJXYUY1Q3RCaVFKM2hSSlp0RDEwdXpkVTVkVWY0eQ==',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId,
          modelId: "inworld-tts-1.5-max",
          timestampType: "WORD",
          speakingRate: 1,
          temperature: 1
        }),
      };
      
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const result = await res.json();
      
      const byteCharacters = atob(result.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (err) {
      console.error("TTS Error:", err);
      setIsPlaying(false);
    }
  };

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
        <span>Livestream Transcription</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Approaching 40 words will turn Orange/Red</span>
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
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem', fontSize: '1.1rem' }}>
            Waiting for audio capture to begin...
          </div>
        )}
        {captions.map((cap, i) => {
          const wordCount = cap.text ? cap.text.trim().split(/\s+/).length : 0;
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          
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
              <TranslatedBubble text={cap.text} lang={cap.lang} playTTS={playTTS} isPlaying={isPlaying} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
