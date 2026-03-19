import React, { useEffect, useRef } from 'react';

const getBubbleStyle = (text, isCurrent) => {
  if (!text) return {};
  const wordCount = text.trim().split(/\s+/).length;
  
  if (wordCount >= 40) {
    return { 
      borderLeft: '4px solid var(--danger)', 
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      color: '#fca5a5'
    };
  } else if (wordCount >= 34) {
    return { 
      borderLeft: '4px solid #f59e0b', // Orange warning
      backgroundColor: 'rgba(245, 158, 11, 0.1)'
    };
  }
  return {};
};

export const TranscriptionBoard = ({ captions }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions]);

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
      <div className="scroll-area" style={{ flex: 1 }} onDoubleClick={handleDoubleClick} title="Double-click any word to instantly translate it via Linguee">
        {captions.length === 0 && (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem', fontSize: '1.1rem' }}>
            Waiting for audio capture to begin...
          </div>
        )}
        {captions.map((cap, i) => {
          const wordCount = cap.text ? cap.text.trim().split(/\s+/).length : 0;
          return (
            <div key={i} className="transcript-bubble" style={{ 
              opacity: cap.isFinal ? 1 : 0.8,
              ...getBubbleStyle(cap.text, !cap.isFinal)
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span className="speaker-badge" style={{ margin: 0 }}>Speaker ({cap.lang?.toUpperCase() || 'EN'})</span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  color: wordCount >= 40 ? 'var(--danger)' : wordCount >= 34 ? '#f59e0b' : 'var(--text-muted)'
                }}>
                  {wordCount} words
                </span>
              </div>
              <p>{cap.text}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
