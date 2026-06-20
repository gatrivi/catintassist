import React, { useMemo } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { truncateDeviceLabel } from '../utils/audioSelfTest';

const dotColor = (state) => {
  if (state === 'ok') return '#10b981';
  if (state === 'warn') return '#f59e0b';
  if (state === 'err') return '#ef4444';
  return 'rgba(255,255,255,0.35)';
};

const Dot = ({ state, title }) => (
  <span
    title={title}
    style={{
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: dotColor(state),
      boxShadow: state === 'ok' ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
      flexShrink: 0,
    }}
  />
);

/** Always-visible I/O + Deepgram summary for heavy daily use. */
export const AudioRouteStatusBar = ({
  micTestMode = false,
  tabStreamReady = false,
  audioAttached = false,
  connectionState = 'disconnected',
  connectProgress = {},
  lastDataTime = 0,
  isActive = false,
  isZombieCall = false,
  onReconnectStream,
  onOpenAudioSettings,
  onTestLocal,
  onTestRoute,
  onOpenSoundboard,
  compact = false,
}) => {
  const { inputDevices, outputDevices, selectedMicId, selectedSinkId } = useAudioSettings();

  const micLabel = useMemo(() => {
    const dev = inputDevices.find((d) => d.deviceId === selectedMicId);
    return truncateDeviceLabel(dev?.label || (selectedMicId ? 'Mic' : 'Default mic'));
  }, [inputDevices, selectedMicId]);

  const outLabel = useMemo(() => {
    const dev = outputDevices.find((d) => d.deviceId === selectedSinkId);
    return truncateDeviceLabel(dev?.label || (selectedSinkId ? 'Virtual out' : 'Default out'));
  }, [outputDevices, selectedSinkId]);

  const inputText = micTestMode
    ? `Mic: ${micLabel}`
    : tabStreamReady
      ? 'Tab: audio shared'
      : audioAttached
        ? 'Tab: attached'
        : 'Tab: not connected';

  const inputState = micTestMode
    ? (selectedMicId || inputDevices.length ? 'ok' : 'warn')
    : tabStreamReady || audioAttached
      ? 'ok'
      : 'warn';

  const outState = selectedSinkId ? 'ok' : 'warn';

  const enOk = connectProgress?.socketEn === 'open';
  const esOk = connectProgress?.socketEs === 'open';
  const sttState =
    connectionState === 'connected' && enOk && esOk
      ? 'ok'
      : connectionState === 'connecting'
        ? 'warn'
        : connectionState === 'error'
          ? 'err'
          : audioAttached
            ? 'warn'
            : 'idle';

  const timeSincePacket = Date.now() - (lastDataTime || 0);
  const stale = isActive && connectionState === 'connected' && timeSincePacket > 30000;
  const critical = isActive && connectionState === 'connected' && timeSincePacket > 60000;

  const btn = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    color: 'rgba(255,255,255,0.75)',
    cursor: 'pointer',
    fontSize: '0.58rem',
    fontWeight: 700,
    padding: '0.12rem 0.35rem',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      className={`audio-route-status-bar${compact ? ' is-compact' : ''}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.35rem 0.5rem',
        padding: compact ? '0.2rem 0.35rem' : '0.25rem 0.45rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.62rem',
        fontFamily: 'var(--font-mono, monospace)',
        width: '100%',
      }}
    >
      <button type="button" style={{ ...btn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={onOpenAudioSettings} title="Input device / tab capture">
        <Dot state={inputState} title={inputText} />
        {inputText}
      </button>
      <button type="button" style={{ ...btn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={onOpenAudioSettings} title="Output / virtual mic route">
        <Dot state={outState} title={`Out: ${outLabel}`} />
        Out: {outLabel}
      </button>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.9 }} title={`Deepgram EN ${enOk ? 'open' : '—'} · ES ${esOk ? 'open' : '—'}`}>
        <Dot state={sttState === 'idle' ? 'idle' : sttState} title="Deepgram STT" />
        STT {enOk && esOk ? 'EN·ES' : connectionState}
        {stale && !critical && <span style={{ color: '#f59e0b' }}> stale</span>}
        {critical && <span style={{ color: '#ef4444' }}> no data</span>}
      </span>
      {isZombieCall && (
        <span style={{ color: '#fbbf24', fontWeight: 800 }}>Re-attach tab</span>
      )}
      <span style={{ flex: 1, minWidth: 8 }} />
      {onTestLocal && (
        <button type="button" style={btn} onClick={onTestLocal} title="Play test tone on local speakers">
          Test local
        </button>
      )}
      {onTestRoute && (
        <button type="button" style={btn} onClick={onTestRoute} title="Play test tone through virtual output">
          Test route
        </button>
      )}
      {onOpenSoundboard && !isActive && (
        <button type="button" style={btn} onClick={onOpenSoundboard} title="Full greeting health check">
          Soundboard
        </button>
      )}
      {(stale || critical) && onReconnectStream && (
        <button
          type="button"
          style={{ ...btn, borderColor: '#0ea5e9', color: '#7dd3fc' }}
          onClick={onReconnectStream}
          title="Zap — reconnect audio stream"
        >
          ⚡ Zap
        </button>
      )}
    </div>
  );
};
