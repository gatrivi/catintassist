import React, { useState } from 'react';

const DEEPL_KEY = 'DEEPL_API_KEY';
const OPENAI_KEY = 'OPENAI_API_KEY';

export const TranslationKeysForm = () => {
  const [deepl, setDeepl] = useState('');
  const [openai, setOpenai] = useState('');
  const [saved, setSaved] = useState(false);

  const hasDeepl = (() => {
    try {
      return !!localStorage.getItem(DEEPL_KEY);
    } catch {
      return false;
    }
  })();
  const hasOpenai = (() => {
    try {
      return !!localStorage.getItem(OPENAI_KEY);
    } catch {
      return false;
    }
  })();

  const save = (e) => {
    e.preventDefault();
    try {
      if (deepl.trim()) localStorage.setItem(DEEPL_KEY, deepl.trim());
      if (openai.trim()) localStorage.setItem(OPENAI_KEY, openai.trim());
      setDeepl('');
      setOpenai('');
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (_) {}
  };

  const clearKey = (key) => {
    try {
      localStorage.removeItem(key);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (_) {}
  };

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
        Optional — used before free tiers when translation API throttles.
      </p>
      <label style={{ fontSize: 11, color: '#93c5fd' }}>DeepL API Key {hasDeepl ? '• saved' : ''}</label>
      <input
        type="password"
        value={deepl}
        onChange={(e) => setDeepl(e.target.value)}
        placeholder={hasDeepl ? '••••••••' : 'DeepL key'}
        style={inputStyle}
      />
      {hasDeepl && (
        <button type="button" onClick={() => clearKey(DEEPL_KEY)} style={clearBtn}>
          Clear DeepL
        </button>
      )}
      <label style={{ fontSize: 11, color: '#93c5fd' }}>OpenAI API Key {hasOpenai ? '• saved' : ''}</label>
      <input
        type="password"
        value={openai}
        onChange={(e) => setOpenai(e.target.value)}
        placeholder={hasOpenai ? '••••••••' : 'sk-...'}
        style={inputStyle}
      />
      {hasOpenai && (
        <button type="button" onClick={() => clearKey(OPENAI_KEY)} style={clearBtn}>
          Clear OpenAI
        </button>
      )}
      <button type="submit" style={saveBtn}>{saved ? 'Saved' : 'Save keys'}</button>
    </form>
  );
};

const inputStyle = {
  padding: 8,
  background: '#111827',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  fontSize: 12,
};

const saveBtn = {
  padding: 8,
  background: '#0284c7',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
};

const clearBtn = {
  ...saveBtn,
  background: 'rgba(239,68,68,0.25)',
  alignSelf: 'flex-start',
};
