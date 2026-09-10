import React, { useEffect, useState } from 'react';
import {
  formatMicChip,
  readLastVerify,
  readPinnedClientMicLabel,
} from '../utils/micVerify';

/**
 * One-glance mic status chip (v4.97.0): pinned client mic + last verify verdict.
 * Reads localStorage only (no streams) — the panel writes the verdict.
 */
export const MicVerifyChip = ({ title = 'Mic verify — open MIC VERIFY in the idle pane, press TEST before going avail' }) => {
  const [chip, setChip] = useState(() => formatMicChip(readLastVerify(), { fallbackLabel: readPinnedClientMicLabel() }));

  useEffect(() => {
    const refresh = () => setChip(formatMicChip(readLastVerify(), { fallbackLabel: readPinnedClientMicLabel() }));
    refresh();
    // Panel dispatches 'catint_mic_verified' after a run; interval covers pin changes.
    window.addEventListener('catint_mic_verified', refresh);
    const iv = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('catint_mic_verified', refresh);
      clearInterval(iv);
    };
  }, []);

  if (!chip) return null;
  return (
    <span
      className="mic-verify-chip"
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3em',
        fontSize: '0.66rem',
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        color: chip.color,
        border: `1px solid ${chip.color}44`,
        borderRadius: 999,
        padding: '0 0.5em',
        lineHeight: '1.5',
        whiteSpace: 'nowrap',
      }}
    >
      {chip.text}
    </span>
  );
};
