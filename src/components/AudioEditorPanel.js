import { useState, useEffect, useRef, useCallback } from 'react';
import { createSpeechProcessingGraph, createNoiseGate } from '../utils/audioProcessing';

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function pcmToWavBlob(audioBuffer) {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function detectSilences(audioBuffer, threshold = 0.015, minDuration = 0.25) {
  const data = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const windowSize = Math.floor(sr * 0.02);
  const silences = [];
  let silStart = null;
  for (let i = 0; i < data.length; i += windowSize) {
    const slice = data.slice(i, i + windowSize);
    const rms = Math.sqrt(slice.reduce((acc, v) => acc + v * v, 0) / slice.length);
    const timeSec = i / sr;
    if (rms < threshold) {
      if (silStart === null) silStart = timeSec;
    } else {
      if (silStart !== null) {
        const dur = timeSec - silStart;
        if (dur >= minDuration) silences.push({ start: silStart, end: timeSec });
        silStart = null;
      }
    }
  }
  if (silStart !== null) {
    const dur = audioBuffer.duration - silStart;
    if (dur >= minDuration) silences.push({ start: silStart, end: audioBuffer.duration });
  }
  return silences;
}

function spliceAudioBuffer(ctx, original, replacement, startSec, endSec) {
  const sr = original.sampleRate;
  const startSample = Math.floor(startSec * sr);
  const endSample = Math.floor(endSec * sr);
  const beforeLength = startSample;
  const repLength = replacement ? replacement.length : 0;
  const afterLength = original.length - endSample;
  const newLength = beforeLength + repLength + afterLength;
  const result = ctx.createBuffer(1, newLength, sr);
  const out = result.getChannelData(0);
  out.set(original.getChannelData(0).slice(0, startSample), 0);
  if (replacement) out.set(replacement.getChannelData(0), startSample);
  out.set(original.getChannelData(0).slice(endSample), startSample + repLength);
  return result;
}

async function audioBufferToBlob(audioBuffer) {
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return pcmToWavBlob(rendered);
}

function buildPeaks(channelData, width) {
  const blockSize = Math.floor(channelData.length / width);
  const peaks = new Float32Array(width);
  for (let i = 0; i < width; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

// ─── WAVEFORM CANVAS ──────────────────────────────────────────────────────────

function WaveformCanvas({
  peaks,
  duration,
  selection,
  playhead,
  silences,
  onSelectionChange,
  height = 120,
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
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();
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
        ? (isDark ? '#818cf8' : '#6366f1')
        : (isDark ? '#555550' : '#b0afa8');
      ctx.fillRect(x, mid - barH / 2, 1, barH);
    }

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

    if (playhead !== null && duration > 0) {
      const px = (playhead / duration) * W;
      ctx.strokeStyle = isDark ? '#f87171' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      ctx.fillStyle = isDark ? '#f87171' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 8);
      ctx.closePath(); ctx.fill();
    }
  }, [peaks, duration, selection, playhead, silences, height]);

  const posToTime = useCallback((clientX) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return 0;
    const rect = canvas.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return frac * duration;
  }, [duration]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const t = posToTime(e.clientX);
    dragging.current = { startT: t };
    onSelectionChange({ start: t, end: t });
    canvasRef.current?.setPointerCapture(e.pointerId);
  }, [posToTime, onSelectionChange]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const t = posToTime(e.clientX);
    onSelectionChange({ start: dragging.current.startT, end: t });
  }, [posToTime, onSelectionChange]);

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={680}
      height={height}
      style={{ width: '100%', height: `${height}px`, cursor: 'crosshair', display: 'block', borderRadius: '6px' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}

function formatTime(sec) {
  if (!sec && sec !== 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

// ─── MAIN EDITOR ──────────────────────────────────────────────────────────────

export default function AudioEditorPanel({
  blob,
  onSave,
  onClose,
  onDelete,
  label = 'Recording',
  localVolume = 1,
}) {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [peaks, setPeaks] = useState(null);
  const [silences, setSilences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [playhead, setPlayhead] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState('full');
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordCountdown, setRecordCountdown] = useState(null);
  const [status, setStatus] = useState(null);

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const graphRef = useRef(null);
  const animRef = useRef(null);
  const playStartRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordCtxRef = useRef(null);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) {}
      sourceRef.current = null;
    }
    if (graphRef.current) {
      graphRef.current.outputGain.disconnect();
      graphRef.current = null;
    }
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    setIsPlaying(false);
    setPlayhead(null);
    playStartRef.current = null;
  }, []);

  useEffect(() => {
    if (!blob) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const arrayBuf = await blob.arrayBuffer();
        const decoded = await audioCtxRef.current.decodeAudioData(arrayBuf);
        setAudioBuffer(decoded);
        setPeaks(buildPeaks(decoded.getChannelData(0), 680));
        setSilences(detectSilences(decoded));
        setSelection({ start: 0, end: 0 });
        setStatus({ type: 'info', text: `Loaded · ${formatTime(decoded.duration)} · ${decoded.sampleRate}Hz` });
      } catch (e) {
        setError('Could not decode audio. Try re-uploading the file.');
      } finally {
        setLoading(false);
      }
    })();
    return () => { stopPlayback(); };
  }, [blob, stopPlayback]);

  useEffect(() => {
    if (!audioBuffer) return;
    setPeaks(buildPeaks(audioBuffer.getChannelData(0), 680));
    setSilences(detectSilences(audioBuffer));
  }, [audioBuffer]);

  const playBuffer = useCallback(async (buf, offsetSec = 0, durationSec = null) => {
    if (!buf) return;
    stopPlayback();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = buf;
    const graph = createSpeechProcessingGraph(ctx, source);
    graph.outputGain.gain.value = localVolume;
    graph.outputGain.connect(ctx.destination);
    sourceRef.current = source;
    graphRef.current = graph;

    const dur = durationSec !== null ? durationSec : buf.duration - offsetSec;
    source.start(0, offsetSec, dur);
    playStartRef.current = { contextTime: ctx.currentTime, audioOffset: offsetSec };
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      setPlayhead(null);
      playStartRef.current = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };

    const tick = () => {
      if (!playStartRef.current || !audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - playStartRef.current.contextTime;
      const currentPos = playStartRef.current.audioOffset + elapsed;
      setPlayhead(Math.min(currentPos, buf.duration));
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, [stopPlayback, localVolume]);

  const handlePlay = useCallback(() => {
    if (isPlaying) { stopPlayback(); return; }
    if (!audioBuffer) return;
    const sel = selection;
    const hasSel = sel && Math.abs(sel.end - sel.start) > 0.05;
    if (playMode === 'selection' && hasSel) {
      const s = Math.min(sel.start, sel.end);
      const e = Math.max(sel.start, sel.end);
      playBuffer(audioBuffer, s, e - s);
    } else {
      playBuffer(audioBuffer, 0);
    }
  }, [isPlaying, audioBuffer, selection, playMode, playBuffer, stopPlayback]);

  const hasSelection = selection && Math.abs(selection.end - selection.start) > 0.05;

  const handleCropToSelection = useCallback(() => {
    if (!audioBuffer || !hasSelection) return;
    const s = Math.min(selection.start, selection.end);
    const e = Math.max(selection.start, selection.end);
    const ctx = audioCtxRef.current;
    const sr = audioBuffer.sampleRate;
    const startSample = Math.floor(s * sr);
    const endSample = Math.floor(e * sr);
    const cropped = ctx.createBuffer(1, endSample - startSample, sr);
    cropped.getChannelData(0).set(audioBuffer.getChannelData(0).slice(startSample, endSample));
    setAudioBuffer(cropped);
    setSelection({ start: 0, end: 0 });
    setStatus({ type: 'success', text: 'Cropped to selection' });
  }, [audioBuffer, hasSelection, selection]);

  const handleDeleteSelection = useCallback(() => {
    if (!audioBuffer || !hasSelection) return;
    const s = Math.min(selection.start, selection.end);
    const e = Math.max(selection.start, selection.end);
    const result = spliceAudioBuffer(audioCtxRef.current, audioBuffer, null, s, e);
    setAudioBuffer(result);
    setSelection({ start: 0, end: 0 });
    setStatus({ type: 'success', text: `Deleted ${(e - s).toFixed(2)}s` });
  }, [audioBuffer, hasSelection, selection]);

  const handleRemoveSilences = useCallback(() => {
    if (!audioBuffer || silences.length === 0) return;
    let buf = audioBuffer;
    const ctx = audioCtxRef.current;
    const sorted = [...silences].sort((a, b) => b.start - a.start);
    for (const s of sorted) {
      buf = spliceAudioBuffer(ctx, buf, null, s.start, s.end);
    }
    setAudioBuffer(buf);
    setSilences([]);
    setStatus({ type: 'success', text: `Removed ${sorted.length} silence region${sorted.length > 1 ? 's' : ''}` });
  }, [audioBuffer, silences]);

  const handleRerecordStart = useCallback(async () => {
    if (!hasSelection) {
      setStatus({ type: 'warning', text: 'Select a region first' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;
      const recordCtx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
      recordCtxRef.current = recordCtx;
      const micSource = recordCtx.createMediaStreamSource(stream);
      const graph = createSpeechProcessingGraph(recordCtx, micSource);
      const gate = createNoiseGate(recordCtx, graph.outputGain);
      const dest = recordCtx.createMediaStreamDestination();
      gate.connect(dest);

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 }
        : { mimeType: 'audio/webm' };
      const mr = new MediaRecorder(dest.stream, options);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];

      let count = 3;
      setRecordCountdown(count);
      stopPlayback();

      const countInterval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(countInterval);
          setRecordCountdown(null);
          mr.start(100);
          setIsRecording(true);
          setStatus({ type: 'info', text: 'Recording…' });
        } else {
          setRecordCountdown(count);
        }
      }, 1000);

      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const newBlob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const ctx = audioCtxRef.current;
        try {
          const ab = await newBlob.arrayBuffer();
          const newBuf = await ctx.decodeAudioData(ab);
          const s = Math.min(selection.start, selection.end);
          const e = Math.max(selection.start, selection.end);
          const spliced = spliceAudioBuffer(ctx, audioBuffer, newBuf, s, e);
          setAudioBuffer(spliced);
          setSelection({ start: 0, end: 0 });
          setStatus({ type: 'success', text: 'Re-record applied' });
        } catch (err) {
          setStatus({ type: 'warning', text: 'Could not apply recording' });
        }
        stream.getTracks().forEach((t) => t.stop());
        recordCtx.close().catch(() => {});
        setIsRecording(false);
      };
    } catch (e) {
      setStatus({ type: 'warning', text: 'Microphone access denied' });
    }
  }, [hasSelection, selection, audioBuffer, stopPlayback]);

  const handleRerecordStop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecordCountdown(null);
    setIsRecording(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!audioBuffer) return;
    setIsSaving(true);
    setStatus({ type: 'info', text: 'Exporting…' });
    try {
      const outBlob = await audioBufferToBlob(audioBuffer);
      await onSave(outBlob);
      setStatus({ type: 'success', text: 'Saved' });
    } catch (e) {
      setStatus({ type: 'warning', text: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  }, [audioBuffer, onSave]);

  const selStart = selection ? Math.min(selection.start, selection.end) : 0;
  const selEnd = selection ? Math.max(selection.start, selection.end) : 0;
  const selDur = selEnd - selStart;

  const c = {
    textPrimary: 'var(--color-text-primary, #e2e8f0)',
    textSecondary: 'var(--color-text-secondary, #94a3b8)',
    textTertiary: 'var(--color-text-tertiary, #64748b)',
    textDanger: 'var(--color-text-danger, #f87171)',
    textSuccess: 'var(--color-text-success, #34d399)',
    textWarning: 'var(--color-text-warning, #fbbf24)',
    textInfo: 'var(--color-text-info, #60a5fa)',
    bgPrimary: 'var(--color-background-primary, rgba(15,23,42,0.6))',
    bgSecondary: 'var(--color-background-secondary, rgba(30,41,59,0.5))',
    bgDanger: 'var(--color-background-danger, rgba(239,68,68,0.12))',
    bgSuccess: 'var(--color-background-success, rgba(16,185,129,0.12))',
    bgWarning: 'var(--color-background-warning, rgba(245,158,11,0.12))',
    bgInfo: 'var(--color-background-info, rgba(59,130,246,0.12))',
    borderPrimary: 'var(--color-border-primary, rgba(148,163,184,0.35))',
    borderSecondary: 'var(--color-border-secondary, rgba(100,116,139,0.3))',
    borderTertiary: 'var(--color-border-tertiary, rgba(71,85,105,0.35))',
    borderDanger: 'var(--color-border-danger, rgba(239,68,68,0.35))',
    borderInfo: 'var(--color-border-info, rgba(59,130,246,0.35))',
    radius: 'var(--border-radius-md, 6px)',
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: c.textSecondary, fontSize: 14 }}>
        Decoding audio…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: c.textDanger, fontSize: 14 }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '1rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: c.textPrimary }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: c.textTertiary }}>
          {audioBuffer ? formatTime(audioBuffer.duration) : '--'}
        </span>
      </div>

      {status && (
        <div style={{
          fontSize: 12, padding: '5px 10px', borderRadius: c.radius,
          background: status.type === 'success' ? c.bgSuccess : status.type === 'warning' ? c.bgWarning : c.bgInfo,
          color: status.type === 'success' ? c.textSuccess : status.type === 'warning' ? c.textWarning : c.textInfo,
        }}>
          {status.text}
        </div>
      )}

      <div style={{ border: `0.5px solid ${c.borderTertiary}`, borderRadius: c.radius, overflow: 'hidden', background: c.bgSecondary }}>
        <WaveformCanvas
          peaks={peaks}
          duration={audioBuffer?.duration ?? 0}
          selection={selection}
          playhead={playhead}
          silences={silences}
          onSelectionChange={setSelection}
          height={120}
        />
      </div>

      {recordCountdown !== null && (
        <div style={{ textAlign: 'center', padding: '1rem', fontSize: 32, fontWeight: 500, color: c.textDanger, background: c.bgDanger, borderRadius: c.radius }}>
          Recording in {recordCountdown}…
        </div>
      )}

      {isRecording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: c.radius, background: c.bgDanger, border: `0.5px solid ${c.borderDanger}` }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.textDanger, display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: c.textDanger, flex: 1 }}>Recording replacement…</span>
          <div style={{ flex: 1, height: 4, background: c.bgPrimary, borderRadius: 2, overflow: 'hidden' }}>
            <div id="editor-record-vol-bar" style={{ height: '100%', width: '0%', background: c.textDanger, transition: 'width 0.05s' }} />
          </div>
          <button type="button" onClick={handleRerecordStop} style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer', background: c.textDanger, color: 'white', border: 'none', borderRadius: c.radius }}>
            Stop
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: c.textTertiary }}>
        {hasSelection ? (
          <>
            <span>{formatTime(selStart)} → {formatTime(selEnd)} · {selDur.toFixed(2)}s selected</span>
            <button type="button" onClick={() => setSelection({ start: 0, end: 0 })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textTertiary, fontSize: 11, padding: '1px 4px' }}>
              clear
            </button>
          </>
        ) : (
          <span>Drag the waveform to select a region</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={handlePlay} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: c.radius, background: isPlaying ? c.bgDanger : c.bgSecondary, border: `0.5px solid ${isPlaying ? c.borderDanger : c.borderSecondary}`, color: isPlaying ? c.textDanger : c.textPrimary, cursor: 'pointer', fontSize: 13 }}>
          {isPlaying ? 'Stop' : playMode === 'selection' && hasSelection ? 'Play selection' : 'Play all'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
          <input type="checkbox" checked={playMode === 'selection'} onChange={(e) => setPlayMode(e.target.checked ? 'selection' : 'full')} style={{ margin: 0 }} />
          Selection only
        </label>
        {playhead !== null && audioBuffer && (
          <span style={{ fontSize: 12, color: c.textSecondary, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
            {formatTime(playhead)} / {formatTime(audioBuffer.duration)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 10px', background: c.bgSecondary, borderRadius: c.radius, border: `0.5px solid ${c.borderTertiary}` }}>
        <button type="button" onClick={handleCropToSelection} disabled={!hasSelection} style={{ padding: '5px 10px', fontSize: 12, borderRadius: c.radius, cursor: hasSelection ? 'pointer' : 'default', opacity: hasSelection ? 1 : 0.4, border: `0.5px solid ${c.borderSecondary}`, background: c.bgPrimary, color: c.textPrimary }}>
          Crop to selection
        </button>
        <button type="button" onClick={handleDeleteSelection} disabled={!hasSelection} style={{ padding: '5px 10px', fontSize: 12, borderRadius: c.radius, cursor: hasSelection ? 'pointer' : 'default', opacity: hasSelection ? 1 : 0.4, border: `0.5px solid ${c.borderSecondary}`, background: c.bgPrimary, color: c.textPrimary }}>
          Delete selection
        </button>
        <button type="button" onClick={handleRerecordStart} disabled={!hasSelection || isRecording || isPlaying} style={{ padding: '5px 10px', fontSize: 12, borderRadius: c.radius, cursor: hasSelection && !isRecording && !isPlaying ? 'pointer' : 'default', opacity: hasSelection && !isRecording && !isPlaying ? 1 : 0.4, border: `0.5px solid ${c.borderSecondary}`, background: c.bgPrimary, color: c.textPrimary }}>
          Re-record region
        </button>
        <button type="button" onClick={handleRemoveSilences} disabled={silences.length === 0} style={{ padding: '5px 10px', fontSize: 12, borderRadius: c.radius, cursor: silences.length > 0 ? 'pointer' : 'default', opacity: silences.length > 0 ? 1 : 0.4, border: `0.5px solid ${c.borderSecondary}`, background: c.bgPrimary, color: c.textPrimary }}>
          Remove silences {silences.length > 0 && `(${silences.length})`}
        </button>
      </div>

      {silences.length > 0 && (
        <div style={{ fontSize: 11, color: c.textTertiary }}>
          Red zones = detected silences ({silences.length} region{silences.length > 1 ? 's' : ''}, {silences.reduce((a, s) => a + s.end - s.start, 0).toFixed(1)}s total)
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={handleSave} disabled={isSaving || !audioBuffer} style={{ flex: 1, padding: '8px 0', fontSize: 13, borderRadius: c.radius, background: isSaving ? c.bgSecondary : c.bgPrimary, border: `0.5px solid ${c.borderPrimary}`, color: c.textPrimary, cursor: isSaving || !audioBuffer ? 'default' : 'pointer', fontWeight: 500 }}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} style={{ padding: '8px 16px', fontSize: 13, borderRadius: c.radius, background: c.bgDanger, border: `0.5px solid ${c.borderDanger}`, color: c.textDanger, cursor: 'pointer' }}>
            Delete
          </button>
        )}
        {onClose && (
          <button type="button" onClick={() => { stopPlayback(); onClose(); }} style={{ padding: '8px 16px', fontSize: 13, borderRadius: c.radius, background: 'none', border: `0.5px solid ${c.borderTertiary}`, color: c.textSecondary, cursor: 'pointer' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
