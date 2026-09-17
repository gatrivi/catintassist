/** Conservative ghost-call protection. Silence can be a hold, so never end it early. */
export const GHOST_CALL_SILENCE_SECONDS = 7 * 60;

 // v4.130.1: a dead Deepgram path also produces "silence" — an STT outage,
 // update reload, or manual disconnect/reconnect is NOT a call end. Only
 // auto-end when the audio path is provably alive (DG connected) yet silent.
export const shouldAutoEndGhostCall = ({ silenceSecs, promptCount, isHold, dgConnected = true }) =>
  !isHold && dgConnected && promptCount >= 3 && silenceSecs > GHOST_CALL_SILENCE_SECONDS;
