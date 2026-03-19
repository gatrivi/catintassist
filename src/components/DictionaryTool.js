import React, { useState } from 'react';

export const DictionaryTool = () => {
  const [term, setTerm] = useState('');

  const handleLookup = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    
    // Linguee is exceptional for obscure medical expressions and slang in context
    const url = `https://www.linguee.com/english-spanish/search?source=auto&query=${encodeURIComponent(term)}`;
    // Open in a popup window so it doesn't navigate away from the app
    window.open(url, 'LingueeLookup', 'width=800,height=600,scrollbars=yes');
    setTerm('');
  };

  return (
    <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '0.5rem' }}>
      <form onSubmit={handleLookup} style={{ display: 'flex', width: '100%', gap: '0.5rem' }}>
        <input 
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Look up medical term/slang..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid var(--panel-border)',
            color: 'white',
            borderRadius: '4px',
            padding: '0.4rem 0.5rem',
            outline: 'none',
            fontSize: '0.85rem'
          }}
        />
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
        >
          Search
        </button>
      </form>
    </div>
  );
};
