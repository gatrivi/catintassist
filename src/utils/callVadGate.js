/**
 * v4.205.0 — call-time "is someone speaking?" gate that adapts to the line.
 *
 * Problem: a fixed 0.02 RMS bar. Tab audio from the call platform can sit
 * below it, so the app never "heard speech" → the CONNECT watchdog and the
 * red "deaf" banner never fired → only ZAP saved the call.
 *
 * Fix: learn the line's noise floor, call it speech at floor × 3,
 * clamped between 0.004 (never trip on digital hiss) and 0.02 (never
 * stricter than before). 2 loud ticks in a row (~500 ms) = speech,
 * so a single click/pop doesn't count.
 *
 * Call VAD only. The idle ear keeps the fixed bar (it starts billing).
 */
export const CALL_VAD_MIN_THRESHOLD = 0.004;
export const CALL_VAD_MAX_THRESHOLD = 0.02;
export const CALL_VAD_FLOOR_MULT = 3;
export const CALL_VAD_LOUD_TICKS = 2;
const FLOOR_START = 0.002; // assume a quiet line until we learn otherwise
const FLOOR_MIN = 0.001; // pure digital silence must not drag the bar to 0
const FLOOR_RISE = 0.002; // slow up (~2 min at 4 ticks/s): speech can't lift it fast

export const createCallVadGate = () => ({ floor: FLOOR_START, loudTicks: 0, peak: 0 });

export const callVadThreshold = (floor) =>
  Math.min(CALL_VAD_MAX_THRESHOLD, Math.max(CALL_VAD_MIN_THRESHOLD, floor * CALL_VAD_FLOOR_MULT));

/** Feed one RMS tick. Mutates the gate; returns true when this tick = speech. */
export function feedCallVad(gate, rms) {
  const r = Number.isFinite(rms) ? rms : 0;
  if (r > gate.peak) gate.peak = r;
  const loud = r >= callVadThreshold(gate.floor);
  // Floor: fast down, slow up — and never learn from loud ticks.
  if (r < gate.floor) gate.floor = Math.max(FLOOR_MIN, r);
  else if (!loud) gate.floor += (r - gate.floor) * FLOOR_RISE;
  gate.loudTicks = loud ? gate.loudTicks + 1 : 0;
  return gate.loudTicks >= CALL_VAD_LOUD_TICKS;
}
