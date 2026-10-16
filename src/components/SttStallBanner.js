import React from 'react';
import { STT_STALL_TEXT } from '../utils/dgStatus';
import { APP_VERSION_LABEL } from '../constants/version';

/**
 * v4.179.0 — red bar over the transcript when transcription has stopped.
 * Before this, a stop looked exactly like a quiet call. `reason` comes from
 * useDeepgram().sttStall (pure rules: sttStallReason in dgStatus.js).
 */
export function SttStallBanner({ reason, onZap }) {
  if (!reason) return null;
  return (
    <div className="stt-stall-banner" role="alert" data-reason={reason}>
      <span>⚠ {STT_STALL_TEXT[reason] || 'Transcription stopped'}</span>
      <button type="button" onClick={onZap}>⚡ ZAP</button>
      <span className="stt-stall-ver">{APP_VERSION_LABEL}</span>
    </div>
  );
}

export default SttStallBanner;
