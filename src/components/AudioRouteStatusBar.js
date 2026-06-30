import React, { useMemo } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { truncateDeviceLabel } from '../utils/audioSelfTest';
import {
  isComponentVisible,
  useComponentVisibilityRefresh,
} from '../utils/componentVisibility';
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
  cableStreamReady = false,
  configuredAudioSourceMode = "tab",
  attachedAudioSourceMode = "tab",
  virtualCableFailure = null,
  audioAttached = false,
  connectionState = 'disconnected',
  connectProgress = {},
  lastDataTime = 0,
  isActive = false,
  isZombieCall = false,
  onReconnectStream,
  onReconnectAudioSource,
  onSwitchToTabShare,
  onOpenAudioSettings,
  onTestLocal,
  onTestRoute,
  onOpenSoundboard,
  compact = false,
}) => {
  const { inputDevices, outputDevices, selectedMicId, selectedSinkId, micLevel, micStatus } = useAudioSettings();
  useComponentVisibilityRefresh();
  const showMicMeter = isComponentVisible('mic_meter_strip', { isActive, isZombieCall });

  const micDeviceLabel = useMemo(() => {
    const dev = inputDevices.find((d) => d.deviceId === selectedMicId);
    return truncateDeviceLabel(dev?.label || (selectedMicId ? 'Mic' : 'Default mic'));
  }, [inputDevices, selectedMicId]);

  const outLabel = useMemo(() => {
    const dev = outputDevices.find((d) => d.deviceId === selectedSinkId);
    return truncateDeviceLabel(dev?.label || (selectedSinkId ? 'Virtual out' : 'Default out'));
  }, [outputDevices, selectedSinkId]);

  const timeSincePacket = Date.now() - (lastDataTime || 0);
  const stale = isActive && connectionState === 'connected' && timeSincePacket > 30000;
  const critical = isActive && connectionState === 'connected' && timeSincePacket > 60000;
  const isDeepgramError = connectionState === 'error';

  const isMicAttached = attachedAudioSourceMode === "mic" || micTestMode;
  const isCableAttached = attachedAudioSourceMode === "virtualCable";
  const isTabAttached = attachedAudioSourceMode === "tab";
  const attachedSettingsMode =
    attachedAudioSourceMode === "virtualCable" ? "virtualCable" : "tab";
  const isModeMismatch =
    isActive && configuredAudioSourceMode !== attachedSettingsMode;

  const inputText = isMicAttached
    ? `Mic: ${micDeviceLabel}`
    : isCableAttached
      ? (stale || critical ? "Audio: Cable · no signal" : "Audio: Cable · active")
      : isTabAttached
        ? (tabStreamReady || audioAttached ? "Audio: Tab · active" : "Audio: Tab · not connected")
        : tabStreamReady
          ? "Audio: Tab · active"
          : "Audio: Tab · not connected";

  const inputState = isMicAttached
    ? (selectedMicId || inputDevices.length ? "ok" : "warn")
    : isCableAttached
      ? critical
        ? "err"
        : stale
          ? "warn"
          : "ok"
      : tabStreamReady || audioAttached
        ? "ok"
        : "warn";

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

  const btn = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    color: 'rgba(226,232,240,0.95)',
    cursor: 'pointer',
    fontSize: compact ? '0.62rem' : '0.68rem',
    fontWeight: 800,
    lineHeight: 1,
    padding: '0.16rem 0.42rem',
    minHeight: compact ? 22 : 24,
    whiteSpace: 'nowrap',
  };

  const micBarColor =
    micStatus === 'clip' ? '#ef4444'
      : micStatus === 'no-signal' ? '#f59e0b'
        : micStatus === 'muted' ? '#94a3b8'
          : micStatus === 'ok' ? '#10b981'
            : 'rgba(255,255,255,0.35)';

  const micStatusLabel =
    micStatus === 'clip' ? 'CLIP'
      : micStatus === 'no-signal' ? 'NO SIGNAL'
        : micStatus === 'muted' ? 'MUTED'
          : micStatus === 'ok' ? 'MIC OK'
            : 'MIC —';

  return (
    <div
      className={`audio-route-status-bar${compact ? ' is-compact' : ''}`}
      style={{
        display: 'flex',
        flex: 1,
        minWidth: 0,
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.35rem 0.5rem',
        padding: compact ? '0.2rem 0.35rem' : '0.25rem 0.45rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: compact ? '0.62rem' : '0.68rem',
        fontFamily: 'var(--font-mono, monospace)',
        width: '100%',
      }}
    >
      <button
        id="audio-route-mic-settings-btn"
        type="button"
        style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}
        onClick={onOpenAudioSettings}
        title={`Microphone level — ${micStatusLabel}`}
      >
        {showMicMeter && (
        <span
          style={{
            display: 'inline-block',
            width: 36,
            height: 5,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.12)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${micLevel}%`,
              background: micBarColor,
              boxShadow: micStatus === 'ok' ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
              transition: 'width 0.08s ease-out',
            }}
          />
        </span>
        )}
        <span style={{ color: micBarColor, fontWeight: 800, letterSpacing: '0.02em' }}>{micStatusLabel}</span>
      </button>
      <button id="audio-route-input-device-btn" type="button" style={{ ...btn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={onOpenAudioSettings} title="Input device / tab capture">
        <Dot state={inputState} title={inputText} />
        {inputText}
      </button>
      {virtualCableFailure && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid rgba(245,158,11,0.35)',
            background: 'rgba(245,158,11,0.12)',
            padding: '0.12rem 0.35rem',
            borderRadius: 4,
          }}
          title={virtualCableFailure.message}
        >
          <span style={{ color: '#f59e0b', fontWeight: 900 }}>⚠</span>
              <span style={{ color: 'rgba(226,232,240,0.95)', fontWeight: 800, fontSize: '0.62rem' }}>
            Cable failed
          </span>
          {onSwitchToTabShare && (
            <button
              type="button"
              id="audio-route-tab-share-btn"
              onClick={onSwitchToTabShare}
              style={{
                ...btn,
                fontSize: compact ? '0.6rem' : '0.62rem',
                padding: '0.14rem 0.35rem',
                borderColor: 'rgba(245,158,11,0.45)',
                color: '#fcd34d',
              }}
              title={virtualCableFailure.suggestedActionLabel}
            >
              Tab share
            </button>
          )}
        </span>
      )}
      {!virtualCableFailure && isModeMismatch && onReconnectAudioSource && (
        <button
          type="button"
          id="audio-route-reconnect-audio-btn"
          style={{
            ...btn,
            borderColor: isDeepgramError ? 'rgba(239,68,68,0.55)' : '#0ea5e9',
            color: isDeepgramError ? '#fecaca' : '#7dd3fc',
            boxShadow: isDeepgramError ? '0 0 10px rgba(239,68,68,0.35)' : undefined,
          }}
          onClick={onReconnectAudioSource}
          title="Reconnect audio source to the selected mode"
        >
          ↻ Reconnect
        </button>
      )}
      <button
        id="audio-route-output-btn"
        type="button"
        style={{ ...btn, display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={onOpenAudioSettings}
        title="Output / virtual mic route"
      >
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
        <button id="audio-route-test-local-btn" type="button" style={btn} onClick={onTestLocal} title="Play test tone on local speakers">
          Test local
        </button>
      )}
      {onTestRoute && (
        <button id="audio-route-test-route-btn" type="button" style={btn} onClick={onTestRoute} title="Play test tone through virtual output">
          Test route
        </button>
      )}
      {onOpenSoundboard && !isActive && (
        <button id="audio-route-soundboard-btn" type="button" style={btn} onClick={onOpenSoundboard} title="Full greeting health check">
          Soundboard
        </button>
      )}
      {(stale || critical) && onReconnectStream && (
        <button
          id="audio-route-zap-btn"
          type="button"
          style={{
            ...btn,
            borderColor: isDeepgramError ? 'rgba(239,68,68,0.55)' : '#0ea5e9',
            color: isDeepgramError ? '#fecaca' : '#7dd3fc',
            boxShadow: isDeepgramError ? '0 0 10px rgba(239,68,68,0.35)' : undefined,
          }}
          onClick={onReconnectStream}
          title="Zap — reconnect audio stream"
        >
          ⚡ Zap
        </button>
      )}
    </div>
  );
};
