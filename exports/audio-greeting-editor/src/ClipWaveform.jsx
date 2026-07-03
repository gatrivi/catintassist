/**
 * Mini waveform for clip lists (SVG bars + playback progress).
 * From GreetingsPanel.js ClipWaveform — v4.77.0
 */

import React from 'react';

export const ClipWaveform = ({ peaks, progress = 0, height = 28, playedColor = '#34d399', idleColor = '#64748b' }) => {
  if (!peaks?.length) {
    return <div className="age-clip-waveform age-clip-waveform--loading" style={{ height }} aria-hidden />;
  }
  const barW = 100 / peaks.length;
  return (
    <svg
      className="age-clip-waveform"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height }}
      aria-hidden
    >
      {peaks.map((peak, i) => {
        const h = Math.max(6, peak * 90);
        const played = (i + 1) / peaks.length <= progress;
        return (
          <rect
            key={i}
            x={i * barW}
            y={(100 - h) / 2}
            width={barW * 0.7}
            height={h}
            fill={played ? playedColor : idleColor}
            opacity={played ? 0.95 : 0.5}
            rx="0.5"
          />
        );
      })}
    </svg>
  );
};
