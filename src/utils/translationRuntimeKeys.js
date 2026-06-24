/** Env-first translation keys — same pattern as Deepgram (v4.73.1). */

const DEFAULT_AZURE_REGION = 'brazilsouth';

const trim = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

const fromEnv = (name) => trim(process.env[name]);

const fromStorage = (name) => {
  try {
    return trim(localStorage.getItem(name));
  } catch {
    return '';
  }
};

/** Env wins, then localStorage (Settings form). */
export const getTranslationApiKeys = () => ({
  DEEPL: fromEnv('REACT_APP_DEEPL_API_KEY') || fromStorage('DEEPL_API_KEY'),
  OPENAI: fromEnv('REACT_APP_OPENAI_API_KEY') || fromStorage('OPENAI_API_KEY'),
  AZURE:
    fromEnv('REACT_APP_AZURE_TRANSLATOR_KEY') || fromStorage('AZURE_TRANSLATOR_KEY'),
  AZURE_REGION:
    fromEnv('REACT_APP_AZURE_TRANSLATOR_REGION') ||
    fromStorage('AZURE_TRANSLATOR_REGION') ||
    DEFAULT_AZURE_REGION,
});

export const getTranslationKeyStatus = () => {
  const keys = getTranslationApiKeys();
  return {
    deepl: !!keys.DEEPL,
    openai: !!keys.OPENAI,
    azure: !!keys.AZURE,
    azureRegion: keys.AZURE_REGION,
    sources: {
      deepl: fromEnv('REACT_APP_DEEPL_API_KEY')
        ? 'env'
        : fromStorage('DEEPL_API_KEY')
          ? 'settings'
          : 'none',
      openai: fromEnv('REACT_APP_OPENAI_API_KEY')
        ? 'env'
        : fromStorage('OPENAI_API_KEY')
          ? 'settings'
          : 'none',
      azure: fromEnv('REACT_APP_AZURE_TRANSLATOR_KEY')
        ? 'env'
        : fromStorage('AZURE_TRANSLATOR_KEY')
          ? 'settings'
          : 'none',
    },
  };
};
