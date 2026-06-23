/** Manual route attestation — clip + sink + mic fingerprint. v4.71.0 */

export const MANUAL_CALL_OK_STORAGE = 'catint_manual_call_ok_v1';
export const LEGACY_CALL_PATH_STORAGE = 'catint_call_path_verified';

export const buildRouteFingerprint = (clipKey, sinkId, micId) =>
  `${clipKey}|${sinkId || ''}|${micId || ''}`;

export const loadManualCallOk = () => {
  try {
    const raw = localStorage.getItem(MANUAL_CALL_OK_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveManualCallOk = (store) => {
  try {
    localStorage.setItem(MANUAL_CALL_OK_STORAGE, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

export const isManualCallOk = (store, clipKey, sinkId, micId) => {
  const fp = buildRouteFingerprint(clipKey, sinkId, micId);
  return !!store[fp];
};

export const setManualCallOk = (store, clipKey, sinkId, micId) => {
  const fp = buildRouteFingerprint(clipKey, sinkId, micId);
  const next = {
    ...store,
    [fp]: {
      at: Date.now(),
      clipKey,
      sinkId: sinkId || '',
      micId: micId || '',
    },
  };
  saveManualCallOk(next);
  return next;
};

/** Legacy auto-verify proofs are ignored — one-time console note. */
export const warnLegacyCallPathStorage = () => {
  try {
    if (localStorage.getItem(LEGACY_CALL_PATH_STORAGE)) {
      console.info(
        '[soundboard] Legacy call-path proofs (catint_call_path_verified) ignored since v4.71 — re-run Call Test and confirm CALL OK.',
      );
    }
  } catch {
    /* ignore */
  }
};
