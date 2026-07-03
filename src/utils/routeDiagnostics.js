/** Soundboard / TTS route diagnostics — ring buffer for STT-load repro (v4.75.0). */

const MAX_EVENTS = 40;
const events = [];

export const ROUTE_EVENT = {
  PLAY_START: 'play_start',
  PLAY_END: 'play_end',
  PLAY_FAIL: 'play_fail',
  SINK_BIND: 'sink_bind',
  PASSTHROUGH_INJECT: 'passthrough_inject',
  PASSTHROUGH_RESTORE: 'passthrough_restore',
  STT_LOAD_WARN: 'stt_load_warn',
  FALLBACK_DUAL: 'fallback_dual',
};

/** @returns {boolean} */
export const isSttActive = () => {
  try {
    return window.__CAT_STT_ACTIVE === true;
  } catch {
    return false;
  }
};

export const setSttActive = (active) => {
  try {
    window.__CAT_STT_ACTIVE = !!active;
  } catch (_) {}
};

/**
 * @param {string} type
 * @param {Record<string, unknown>} [data]
 */
export const logRouteEvent = (type, data = {}) => {
  const entry = {
    type,
    at: Date.now(),
    sttActive: isSttActive(),
    ...data,
  };
  events.unshift(entry);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  try {
    window.__CAT_ROUTE_DIAG = events;
  } catch (_) {}
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[route]', type, entry);
  }
  return entry;
};

export const getRouteDiagnostics = () => [...events];

export const clearRouteDiagnostics = () => {
  events.length = 0;
  try {
    window.__CAT_ROUTE_DIAG = events;
  } catch (_) {}
};

/**
 * Flag likely crackle-under-STT when patient route fires while Deepgram is live.
 * @param {{ sttActive?: boolean, routeMode?: string, sinkBound?: boolean }} snap
 */
export const assessSttLoadRisk = (snap) => {
  const stt = snap.sttActive ?? isSttActive();
  const dualWhileStt = stt && snap.routeMode === 'dual_element';
  const unboundWhileStt = stt && snap.sinkBound === false;
  if (dualWhileStt || unboundWhileStt) {
    return {
      risky: true,
      reason: dualWhileStt
        ? 'Dual-element route while STT active — prefer passthrough injection'
        : 'Sink bind failed while STT active',
    };
  }
  return { risky: false, reason: null };
};

export const formatRouteDiagLine = (e) => {
  const t = new Date(e.at).toLocaleTimeString();
  const stt = e.sttActive ? ' STT' : '';
  const clip = e.clipKey ? ` ${e.clipKey}` : '';
  const mode = e.routeMode ? ` [${e.routeMode}]` : '';
  return `${t}${stt} ${e.type}${clip}${mode}`;
};
