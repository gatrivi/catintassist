import { useState, useEffect, useRef, useCallback } from 'react';
import { createSpeechProcessingGraph, createNoiseGate } from './audioProcessing';
import { WaveformCanvas } from './WaveformCanvas';
import {
  formatTime,
  buildEditorPeaks,
  detectSilences,
  spliceAudioBuffer,
  audioBufferToBlob,
  cropAudioBuffer,
  removeSilenceRegions,
} from './audioEditorCore';

/**
 * Full greeting / clip editor UI.
 * Props: blob, onSave(editedBlob), onClose?, onDelete?, label?, localVolume?
 *
 * CatIntAssist source: src/components/AudioEditorPanel.js — v4.77.0
 */
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
      try {
        sourceRef.current.stop();
      } catch (_) {}
      sourceRef.current = null;
    }
    if (graphRef.current) {
      graphRef.current.outputGain.disconnect();
      graphRef.current = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
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
        setPeaks(buildEditorPeaks(decoded.getChannelData(0), 680));
        setSilences(detectSilences(decoded));
        setSelection({ start: 0, end: 0 });
        setStatus({ type: 'info', text: `Loaded · ${formatTime(decoded.duration)} · ${decoded.sampleRate}Hz` });
      } catch (e) {
        setError('Could not decode audio. Try re-uploading the file.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      stopPlayback();
    };
  }, [blob, stopPlayback]);

  useEffect(() => {
    if (!audioBuffer) return;
    setPeaks(buildEditorPeaks(audioBuffer.getChannelData(0), 680));
    setSilences(detectSilences(audioBuffer));
  }, [audioBuffer]);

  const playBuffer = useCallback(
    async (buf, offsetSec = 0, durationSec = null) => {
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
    },
    [stopPlayback, localVolume],
  );

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
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
    const cropped = cropAudioBuffer(audioCtxRef.current, audioBuffer, s, e);
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
    const buf = removeSilenceRegions(audioCtxRef.current, audioBuffer, silences);
    setAudioBuffer(buf);
    setSilences([]);
    setStatus({ type: 'success', text: `Removed ${silences.length} silence region${silences.length > 1 ? 's' : ''}` });
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

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
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

  if (loading) {
    return <div className="age-editor age-editor--loading">Decoding audio…</div>;
  }

  if (error) {
    return <div className="age-editor age-editor--error">{error}</div>;
  }

  return (
    <div className="age-editor">
      <div className="age-editor-head">
        <span className="age-editor-label">{label}</span>
        <span className="age-editor-duration">{audioBuffer ? formatTime(audioBuffer.duration) : '--'}</span>
      </div>

      {status && <div className={`age-editor-status age-editor-status--${status.type}`}>{status.text}</div>}

      <div className="age-editor-wave-wrap">
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
        <div className="age-editor-countdown">Recording in {recordCountdown}…</div>
      )}

      {isRecording && (
        <div className="age-editor-recording">
          <span className="age-editor-rec-dot" />
          <span>Recording replacement…</span>
          <button type="button" onClick={handleRerecordStop}>
            Stop
          </button>
        </div>
      )}

      <div className="age-editor-selection-hint">
        {hasSelection ? (
          <>
            <span>
              {formatTime(selStart)} → {formatTime(selEnd)} · {selDur.toFixed(2)}s selected
            </span>
            <button type="button" onClick={() => setSelection({ start: 0, end: 0 })}>
              clear
            </button>
          </>
        ) : (
          <span>Drag the waveform to select a region</span>
        )}
      </div>

      <div className="age-editor-play-row">
        <button type="button" onClick={handlePlay} className={isPlaying ? 'is-playing' : ''}>
          {isPlaying ? 'Stop' : playMode === 'selection' && hasSelection ? 'Play selection' : 'Play all'}
        </button>
        <label>
          <input
            type="checkbox"
            checked={playMode === 'selection'}
            onChange={(e) => setPlayMode(e.target.checked ? 'selection' : 'full')}
          />
          Selection only
        </label>
        {playhead !== null && audioBuffer && (
          <span className="age-editor-play-time">
            {formatTime(playhead)} / {formatTime(audioBuffer.duration)}
          </span>
        )}
      </div>

      <div className="age-editor-tools">
        <button type="button" onClick={handleCropToSelection} disabled={!hasSelection}>
          Crop to selection
        </button>
        <button type="button" onClick={handleDeleteSelection} disabled={!hasSelection}>
          Delete selection
        </button>
        <button type="button" onClick={handleRerecordStart} disabled={!hasSelection || isRecording || isPlaying}>
          Re-record region
        </button>
        <button type="button" onClick={handleRemoveSilences} disabled={silences.length === 0}>
          Remove silences {silences.length > 0 && `(${silences.length})`}
        </button>
      </div>

      {silences.length > 0 && (
        <div className="age-editor-silence-note">
          Red zones = detected silences ({silences.length} region{silences.length > 1 ? 's' : ''},{' '}
          {silences.reduce((a, s) => a + s.end - s.start, 0).toFixed(1)}s total)
        </div>
      )}

      <div className="age-editor-actions">
        <button type="button" onClick={handleSave} disabled={isSaving || !audioBuffer} className="age-editor-save">
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="age-editor-delete">
            Delete
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              onClose();
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
