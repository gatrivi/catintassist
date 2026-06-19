/** Deepgram WebSocket close-code → plain-language diagnosis (STT live). */

export const FAILURE = {
  AUTH: 'auth',
  NETWORK: 'network',
  AUDIO: 'audio',
  TIMEOUT: 'timeout',
  QUOTA: 'quota',
  UNKNOWN: 'unknown',
};

const CLOSE_HINTS = {
  '1006': {
    category: FAILURE.AUTH,
    hint: 'Connection dropped during handshake — often wrong API key, firewall, or VPN blocking wss://api.deepgram.com.',
  },
  '1008': {
    category: FAILURE.AUDIO,
    hint: 'Deepgram could not decode audio (DATA error). Check tab shares audio; try mic mode.',
  },
  '1009': {
    category: FAILURE.AUDIO,
    hint: 'Audio packet too large.',
  },
  '1011': {
    category: FAILURE.TIMEOUT,
    hint: 'Deepgram timed out waiting for audio (NET error). Tab may be silent — enable Share audio or speak to test.',
  },
  '1015': {
    category: FAILURE.NETWORK,
    hint: 'TLS/HTTPS issue reaching Deepgram.',
  },
};

export const classifyDeepgramClose = (code, reason = '') => {
  const codeStr = String(code || '');
  const r = (reason || '').toString();
  const rLow = r.toLowerCase();

  if (
    rLow.includes('unauthorized') ||
    rLow.includes('forbidden') ||
    (rLow.includes('invalid') && (rLow.includes('token') || rLow.includes('key'))) ||
    rLow.includes('permission') ||
    r.includes('401') ||
    r.includes('403')
  ) {
    return {
      category: FAILURE.AUTH,
      code: codeStr,
      reason: r,
      hint: 'API key rejected or lacks live streaming permission. Check Deepgram console → API keys → scopes.',
    };
  }

  if (r.includes('NET-0001') || rLow.includes('net-0001')) {
    return {
      category: FAILURE.TIMEOUT,
      code: codeStr,
      reason: r,
      hint: 'No audio reached Deepgram in time. Share tab audio, unmute the call, or use mic mode.',
    };
  }

  if (r.includes('DATA-0000') || rLow.includes('data-0000')) {
    return {
      category: FAILURE.AUDIO,
      code: codeStr,
      reason: r,
      hint: 'Audio format not recognized. Re-pick the tab with Share audio checked.',
    };
  }

  if (rLow.includes('quota') || rLow.includes('balance') || rLow.includes('credits')) {
    return {
      category: FAILURE.QUOTA,
      code: codeStr,
      reason: r,
      hint: 'Deepgram account quota/balance issue — check dashboard billing.',
    };
  }

  const base = CLOSE_HINTS[codeStr];
  if (base) {
    return { category: base.category, code: codeStr, reason: r, hint: base.hint };
  }

  if (codeStr === '1000') {
    return { category: null, code: codeStr, reason: r, hint: 'Normal close.' };
  }

  return {
    category: FAILURE.UNKNOWN,
    code: codeStr,
    reason: r,
    hint: r || `WebSocket closed (code ${codeStr || '?'})`,
  };
};

export const buildFailureMessage = ({ category, hint, keySource, keyMasked, socketLang }) => {
  const keyLine =
    keySource && keySource !== 'none'
      ? `Key: ${keySource} (${keyMasked})`
      : 'Key: missing';
  const prefix = socketLang ? `[${socketLang.toUpperCase()} socket] ` : '';
  const catLabel = {
    [FAILURE.AUTH]: 'API KEY / AUTH',
    [FAILURE.NETWORK]: 'NETWORK',
    [FAILURE.AUDIO]: 'AUDIO',
    [FAILURE.TIMEOUT]: 'TIMEOUT',
    [FAILURE.QUOTA]: 'QUOTA',
    [FAILURE.UNKNOWN]: 'UNKNOWN',
  }[category] || 'ERROR';

  return `${prefix}${catLabel}: ${hint} · ${keyLine}`;
};

export const isLikelyAuthClose = (code, reason = '') => {
  const { category } = classifyDeepgramClose(code, reason);
  return category === FAILURE.AUTH;
};
