import {
  getDeepgramKeySource,
  hasBundledDeepgramKey,
  hasConfiguredDeepgramKey,
  isRememberExpired,
} from './deepgramRuntimeKey';
export const getDeepgramBlockReason = () => {
  if (hasConfiguredDeepgramKey()) return null;
  try {
    if (localStorage.getItem('dg_cipher')) return 'vault_locked';
  } catch (_) {}
  if (isRememberExpired()) return 'remember_expired';
  if (!hasBundledDeepgramKey()) return 'bundled_missing';
  return 'no_key';
};

const PROMPTS = {
  no_key: {
    title: 'Deepgram key needed',
    body: 'Live transcription uses Deepgram. Paste your API key below (free tier at console.deepgram.com).',
    onConnect:
      'Connect could not start — no Deepgram key on this browser. Paste a key below, or ask your host to set REACT_APP_DEEPGRAM_API_KEY on Vercel and redeploy.',
  },
  bundled_missing: {
    title: 'Build key missing',
    body:
      'This install expects REACT_APP_DEEPGRAM_API_KEY at deploy time (Vercel → Environment Variables → Production → redeploy). Until then, paste your own key below.',
    onConnect:
      'Connect could not start — the production build has no bundled Deepgram key.',
  },
  vault_locked: {
    title: 'Unlock your saved key',
    body: 'An encrypted Deepgram key is stored on this device. Enter your master password below.',
    onConnect:
      'You pressed Connect — unlock your saved Deepgram key to start transcription.',
  },
  remember_expired: {
    title: 'Session expired',
    body: 'Your remembered unlock expired. Paste your key again or enter your vault password.',
    onConnect:
      'You pressed Connect — your remembered Deepgram unlock expired.',
  },
};

/** Banner copy for Settings → Deepgram when opened programmatically. */
export const getDeepgramSettingsPrompt = (reason, trigger = 'general') => {
  const block = reason || getDeepgramBlockReason();
  if (!block) {
    const source = getDeepgramKeySource();
    if (source === 'env' && hasBundledDeepgramKey()) {
      return {
        title: 'Key already configured',
        body: 'This build includes a server Deepgram key (.env). You should not need to paste one — try Connect again or check your network.',
        tone: 'info',
      };
    }
    return null;
  }
  const base = PROMPTS[block] || PROMPTS.no_key;
  const extra = trigger === 'connect' ? base.onConnect : null;
  return {
    title: base.title,
    body: [extra, base.body].filter(Boolean).join(' '),
    tone: 'warn',
  };
};

/** Soft nudge only — never hijack Connect into Settings. */
export const notifyDeepgramKeyNeeded = (trigger = 'connect') => {
  try {
    window.dispatchEvent(
      new CustomEvent('cat_deepgram_key_needed', {
        detail: { reason: getDeepgramBlockReason() || 'no_key', trigger },
      }),
    );
  } catch (_) {}
};

export const dispatchOpenDeepgramSettings = (trigger = 'general', reason = null) => {
  try {
    window.dispatchEvent(
      new CustomEvent('cat_show_settings', {
        detail: { section: 'deepgram', reason: reason || getDeepgramBlockReason(), trigger },
      }),
    );
  } catch (_) {}
};
