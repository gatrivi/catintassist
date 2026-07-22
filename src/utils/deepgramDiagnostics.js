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

/**
 * Classify offline DG health probe results (scripts/dg-health-probe.js).
 * Pure — no network. Use when status page is green but app still "down".
 */
export const classifyDeepgramHealthProbe = ({
  keyPresent = false,
  projectsHttp = null,
  listenHttp = null,
  wsOk = null,
  wsSkipped = false,
} = {}) => {
  if (!keyPresent) {
    return {
      verdict: 'NO_KEY',
      category: FAILURE.AUTH,
      hint: 'No REACT_APP_DEEPGRAM_API_KEY in .env.local / .env (or runtime key).',
    };
  }

  const authish = (code) => code === 401 || code === 403;
  if (authish(projectsHttp) || authish(listenHttp)) {
    return {
      verdict: 'AUTH_BAD',
      category: FAILURE.AUTH,
      hint: 'API key rejected on projects/listen — rotate key or check scopes in Deepgram console.',
    };
  }

  if (projectsHttp != null && projectsHttp !== 200) {
    return {
      verdict: 'DEGRADED',
      category: FAILURE.NETWORK,
      hint: `Projects API HTTP ${projectsHttp} — network, DNS, or Deepgram outage.`,
    };
  }

  if (listenHttp != null && listenHttp !== 200) {
    return {
      verdict: 'DEGRADED',
      category: listenHttp >= 500 ? FAILURE.UNKNOWN : FAILURE.AUDIO,
      hint: `Prerecorded listen HTTP ${listenHttp} — STT endpoint unhealthy or request rejected.`,
    };
  }

  if (wsOk === false && !wsSkipped) {
    return {
      verdict: 'DEGRADED',
      category: FAILURE.NETWORK,
      hint: 'Live wss:// listen handshake failed — firewall/VPN/proxy or Streaming API issue.',
    };
  }

  if (projectsHttp === 200 && (listenHttp == null || listenHttp === 200) && (wsOk === true || wsOk == null || wsSkipped)) {
    return {
      verdict: 'OK',
      category: null,
      hint: 'Key + Deepgram API healthy. If app still fails, check tab audio / sink route / browser console [CAT STT].',
    };
  }

  return {
    verdict: 'DEGRADED',
    category: FAILURE.UNKNOWN,
    hint: 'Incomplete probe — re-run scripts/dg-health-probe.js.',
  };
};
