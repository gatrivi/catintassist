/**
 * Turn end (v4.197.0) — when does a new bubble start?
 *
 * OLD (switch OFF, default): wall clock. >2.5 s between two transcript
 * messages = new turn. Problem (10-19 calls): Deepgram can pause 2.5 s+ in the
 * MIDDLE of a sentence (network / processing), which split one sentence in two.
 *
 * NEW (switch ON): audio clock. Deepgram's own `UtteranceEnd` event fires after
 * `utterance_end_ms` of real SILENCE in the audio (word timings, not wall time).
 * The next transcript after an UtteranceEnd on the SAME socket starts a turn.
 * Safety net: a very long wall gap (8 s) still starts a turn, in case an
 * UtteranceEnd is ever missed.
 *
 * Pure functions only — useDeepgram holds the state.
 */
export const TURN_END_SWITCH_KEY = 'catint_stt_utterance_end_v1';
export const UTTERANCE_END_MS = 1000;
export const WALL_GAP_MS = 2500; // the v4.x rule, unchanged when the switch is off
export const WALL_GAP_SAFETY_MS = 8000; // switch on: only a missed UtteranceEnd

export const readTurnEndSwitch = () => {
  try {
    return localStorage.getItem(TURN_END_SWITCH_KEY) === '1';
  } catch {
    return false;
  }
};

export const saveTurnEndSwitch = (on) => {
  try {
    localStorage.setItem(TURN_END_SWITCH_KEY, on ? '1' : '0');
  } catch {
    /* private mode: stays off */
  }
  return readTurnEndSwitch();
};

export const isUtteranceEndMessage = (msg) =>
  String(msg?.type || '').toLowerCase() === 'utteranceend';

/**
 * @param {{ gapMs:number, switchOn:boolean, utteranceEndedSinceLast:boolean }} args
 * @returns {boolean} true = this transcript starts a new turn (new bubble)
 */
export const isTurnBreak = ({ gapMs, switchOn, utteranceEndedSinceLast }) => {
  if (!switchOn) return gapMs > WALL_GAP_MS;
  return Boolean(utteranceEndedSinceLast) || gapMs > WALL_GAP_SAFETY_MS;
};
