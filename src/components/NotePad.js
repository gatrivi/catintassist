import React, { useState, useEffect, useRef } from 'react';
import { safeSet } from '../contexts/SessionContext';
import { useTTS } from '../hooks/useTTS';

export const NotePad = () => {
  const { playTTS, stopTTS, isPlaying } = useTTS();
  const textareaRef = useRef(null);
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('catintassist_notes') || '';
  });

  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      safeSet('catintassist_notes', notes);
    }, 500); 
    return () => clearTimeout(saveTimeoutRef.current);
  }, [notes]);

  // HIPAA: notes are cleared only by SessionContext finalizer (after grace expiry).
  useEffect(() => {
    const onCleared = () => setNotes('');
    window.addEventListener('catint_notes_cleared', onCleared);
    return () => window.removeEventListener('catint_notes_cleared', onCleared);
  }, []);

  useEffect(() => {
    const focusNotes = () => {
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    };
    focusNotes();
    window.addEventListener('catint_focus_notes', focusNotes);
    return () => window.removeEventListener('catint_focus_notes', focusNotes);
  }, []);

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
              <button onClick={() => playTTS(notes, 'en')} disabled={isPlaying} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>🔊 EN</button>
              <button onClick={() => playTTS(notes, 'es')} disabled={isPlaying} className="btn" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>🔊 ES</button>            </>
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
        id="quick-notes-textarea"
        ref={textareaRef}
        className="notepad-textarea"
        placeholder="Jot down numbers, names, and medical terms here... (Auto-saves)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
};
