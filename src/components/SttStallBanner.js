import React, { useState } from 'react';
import { STT_STALL_TEXT } from '../utils/dgStatus';
import { APP_VERSION_LABEL } from '../constants/version';

/**
 * v4.179.0 — red bar over the transcript when transcription has stopped.
 * Before this, a stop looked exactly like a quiet call. `reason` comes from
 * useDeepgram().sttStall (pure rules: sttStallReason in dgStatus.js).
 * v4.201.0 — 1-tap clipboard log copy button (zero-DevTools on-call debugging).
 */
export function SttStallBanner({ reason, onZap }) {
  const [copied, setCopied] = useState(false);
  if (!reason) return null;

  const handleCopy = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.__CAT_INCIDENT === 'function') {
        window.__CAT_INCIDENT();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="stt-stall-banner" role="alert" data-reason={reason}>
      <span>⚠ {STT_STALL_TEXT[reason] || 'Transcription stopped'}</span>
      <button type="button" onClick={onZap}>⚡ ZAP</button>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy 15-line diagnostic snapshot to clipboard"
        aria-label="Copy incident diagnostic log"
      >
        {copied ? 'Copied ✓' : '📋 Copy Log'}
      </button>
      <span className="stt-stall-ver">{APP_VERSION_LABEL}</span>
    </div>
  );
}

export default SttStallBanner;
