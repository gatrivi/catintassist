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

  return (
    <div className="glass-panel notes-area">
      <div className="notepad-container">
        <div className="notepad-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Session Notes
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
