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
    body: 'Your saved Deepgram key is locked on this device. Press Unlock below. If the password is already filled in, just press Unlock; otherwise enter it first.',
    onConnect:
      'Transcription is blocked: the saved Deepgram key is locked. The key vault is open below — press Unlock to restore transcription.',
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

/**
 * Critical-call recovery: no usable key means STT cannot work. Take the
 * operator directly to the saved-key Unlock form instead of leaving a vague
 * failure after audio capture. Do not remove this without an equally direct,
 * tested recovery path.
 */
export const notifyDeepgramKeyNeeded = (trigger = 'connect') => {
  try {
    const reason = getDeepgramBlockReason() || 'no_key';
    window.dispatchEvent(
      new CustomEvent('cat_deepgram_key_needed', {
        detail: { reason, trigger },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('cat_show_settings', {
        detail: { section: 'deepgram', reason, trigger },
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
