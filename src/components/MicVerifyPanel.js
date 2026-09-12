import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { displayDeviceName, hasHiddenLabels } from '../utils/audioDeviceLabels';
import {
  MIC_PROBE_MS,
  MIC_RMS_THRESHOLD,
  findEdgeDefaultInput,
  probeTargets,
  readPinnedClientMicLabel,
  rmsOfFrame,
  sameDeviceName,
  summarizeProbe,
  writeLastVerify,
  writePinnedClientMicLabel,
} from '../utils/micVerify';
import { MicVerifyChip } from './MicVerifyChip';

const TONE_COLOR = { pass: '#34d399', fail: '#f87171', warn: '#fbbf24' };

/**
 * MIC VERIFY panel (v4.97.0) — answers "will the client hear me?" without
 * leaving the app. Normal-person test: pick the client mic, press TEST,
 * speak for 5s → live bars per device + record-then-playback loopback
 * through the chosen output. Verdict warns when Edge's default mic (what
 * the platform tab grabs) differs from the pinned pick. Local only, no API.
 */
export const MicVerifyPanel = () => {
  const {
    inputDevices,
    outputDevices,
    selectedSinkId,
    changeSinkId,
    fetchDevices,
  } = useAudioSettings();

  const [pinnedLabel, setPinnedLabel] = useState(() => readPinnedClientMicLabel());
  const [phase, setPhase] = useState('idle'); // idle | listening | playing
  const [countdown, setCountdown] = useState(0);
  const [bars, setBars] = useState([]); // [{ label, maxRms, sampleRate }]
  const [verdict, setVerdict] = useState(null); // only real probe runs set this
  const [loopbackUrl, setLoopbackUrl] = useState('');
  const [loopbackError, setLoopbackError] = useState('');

  // Probe-run state kept in refs so the interval callback stays simple.
  const runRef = useRef(null); // { ctx, streams[], analysers[], timer, recorder, chunks[], pinnedStream }

  useEffect(() => () => { teardownRun(runRef.current); runRef.current = null; }, []);

  const edgeDefault = useMemo(() => findEdgeDefaultInput(inputDevices), [inputDevices]);
  const micChoices = useMemo(() => probeTargets(inputDevices), [inputDevices]);
  const labelsHidden = useMemo(() => hasHiddenLabels(inputDevices), [inputDevices]);
  const sinkName = useMemo(
    () => outputDevices.find((d) => d.deviceId === selectedSinkId)?.label || 'System default',
    [outputDevices, selectedSinkId],
  );

  // First visit: pre-pin Edge's default — that IS what the platform grabs.
  useEffect(() => {
    if (!pinnedLabel && edgeDefault?.label && !labelsHidden) {
      writePinnedClientMicLabel(edgeDefault.label);
      setPinnedLabel(edgeDefault.label);
    }
  }, [pinnedLabel, edgeDefault, labelsHidden]);

  const handlePinChange = (label) => {
    writePinnedClientMicLabel(label);
    setPinnedLabel(label);
    setVerdict(null); // verdicts are per-device — a stale one would lie
  };

  const startTest = async () => {
    if (phase === 'listening') return;
    teardownRun(runRef.current);
    setLoopbackError('');
    setBars([]);
    // 1) Labels need mic permission — this opens it once, then refreshes pickers.
    await fetchDevices({ requestMicPermissionForLabels: true });
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const targets = probeTargets(devices);
    const def = findEdgeDefaultInput(devices);

    // 2) Open one probe stream per physical input; measure RMS each 100ms.
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const run = { ctx, streams: [], analysers: [], timer: null, recorder: null, chunks: [], pinnedStream: null };
    runRef.current = run;
    const results = [];

    await Promise.all(targets.map(async (device) => {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: device.deviceId } } });
      } catch (_) {
        return; // busy/unopenable — summarizeProbe reports it if this was the pinned mic
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      run.streams.push(stream);
      // Device's own rate (44.1 vs 48k mismatch check) — NOT the shared ctx rate.
      const trackRate = stream.getAudioTracks()[0]?.getSettings?.()?.sampleRate || 0;
      run.analysers.push({ analyser, data: new Uint8Array(analyser.fftSize), maxRms: 0, label: device.label || device.deviceId, sampleRate: trackRate });
      // Loopback clip comes from the pinned mic's stream.
      if (sameDeviceName(device.label, pinnedLabel)) {
        run.pinnedStream = stream;
        run.label = device.label || device.deviceId;
      }
    }));

    if (!run.streams.length) {
      await teardownRun(run);
      setVerdict(summarizeProbe({ devices, edgeDefault: def, pinnedLabel, results }));
      return;
    }

    // MediaRecorder on the pinned stream for the same 5s → playback clip.
    if (run.pinnedStream && typeof window.MediaRecorder !== 'undefined') {
      try {
        run.recorder = new MediaRecorder(run.pinnedStream);
        run.recorder.ondataavailable = (e) => { if (e.data?.size) run.chunks.push(e.data); };
        run.recorder.start();
      } catch (_) { run.recorder = null; }
    }

    setPhase('listening');
    setCountdown(Math.round(MIC_PROBE_MS / 1000));
    const started = Date.now();
    run.timer = setInterval(() => {
      const elapsed = Date.now() - started;
      run.analysers.forEach((a) => {
        a.analyser.getByteTimeDomainData(a.data);
        a.maxRms = Math.max(a.maxRms, rmsOfFrame(a.data));
      });
      setBars(run.analysers.map((a) => ({ label: a.label, maxRms: a.maxRms, sampleRate: a.sampleRate })));
      const left = Math.max(0, Math.ceil((MIC_PROBE_MS - elapsed) / 1000));
      setCountdown(left);
      if (elapsed >= MIC_PROBE_MS) finishProbe(run, { devices, edgeDefault: def });
    }, 100);
  };

  const finishProbe = (run, { devices, edgeDefault: def }) => {
    clearInterval(run.timer);
    run.timer = null;
    try { run.recorder?.stop(); } catch (_) {}
    const results = run.analysers.map((a) => ({ label: a.label, sampleRate: a.sampleRate, maxRms: a.maxRms }));
    const v = summarizeProbe({ devices, edgeDefault: def, pinnedLabel, results });
    setVerdict(v);
    writeLastVerify({ tone: v.tone, label: pinnedLabel, at: Date.now() });
    window.dispatchEvent(new Event('catint_mic_verified'));
    // Loopback: blob from the pinned mic's 5s clip, playable through chosen output.
    if (run.chunks.length) {
      const url = URL.createObjectURL(new Blob(run.chunks, { type: run.chunks[0].type || 'audio/webm' }));
      setLoopbackUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      playLoopback(url);
    } else {
      setPhase('idle');
    }
    teardownStreams(run);
  };

  const playLoopback = async (url) => {
    const a = new Audio(url || loopbackUrl);
    try {
      if (selectedSinkId && a.setSinkId) await a.setSinkId(selectedSinkId);
      a.onended = () => setPhase('idle');
      await a.play();
      setPhase('playing');
    } catch (_) {
      setPhase('idle');
      setLoopbackError('Playback blocked — press ▶ HEAR YOURSELF again (or check the output device).');
    }
  };

  const pinnedMissing = pinnedLabel && !micChoices.some((d) => sameDeviceName(d.label, pinnedLabel) && d.label);

  return (
    <section className="mic-verify-panel" aria-label="Microphone verification">
      <div className="mic-verify-head">
        <strong>🎤 MIC VERIFY</strong>
        <span className="mic-verify-sub">— will the client hear me? Speak for 5s, then hear yourself back.</span>
      </div>

      <div className="mic-verify-controls">
        <label className="mic-verify-field">
          <span>Client mic (what the platform grabs)</span>
          <select
            value={pinnedMissing ? '__missing__' : pinnedLabel}
            onChange={(e) => handlePinChange(e.target.value === '__missing__' ? pinnedLabel : e.target.value)}
            disabled={phase === 'listening'}
          >
            <option value="">— pick client mic —</option>
            {pinnedMissing && <option value="__missing__">⚠ {pinnedLabel} (missing)</option>}
            {micChoices.map((d, i) => (
              <option key={d.deviceId} value={d.label || d.deviceId}>
                {displayDeviceName(d, i, 'mic', null, micChoices)}
              </option>
            ))}
          </select>
        </label>
        <label className="mic-verify-field">
          <span>Playback check device</span>
          <select value={selectedSinkId} onChange={(e) => changeSinkId(e.target.value)}>
            <option value="">System default</option>
            {outputDevices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{displayDeviceName(d, i, 'out', null, outputDevices)}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mic-verify-test-btn"
          onClick={startTest}
          disabled={phase === 'listening'}
        >
          {phase === 'listening' ? `🗣 SPEAK NOW ${countdown}s` : 'TEST'}
        </button>
      </div>

      {edgeDefault?.label && (
        <div className={`mic-verify-edge-default${verdict?.edgeDefaultMismatch ? ' is-mismatch' : ''}`}>
          Edge default mic: <strong>{edgeDefault.label}</strong>
          {verdict?.edgeDefaultMismatch && ' — ⚠ differs from your pick; a platform tab on default grabs THIS one'}
        </div>
      )}

      {bars.length > 0 && (
        <ul className="mic-verify-bars">
          {bars.map((b) => {
            const pct = Math.min(100, Math.round((b.maxRms / 0.25) * 100));
            const live = b.maxRms >= MIC_RMS_THRESHOLD;
            return (
              <li key={b.label}>
                <span className={`mic-verify-bar-label${sameDeviceName(b.label, pinnedLabel) ? ' is-pinned' : ''}`}>
                  {b.label || 'unnamed device'}{sameDeviceName(b.label, pinnedLabel) ? ' ★' : ''}
                </span>
                <span className="mic-verify-bar-track">
                  <span className="mic-verify-bar-fill" style={{ width: `${pct}%`, background: live ? '#34d399' : '#475569' }} />
                </span>
                <span className="mic-verify-bar-state" style={{ color: live ? '#34d399' : '#64748b' }}>
                  {live ? 'SIGNAL' : 'quiet'}
                  {b.sampleRate ? ` · ${Math.round(b.sampleRate / 100) / 10}k` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {verdict && phase !== 'listening' && (
        <div className="mic-verify-verdict" style={{ borderColor: `${TONE_COLOR[verdict.tone]}66` }}>
          <div className="mic-verify-verdict-head" style={{ color: TONE_COLOR[verdict.tone] }}>
            {verdict.tone === 'pass' ? '✅' : verdict.tone === 'fail' ? '❌' : '⚠️'} {verdict.headline}
          </div>
          {verdict.hints.map((h) => <div key={h} className="mic-verify-hint">• {h}</div>)}
        </div>
      )}

      {loopbackUrl && phase !== 'listening' && (
        <div className="mic-verify-loopback">
          <button type="button" onClick={() => playLoopback()}>▶ HEAR YOURSELF</button>
          <span>plays through: {sinkName}</span>
        </div>
      )}
      {loopbackError && <div className="mic-verify-hint" style={{ color: '#fbbf24' }}>{loopbackError}</div>}

      <div className="mic-verify-foot">
        Windows volume-mixer per-app routing can still override what Edge plays/records — verify there too.
        <MicVerifyChipInline />
      </div>
    </section>
  );
};

/** Local echo of the header chip so the panel stays self-sufficient. */
const MicVerifyChipInline = () => <MicVerifyChip title="Also shown in the header after every TEST" />;

// ---------- probe lifecycle helpers ----------

const teardownStreams = (run) => {
  if (!run) return;
  run.streams?.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  run.streams = [];
};

const teardownRun = (run) => {
  if (!run) return;
  if (run.timer) clearInterval(run.timer);
  try { run.recorder?.state !== 'inactive' && run.recorder?.stop(); } catch (_) {}
  teardownStreams(run);
  try { run.ctx?.close(); } catch (_) {}
};

export default MicVerifyPanel;
