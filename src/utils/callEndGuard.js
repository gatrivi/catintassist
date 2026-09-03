/** Conservative ghost-call protection. Silence can be a hold, so never end it early. */
export const GHOST_CALL_SILENCE_SECONDS = 7 * 60;

export const shouldAutoEndGhostCall = ({ silenceSecs, promptCount, isHold }) =>
  !isHold && promptCount >= 3 && silenceSecs > GHOST_CALL_SILENCE_SECONDS;
