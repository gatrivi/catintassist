import React, { useState } from 'react';

const DEEPL_KEY = 'DEEPL_API_KEY';
const OPENAI_KEY = 'OPENAI_API_KEY';
const AZURE_KEY = 'AZURE_TRANSLATOR_KEY';
const AZURE_REGION_KEY = 'AZURE_TRANSLATOR_REGION';
const DEFAULT_AZURE_REGION = 'brazilsouth';

export const TranslationKeysForm = () => {
  const [deepl, setDeepl] = useState('');
  const [openai, setOpenai] = useState('');
  const [azure, setAzure] = useState('');
  const [azureRegion, setAzureRegion] = useState('');
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

  const hasAzure = (() => {
    try {
      return !!localStorage.getItem(AZURE_KEY);
    } catch {
      return false;
    }
  })();
  const savedAzureRegion = (() => {
    try {
      return localStorage.getItem(AZURE_REGION_KEY) || DEFAULT_AZURE_REGION;
    } catch {
      return DEFAULT_AZURE_REGION;
    }
  })();

  const save = (e) => {
    e.preventDefault();
    try {
      if (deepl.trim()) localStorage.setItem(DEEPL_KEY, deepl.trim());
      if (openai.trim()) localStorage.setItem(OPENAI_KEY, openai.trim());
      if (azure.trim()) localStorage.setItem(AZURE_KEY, azure.trim());
      if (azureRegion.trim()) localStorage.setItem(AZURE_REGION_KEY, azureRegion.trim());
      setDeepl('');
      setOpenai('');
      setAzure('');
      setAzureRegion('');
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
        Optional — REACT_APP_* env vars override (same as Deepgram). Form is fallback only.
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
      <label style={{ fontSize: 11, color: '#93c5fd' }}>
        Azure Translator Key {hasAzure ? '• saved' : ''}
      </label>
      <input
        type="password"
        value={azure}
        onChange={(e) => setAzure(e.target.value)}
        placeholder={hasAzure ? '••••••••' : 'Azure subscription key'}
        style={inputStyle}
      />
      {hasAzure && (
        <button type="button" onClick={() => clearKey(AZURE_KEY)} style={clearBtn}>
          Clear Azure
        </button>
      )}
      <label style={{ fontSize: 11, color: '#93c5fd' }}>
        Azure Region {hasAzure ? `• ${savedAzureRegion}` : ''}
      </label>
      <input
        type="text"
        value={azureRegion}
        onChange={(e) => setAzureRegion(e.target.value)}
        placeholder={savedAzureRegion}
        style={inputStyle}
      />
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
