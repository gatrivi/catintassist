/**
 * Interactive bar waveform — selection, silences (red), playhead.
 * From AudioEditorPanel.js WaveformCanvas — v4.77.0
 */

import React, { useEffect, useRef, useCallback } from 'react';

export function WaveformCanvas({
  peaks,
  duration,
  selection,
  playhead,
  silences,
  onSelectionChange,
  height = 120,
  width = 680,
}) {
  const canvasRef = useRef(null);
  const dragging = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const mid = H / 2;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isDark ? '#1a1a1a' : '#f8f8f6';
    ctx.fillRect(0, 0, W, H);

    if (silences && duration > 0) {
      ctx.fillStyle = isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)';
      for (const s of silences) {
        const x1 = (s.start / duration) * W;
        const x2 = (s.end / duration) * W;
        ctx.fillRect(x1, 0, x2 - x1, H);
      }
    }

    if (selection && selection.start !== selection.end && duration > 0) {
      const x1 = (Math.min(selection.start, selection.end) / duration) * W;
      const x2 = (Math.max(selection.start, selection.end) / duration) * W;
      ctx.fillStyle = isDark ? 'rgba(99,102,241,0.28)' : 'rgba(99,102,241,0.18)';
      ctx.fillRect(x1, 0, x2 - x1, H);
      ctx.strokeStyle = isDark ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, H);
      ctx.stroke();
    }

    for (let i = 0; i < peaks.length; i++) {
      const x = i;
      const amp = peaks[i];
      const barH = Math.max(1, amp * (H - 8));
      const inSelection =
        selection &&
        duration > 0 &&
        i / peaks.length >= Math.min(selection.start, selection.end) / duration &&
        i / peaks.length <= Math.max(selection.start, selection.end) / duration;
      ctx.fillStyle = inSelection
        ? isDark
          ? '#818cf8'
          : '#6366f1'
        : isDark
          ? '#555550'
          : '#b0afa8';
      ctx.fillRect(x, mid - barH / 2, 1, barH);
    }

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();

    if (playhead !== null && duration > 0) {
      const px = (playhead / duration) * W;
      ctx.strokeStyle = isDark ? '#f87171' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
      ctx.fillStyle = isDark ? '#f87171' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(px - 5, 0);
      ctx.lineTo(px + 5, 0);
      ctx.lineTo(px, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [peaks, duration, selection, playhead, silences, height]);

  const posToTime = useCallback(
    (clientX) => {
      const canvas = canvasRef.current;
      if (!canvas || !duration) return 0;
      const rect = canvas.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return frac * duration;
    },
    [duration],
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const t = posToTime(e.clientX);
      dragging.current = { startT: t };
      onSelectionChange({ start: t, end: t });
      canvasRef.current?.setPointerCapture(e.pointerId);
    },
    [posToTime, onSelectionChange],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      const t = posToTime(e.clientX);
      onSelectionChange({ start: dragging.current.startT, end: t });
    },
    [posToTime, onSelectionChange],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="age-waveform-canvas"
      style={{
        width: '100%',
        height: `${height}px`,
        cursor: 'crosshair',
        display: 'block',
        borderRadius: '6px',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
