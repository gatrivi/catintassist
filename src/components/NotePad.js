import React, { useState, useEffect, useRef } from 'react';
import { useTTS } from '../hooks/useTTS';
import { useSession } from '../contexts/SessionContext';

export const NotePad = () => {
  const { playTTS, stopTTS, isPlaying } = useTTS();
  const { isActive } = useSession();
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('catintassist_notes') || '';
  });

  const prevActiveRef = useRef(isActive);

  useEffect(() => {
    if (prevActiveRef.current && !isActive) {
      setNotes('');
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('catintassist_notes', notes);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [notes]);

  const clearNotes = () => {
    if (window.confirm("Are you sure you want to clear your session notes?")) {
      setNotes('');
    }
  };

  return (
    <div className="notepad-container">
      <div className="notepad-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📝 Session Notes</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {notes.trim().length > 0 && (
            <>
              <button onClick={() => playTTS(notes, 'en')} disabled={isPlaying} className="btn" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>🔊 Play ENG</button>
              <button onClick={() => playTTS(notes, 'es')} disabled={isPlaying} className="btn" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>🔊 Play SPA</button>
            </>
          )}
          <button onClick={stopTTS} disabled={!isPlaying} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>🛑</button>
          <button
            onClick={clearNotes}
            title="Clear Notes"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', marginLeft: '0.5rem' }}
          >
            🗑️
          </button>
        </div>
      </div>
      <textarea
        className="notepad-textarea"
        placeholder="Jot down numbers, names, and medical terms here... (Auto-saves)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
};
