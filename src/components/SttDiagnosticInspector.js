import React, { useEffect, useMemo, useState } from 'react';
import {
  STT_DIAGNOSTIC_SETTINGS_CHANGED_EVENT,
  STT_DIAGNOSTIC_VERSION,
  clearSttAudio,
  createSttAudioUrl,
  getRetainedSttAudio,
  getSttDiagnosticSnapshot,
  readSttDiagnosticSettings,
  subscribeSttDiagnosticState,
  wipeSttDiagnostics,
} from '../utils/sttDiagnosticTrace';

const value = (item) => item === null || item === undefined || item === '' ? '—' : String(item);

const AudioPlayer = ({ chunk }) => {
  const url = useMemo(() => createSttAudioUrl(chunk), [chunk]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  if (!url) return <span>Audio unavailable</span>;
  return <audio aria-label="Playback retained diagnostic audio" controls src={url} />;
};

export const SttAudioRecordingIndicator = () => {
  const [recording, setRecording] = useState(false);
  useEffect(() => subscribeSttDiagnosticState((data) => setRecording(data.recordingAudio)), []);
  if (!recording) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: 8,
        bottom: 8,
        zIndex: 99999,
        padding: '5px 8px',
        borderRadius: 5,
        background: '#7f1d1d',
        border: '1px solid #f87171',
        color: '#fee2e2',
        font: '700 10px monospace',
      }}
    >
      STT AUDIO REC
    </div>
  );
};

export const SttDiagnosticInspector = () => {
  const [enabled, setEnabled] = useState(readSttDiagnosticSettings);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(getSttDiagnosticSnapshot);
  const retainedAudio = useMemo(
    () => (data.audioBytes ? getRetainedSttAudio() : null),
    [data.audioBytes],
  );

  useEffect(() => subscribeSttDiagnosticState(setData), []);
  useEffect(() => {
    const sync = () => {
      const nextEnabled = readSttDiagnosticSettings().traceEnabled;
      setEnabled(nextEnabled);
      if (!nextEnabled) setOpen(false);
    };
    const onStorage = (event) => {
      if (!event || event.key === 'catint.sttDiagnostics.traceEnabled.v1') sync();
    };
    window.addEventListener(STT_DIAGNOSTIC_SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(STT_DIAGNOSTIC_SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event) => {
      if (readSttDiagnosticSettings().traceEnabled && event.ctrlKey && event.altKey && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  if (!enabled || !open) return null;

  const panel = {
    position: 'fixed',
    inset: '24px',
    zIndex: 10000,
    overflow: 'auto',
    color: '#e5e7eb',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '8px',
    boxShadow: '0 16px 50px rgba(0,0,0,.55)',
    padding: '16px',
  };
  const row = { padding: '10px 0', borderBottom: '1px solid #374151' };
  const label = { color: '#9ca3af', marginRight: '5px' };

  return (
    <section style={panel} role="dialog" aria-modal="true" aria-label="STT diagnostic inspector">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <strong>STT Diagnostic Inspector · v{STT_DIAGNOSTIC_VERSION}</strong>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={clearSttAudio}>Clear audio</button>
          <button type="button" onClick={wipeSttDiagnostics}>Wipe all</button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close STT diagnostic inspector">Close</button>
        </div>
      </header>

      <div style={{ margin: '12px 0', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
        <span><span style={label}>Session</span>{value(data.sessionId)}</span>
        <span data-testid="stt-audio-recording-status">{data.recordingAudio ? 'Audio recording: ACTIVE' : 'Audio recording: inactive'}</span>
        <span>{data.audioDurationMs / 1000}s / {(data.audioBytes / (1024 * 1024)).toFixed(2)} MiB audio</span>
      </div>

      <div aria-label="STT audio recordings">
        {retainedAudio ? (
          <div style={{ margin: '8px 0' }}>
            <span style={label}>Last {Math.round(retainedAudio.durationMs / 1000)} seconds</span>
            <AudioPlayer chunk={retainedAudio} />
          </div>
        ) : <div>No retained audio</div>}
      </div>

      <div aria-label="STT event trace">
        {data.events.length === 0 && <div>No STT events</div>}
        {data.events.slice().reverse().map((event) => (
          <article key={event.id} style={row}>
            <div><span style={label}>Event</span>{event.id}</div>
            <div><span style={label}>Status</span>{event.status}</div>
            <div><span style={label}>Clock</span>{event.wallClockIso} ({event.wallClockMs} ms)</div>
            <div><span style={label}>Provider start</span>{value(event.providerStart)}</div>
            <div><span style={label}>Provider duration</span>{value(event.providerDuration)}</div>
            <div><span style={label}>Lane</span>{value(event.lane)} · <span style={label}>Socket</span>{value(event.socket)}</div>
            <div><span style={label}>Confidence</span>{value(event.confidence)} · <span style={label}>Final</span>{value(event.final)}</div>
            <div><span style={label}>Raw text</span>{event.rawText || '—'}</div>
            <div><span style={label}>Linked caption IDs</span>{event.linkedCaptionIds.length ? event.linkedCaptionIds.join(', ') : '—'}</div>
            <div><span style={label}>Display text</span>{event.displayedCaptions.length ? event.displayedCaptions.map((caption) => caption.text).join(' | ') : '—'}</div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default SttDiagnosticInspector;
