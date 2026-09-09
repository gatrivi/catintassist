/**
 * Device label memory (v4.87.0).
 *
 * Chrome hides device labels (and hands out throwaway readings) until the
 * user Allows the mic once per origin. Without memory, the VB-out picker
 * shows gibberish ("Output a1b2…") on a fresh origin and the user cannot
 * pick CABLE Input / Voicemeeter Input.
 *
 * Fix: remember every non-blank label we ever see (keyed by deviceId) and
 * show the remembered name when the live label is blank.
 */

export const DEVICE_LABELS_KEY = "CATINTASSIST_DEVICE_LABELS";
const MAX_ENTRIES = 60;

export const readKnownDeviceLabels = (
  storage = typeof localStorage !== "undefined" ? localStorage : null,
) => {
  try {
    if (!storage) return {};
    return JSON.parse(storage.getItem(DEVICE_LABELS_KEY) || "{}") || {};
  } catch (_) {
    return {};
  }
};

/** Merge non-blank labels into memory. Pure-ish: returns the merged map. */
export const rememberDeviceLabels = (
  devices = [],
  storage = typeof localStorage !== "undefined" ? localStorage : null,
) => {
  const known = readKnownDeviceLabels(storage);
  let changed = false;
  (devices || []).forEach((d) => {
    const label = (d?.label || "").trim();
    if (d?.deviceId && label && known[d.deviceId] !== label) {
      known[d.deviceId] = label;
      changed = true;
    }
  });
  if (changed) {
    try {
      const keys = Object.keys(known);
      const trimmed =
        keys.length > MAX_ENTRIES
          ? Object.fromEntries(keys.slice(keys.length - MAX_ENTRIES).map((k) => [k, known[k]]))
          : known;
      storage?.setItem(DEVICE_LABELS_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch (_) {}
  }
  return known;
};

/**
 * Display name for a picker option.
 * Live label > remembered label > stable "Output N" slot (never a raw deviceId hash).
 */
export const displayDeviceName = (device, index = 0, kind = "out", known = null) => {
  const live = (device?.label || "").trim();
  if (live) return live.length > 26 ? `${live.slice(0, 26)}…` : live;
  const memo = known || readKnownDeviceLabels();
  const remembered = device?.deviceId ? (memo[device.deviceId] || "").trim() : "";
  if (remembered) return remembered.length > 26 ? `${remembered.slice(0, 26)}…` : remembered;
  const slot = Number.isFinite(index) ? index + 1 : 1;
  return kind === "mic" ? `Mic ${slot} · names hidden` : `Output ${slot} · names hidden`;
};

/** True when any device in the list is hiding its label (fresh origin). */
export const hasHiddenLabels = (devices = []) =>
  (devices || []).some((d) => !(d?.label || "").trim());
