import React, { useState, useEffect } from 'react';

export const NotePad = () => {
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('catintassist_notes') || '';
  });

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
    <div className="glass-panel notes-area">
      <div className="notepad-container">
        <div className="notepad-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>📝 Session Notes</span>
          <button
            onClick={clearNotes}
            title="Clear Notes"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}
          >
            🗑️
          </button>
        </div>
        <textarea
          className="notepad-textarea"
          placeholder="Jot down numbers, names, and medical terms here... (Auto-saves)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
};
