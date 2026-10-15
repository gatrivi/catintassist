/**
 * v4.176.0 — header show/hide toggles (operator rule: "for hide/show, a toggle
 * is the answer"). Each toggle is one remembered boolean in localStorage.
 *
 *  gridInCall — ▦ shows the 12-cell grid under the compact CALL header.
 *               Default OFF (= the compact header as it always was).
 *  ioStrip    — IO shows the audio-route strip. Default ON (= as it always was).
 *               Hidden or not, it comes back by itself when audio is broken.
 */
const KEYS = {
  gridInCall: 'catint_header_grid_in_call_v1',
  ioStrip: 'catint_header_io_strip_v1',
};
const DEFAULTS = { gridInCall: false, ioStrip: true };

export function loadHeaderToggle(name) {
  try {
    const raw = localStorage.getItem(KEYS[name]);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* storage blocked → default */
  }
  return DEFAULTS[name];
}

export function saveHeaderToggle(name, on) {
  try {
    localStorage.setItem(KEYS[name], on ? '1' : '0');
  } catch {
    /* storage blocked → only this session remembers */
  }
  return on;
}

/** The IO strip may be hidden, but never while the audio route is broken. */
export function shouldShowIoStrip({ ioStripOn, isActive, isZombieCall, audioAttached, virtualCableFailure }) {
  if (ioStripOn) return true;
  if (virtualCableFailure) return true;
  return Boolean((isActive || isZombieCall) && !audioAttached);
}
