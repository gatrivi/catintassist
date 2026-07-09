import React, { useMemo, useState, useEffect } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { useAudioSource } from '../hooks/useAudioSource';
import { AUDIO_SOURCE_MODE_VIRTUAL_CABLE } from '../utils/audioSourceManager';
import { truncateDeviceLabel } from '../utils/audioSelfTest';
import { ElementHintTarget } from './ElementHint';
import {
  isComponentVisible,
  useComponentVisibilityRefresh,
} from '../utils/componentVisibility';
import { APP_VERSION } from '../constants/version';

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

const selectStyle = {
  fontSize: '0.6rem',
  fontWeight: 700,
  maxWidth: 100,
  minWidth: 64,
  flex: '0 1 auto',
  padding: '0.14rem 0.25rem',
  background: '#0f172a',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 4,
  color: '#e2e8f0',
  cursor: 'pointer',
  colorScheme: 'dark',
};

/** I/O strip: device pickers + soundboard entry (v4.75.1). */
export const AudioRouteStatusBar = ({
  micTestMode = false,
  tabStreamReady = false,
  cableStreamReady = false,
  configuredAudioSourceMode = 'tab',
  attachedAudioSourceMode = 'tab',
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
  onTestLocal,
  onTestRoute,
  onOpenSoundboard,
  soundboardOpen = false,
  compact = false,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const {
    inputDevices,
    outputDevices,
    selectedMicId,
    selectedSinkId,
    changeMicId,
    changeSinkId,
    fetchDevices,
    micLevel,
    micStatus,
  } = useAudioSettings();
  const {
    selectedInputDeviceId: selectedCableInputId,
    refreshSelectedDeviceId: changeCableInputId,
    refreshInputDevices: refreshCableInputDevices,
  } = useAudioSource();
  useComponentVisibilityRefresh();
  const showMicMeter = isComponentVisible('mic_meter_strip', { isActive, isZombieCall });
  const isCableMode = configuredAudioSourceMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE;

  useEffect(() => {
    fetchDevices({ requestMicPermissionForLabels: false });
  }, [fetchDevices]);

  const formatDeviceOption = (device, kind) => {
    const raw = (device?.label || '').trim();
    if (raw) return truncateDeviceLabel(raw, 22);
    const short = device?.deviceId?.slice(0, 8) || '?';
    return kind === 'mic' ? `Mic ${short}…` : `Output ${short}…`;
  };

  const micDeviceLabel = useMemo(() => {
    const dev = inputDevices.find((d) => d.deviceId === selectedMicId);
    return truncateDeviceLabel(dev?.label || (selectedMicId ? 'Mic' : 'Default mic'));
  }, [inputDevices, selectedMicId]);

  const cableInLabel = useMemo(() => {
    const dev = inputDevices.find((d) => d.deviceId === selectedCableInputId);
    return truncateDeviceLabel(dev?.label || (selectedCableInputId ? 'Cable in' : 'Pick CABLE Output'));
  }, [inputDevices, selectedCableInputId]);

  const outLabel = useMemo(() => {
    const dev = outputDevices.find((d) => d.deviceId === selectedSinkId);
    return truncateDeviceLabel(dev?.label || (selectedSinkId ? 'Virtual out' : 'Pick VB-Cable'));
  }, [outputDevices, selectedSinkId]);

  const timeSincePacket = Date.now() - (lastDataTime || 0);
  const stale = isActive && connectionState === 'connected' && timeSincePacket > 30000;
  const critical = isActive && connectionState === 'connected' && timeSincePacket > 60000;
  const isDeepgramError = connectionState === 'error';

  const isMicAttached = attachedAudioSourceMode === 'mic' || micTestMode;
  const isCableAttached = attachedAudioSourceMode === 'virtualCable';
  const isTabAttached = attachedAudioSourceMode === 'tab';
  const attachedSettingsMode =
    attachedAudioSourceMode === 'virtualCable' ? 'virtualCable' : 'tab';
  const isModeMismatch =
    isActive && configuredAudioSourceMode !== attachedSettingsMode;
  const mobileMicMode = micTestMode;

  const sttInLabel = isMicAttached
    ? 'Mic STT'
    : isCableAttached
      ? 'Cable STT'
      : isTabAttached
        ? (tabStreamReady || audioAttached ? 'Tab STT' : 'Tab STT · off')
        : tabStreamReady
          ? 'Tab STT'
          : 'Tab STT · off';

  const sttInState = isMicAttached
    ? (selectedMicId || inputDevices.length ? 'ok' : 'warn')
    : isCableAttached
      ? critical
        ? 'err'
        : stale
          ? 'warn'
          : 'ok'
      : tabStreamReady || audioAttached
        ? 'ok'
        : 'warn';

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

  const sttInHintBody = useMemo(() => {
    if (isMicAttached) {
      return selectedMicId || inputDevices.length
        ? 'Mic mode: your microphone feeds Deepgram. Green dot = mic ready.'
        : 'Mic mode on but no mic selected — pick one in the 🎤 dropdown.';
    }
    if (isCableAttached) {
      if (critical) return 'VB-Cable input: no audio 60s+ — check cable routing or reconnect STT.';
      if (stale) return 'VB-Cable input: audio stale 30s+ — may need ↻ STT reconnect.';
      return 'VB-Cable carries call audio into Deepgram for transcription.';
    }
    if (tabStreamReady || audioAttached) {
      return 'Tab share: browser tab audio is routed to Deepgram. Green = stream attached.';
    }
    return 'Tab STT off — CONNECT and share a tab (or use mic mode) to send audio.';
  }, [isMicAttached, isCableAttached, tabStreamReady, audioAttached, selectedMicId, inputDevices.length, stale, critical]);

  const sttSummaryHintBody = useMemo(() => {
    if (enOk && esOk) return 'Both EN and ES Deepgram sockets open — dual-language STT active.';
    if (connectionState === 'connecting') return 'Opening Deepgram EN + ES websockets…';
    if (connectionState === 'error') return 'Deepgram error — check API key in Settings or tap Zap to reconnect.';
    if (connectionState === 'connected') {
      const parts = [`EN ${enOk ? 'open' : 'closed'}`, `ES ${esOk ? 'open' : 'closed'}`];
      if (critical) return `${parts.join(' · ')} — no transcript data 60s+; try Zap or reconnect.`;
      if (stale) return `${parts.join(' · ')} — no data 30s+; audio may not be reaching Deepgram.`;
      return `Connected but partial: ${parts.join(' · ')}.`;
    }
    if (audioAttached) return 'Audio attached but Deepgram not connected — press CONNECT.';
    return 'Deepgram disconnected — press CONNECT to start speech-to-text.';
  }, [enOk, esOk, connectionState, audioAttached, stale, critical]);

  const sttInHintColor = sttInState === 'ok' ? '#10b981' : sttInState === 'err' ? '#ef4444' : '#f59e0b';
  const sttSummaryHintColor =
    sttState === 'ok' ? '#10b981' : sttState === 'err' ? '#ef4444' : sttState === 'warn' ? '#f59e0b' : '#94a3b8';

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
      data-more-open={isMoreOpen ? 'true' : 'false'}
      title={`Audio I/O · v${APP_VERSION}`}
    >
      <div className="audio-route-status-main">
        {isCableMode && !mobileMicMode && (
          <label className="audio-route-device-pick" title={`STT in: ${cableInLabel}`}>
            <span className="audio-route-device-pick-label">📥</span>
            <select
              id="audio-route-cable-in-select"
              className="audio-route-select"
              style={{
                ...selectStyle,
                borderColor: selectedCableInputId ? 'rgba(16,185,129,0.45)' : 'rgba(245,158,11,0.55)',
              }}
              value={selectedCableInputId}
              onChange={(e) => changeCableInputId(e.target.value)}
              onFocus={() => refreshCableInputDevices()}
              onMouseDown={() => refreshCableInputDevices()}
            >
              <option value="">{inputDevices.length ? 'Cable in…' : 'Cable (allow perm)'}</option>
              {inputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {formatDeviceOption(d, 'mic')}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Mic for record + passthrough */}
        <label className="audio-route-device-pick" title={`Mic: ${micDeviceLabel}`}>
          <span className="audio-route-device-pick-label">🎤</span>
          <select
            id="audio-route-mic-select"
            className="audio-route-select"
            style={selectStyle}
            value={selectedMicId}
            onChange={(e) => changeMicId(e.target.value)}
            onFocus={() => fetchDevices({ requestMicPermissionForLabels: true })}
            onMouseDown={() => fetchDevices({ requestMicPermissionForLabels: true })}
          >
            <option value="">{inputDevices.length ? 'Mic…' : 'Mic (allow perm)'}</option>
            {inputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {formatDeviceOption(d, 'mic')}
              </option>
            ))}
          </select>
        </label>

        {/* VB-Cable out → patient hears greetings */}
        <label className="audio-route-device-pick" title={`VB out: ${outLabel}`}>
          <span className="audio-route-device-pick-label">🔊</span>
          <select
            id="audio-route-sink-select"
            className="audio-route-select"
            style={{
              ...selectStyle,
              borderColor: selectedSinkId ? 'rgba(16,185,129,0.45)' : 'rgba(245,158,11,0.55)',
            }}
            value={selectedSinkId}
            onChange={(e) => changeSinkId(e.target.value)}
            onFocus={() => fetchDevices({ requestMicPermissionForLabels: false })}
            onMouseDown={() => fetchDevices({ requestMicPermissionForLabels: false })}
          >
            <option value="">{outputDevices.length ? 'VB out…' : 'No outputs found'}</option>
            {outputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {formatDeviceOption(d, 'out')}
              </option>
            ))}
          </select>
        </label>

        <ElementHintTarget
          elementId="audio-route-stt-in-badge"
          heading="STT audio in"
          body={sttInHintBody}
          color={sttInHintColor}
        >
          <span
            id="audio-route-stt-in-badge"
            className="audio-route-badge"
          >
            <Dot state={sttInState} />
            <span>{sttInLabel}</span>
          </span>
        </ElementHintTarget>

        <ElementHintTarget
          elementId="audio-route-stt-summary"
          heading="Deepgram STT"
          body={sttSummaryHintBody}
          color={sttSummaryHintColor}
        >
          <span
            id="audio-route-stt-summary"
            className="audio-route-badge"
          >
            <Dot state={sttState === 'idle' ? 'idle' : sttState} />
            <span>
              DG {enOk && esOk ? 'EN·ES' : connectionState}
              {stale && !critical && <span style={{ color: '#f59e0b' }}> ·stale</span>}
              {critical && <span style={{ color: '#ef4444' }}> ·no data</span>}
            </span>
          </span>
        </ElementHintTarget>

        {onOpenSoundboard && !isActive && (
          <ElementHintTarget
            elementId="audio-route-soundboard-btn"
            heading="Soundboard Studio"
            body={mobileMicMode ? 'Mic mode: greetings play on your speakers/headphones — use health check to test quality.' : soundboardOpen ? 'Hide Soundboard Studio panel.' : 'Record greetings, health check, route test.'}
            color="#a855f7"
          >
          <button
            id="audio-route-soundboard-btn"
            type="button"
            className={`audio-route-soundboard-btn${soundboardOpen ? ' is-open' : ''}`}
            onClick={onOpenSoundboard}
            aria-pressed={soundboardOpen}
            title={mobileMicMode ? 'Soundboard Studio — local speakers in mic mode (quality check)' : soundboardOpen ? 'Hide Soundboard Studio' : 'Soundboard Studio - record greetings, health check, route test'}
          >
            {soundboardOpen ? 'Soundboard ✓' : 'Soundboard'}
          </button>
          </ElementHintTarget>
        )}

        {virtualCableFailure && (
          <span className="audio-route-warn-chip" title={virtualCableFailure.message}>
            ⚠ Cable
          </span>
        )}

        {isCableMode && !mobileMicMode && onSwitchToTabShare && (
          <button
            type="button"
            id="audio-route-tab-backup-btn"
            className="audio-route-inline-btn"
            style={{ ...btn, borderColor: 'rgba(59,130,246,0.45)', color: '#93c5fd' }}
            onClick={onSwitchToTabShare}
            title="Fallback: switch STT to tab share (keeps VB out for greetings)"
          >
            Tab backup
          </button>
        )}

        {!virtualCableFailure && isModeMismatch && onReconnectAudioSource && (
          <button
            type="button"
            id="audio-route-reconnect-audio-btn"
            className="audio-route-inline-btn"
            style={{
              ...btn,
              borderColor: isDeepgramError ? 'rgba(239,68,68,0.55)' : '#0ea5e9',
              color: isDeepgramError ? '#fecaca' : '#7dd3fc',
            }}
            onClick={onReconnectAudioSource}
            title="Reconnect STT audio to selected mode"
          >
            ↻ STT
          </button>
        )}

        {isZombieCall && (
          <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.62rem' }}>Re-attach</span>
        )}

        <ElementHintTarget
          elementId="audio-route-more-btn"
          heading="More audio tools"
          body="Expand: mic meter, test local speakers, test VB-Cable route."
          color="#64748b"
        >
        <button
          id="audio-route-more-btn"
          type="button"
          className="audio-route-inline-btn"
          style={{ ...btn, padding: '0 0.35rem' }}
          onClick={() => setIsMoreOpen((v) => !v)}
          title="More: test local, test VB out, mic meter"
          aria-expanded={isMoreOpen}
        >
          {isMoreOpen ? 'Less' : 'More'}
        </button>
        </ElementHintTarget>

        {(stale || critical || (isActive && isDeepgramError)) && onReconnectStream && (
          <button
            id="audio-route-zap-btn"
            type="button"
            className="audio-route-inline-btn"
            style={{
              ...btn,
              borderColor: isDeepgramError ? 'rgba(239,68,68,0.55)' : '#0ea5e9',
              color: isDeepgramError ? '#fecaca' : '#7dd3fc',
            }}
            onClick={onReconnectStream}
            title="Zap — reconnect Deepgram stream"
          >
            ⚡ Zap
          </button>
        )}
      </div>

      {isMoreOpen && (
        <div className="audio-route-more-panel">
          <button
            id="audio-route-mic-settings-btn"
            type="button"
            style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}
            title={`Passthrough mic level — ${micStatusLabel}`}
          >
            {showMicMeter && (
              <span className="audio-route-mic-meter">
                <span
                  className="audio-route-mic-meter-fill"
                  style={{
                    width: `${micLevel}%`,
                    background: micBarColor,
                  }}
                />
              </span>
            )}
            <span style={{ color: micBarColor }}>{micStatusLabel}</span>
          </button>

          {virtualCableFailure && onSwitchToTabShare && (
            <button
              type="button"
              id="audio-route-tab-share-btn"
              style={{ ...btn, borderColor: 'rgba(245,158,11,0.45)', color: '#fcd34d' }}
              onClick={onSwitchToTabShare}
              title={virtualCableFailure.suggestedActionLabel}
            >
              Tab share
            </button>
          )}

          {onTestLocal && (
            <ElementHintTarget
              elementId="audio-route-test-local-btn"
              heading="Test local"
              body="Play a test tone on your speakers only (not through VB-Cable)."
              color="#38bdf8"
            >
            <button id="audio-route-test-local-btn" type="button" style={btn} onClick={onTestLocal} title="Test tone on your speakers only">
              Test local
            </button>
            </ElementHintTarget>
          )}

          {onTestRoute && (
            <ElementHintTarget
              elementId="audio-route-test-route-btn"
              heading="Test route"
              body={mobileMicMode ? 'Disabled in local mic mode. VB-Cable route is not used.' : 'Play tone through VB-Cable - same path patients hear greetings.'}
              color="#34d399"
            >
            <button
              id="audio-route-test-route-btn"
              type="button"
              style={btn}
              onClick={mobileMicMode ? undefined : onTestRoute}
              disabled={mobileMicMode}
              className={mobileMicMode ? 'audio-route-disabled-control' : undefined}
              title={mobileMicMode ? 'Disabled in local mic mode: VB-Cable route not used' : 'Test tone through VB-Cable output - same path patients hear greetings'}
            >
              Test VB out
            </button>
            </ElementHintTarget>
          )}
        </div>
      )}
    </div>
  );
};
