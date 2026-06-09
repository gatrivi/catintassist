import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { DEFAULT_LANG_PAIR, isDefaultPair } from '../config/languages';

const STORAGE_KEY = 'catint_lang_pair';

const LanguageContext = createContext();

const loadPair = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.source && parsed?.target) return parsed;
  } catch (_) {}
  return null;
};

export const LanguageProvider = ({ children }) => {
  const [customPair, setCustomPairState] = useState(loadPair);
  const [captureMode, setCaptureMode] = useState('mic'); // last connect: 'mic' | 'tab'

  const setCustomPair = useCallback((pair) => {
    if (!pair || isDefaultPair(pair)) {
      setCustomPairState(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setCustomPairState(pair);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pair));
  }, []);

  const resetToDefault = useCallback(() => setCustomPair(null), [setCustomPair]);

  const displayPair = customPair || DEFAULT_LANG_PAIR;

  const value = useMemo(() => ({
    sourceLang: displayPair.source,
    targetLang: displayPair.target,
    customPair,
    displayPair,
    isDefaultPair: isDefaultPair(displayPair),
    setCustomPair,
    resetToDefault,
    captureMode,
    setCaptureMode,
  }), [displayPair, customPair, setCustomPair, resetToDefault, captureMode]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
