import React, { useMemo, useState, useEffect } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { useAudioSource } from '../hooks/useAudioSource';
import {
  AUDIO_SOURCE_MODE_TAB,
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  diagnoseVbCableRoute,
  pickVbCableSinkDevice,
} from '../utils/audioSourceManager';
import { truncateDeviceLabel } from '../utils/audioSelfTest';
import { displayDeviceName, hasHiddenLabels, readKnownDeviceLabels } from '../utils/audioDeviceLabels';
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

const formatDailyDuration = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 3600)}h${String(Math.floor((safe % 3600) / 60)).padStart(2, '0')}`;
};

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
  setMicTestMode,
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
  totalOnCallSeconds = 0,
  totalOffCallSeconds = 0,
  dailyMinutes = 0,
  monthlyMinutes = 0,
  breakMinutes = 0,
  ratePerMinute = 0.13,
  onReconnectStream,
  onReconnectAudioSource,
  onSwitchToTabShare,
  onSwitchToVirtualCable,
  onTestLocal,
  onTestRoute,
  onOpenSoundboard,
  soundboardOpen = false,
  compact = false,
  /** v4.99.2: optional node rendered at the right end of the chips row
      (off-call scoreboard merges the metrics strip into this single line). */
  trailing = null,
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
    restoreLiveMic,
  } = useAudioSettings();
  const [micRestoreFlash, setMicRestoreFlash] = useState('');
  // v4.100.2: re-render every 5s while active so stale/critical (Date.now()-based)
  // re-evaluate even when no other state changes fire.
  const [, setStaleTick] = useState(0);
  useEffect(() => {
    if (!isActive) return undefined;
    const t = setInterval(() => setStaleTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [isActive]);
  const {
    selectedInputDeviceId: selectedCableInputId,
    refreshSelectedDeviceId: changeCableInputId,
    refreshInputDevices: refreshCableInputDevices,
    switchAudioSourceMode,
    currentSourceMode,
  } = useAudioSource();
  useComponentVisibilityRefresh();
  const showMicMeter = isComponentVisible('mic_meter_strip', { isActive, isZombieCall });
  const mobileMicMode = micTestMode;
  const isCableMode =
    !mobileMicMode &&
    (configuredAudioSourceMode || currentSourceMode) === AUDIO_SOURCE_MODE_VIRTUAL_CABLE;
  const isTabMode = !mobileMicMode && !isCableMode;

  const selectTabMode = () => {
    setMicTestMode?.(false);
    switchAudioSourceMode(AUDIO_SOURCE_MODE_TAB);
  };
  const selectCableMode = () => {
    setMicTestMode?.(false);
    switchAudioSourceMode(AUDIO_SOURCE_MODE_VIRTUAL_CABLE);
  };
  const selectMicMode = () => {
    setMicTestMode?.(true);
  };

  const switchWorkSource = async (source) => {
    if (source === 'virtualCable') return onSwitchToVirtualCable?.();
    return onSwitchToTabShare?.();
  };

  useEffect(() => {
    fetchDevices({ requestMicPermissionForLabels: false });
  }, [fetchDevices]);

  // v4.87.0: remembered labels keep options readable on fresh origins (no raw id hash).
  const knownLabels = useMemo(
    () => readKnownDeviceLabels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputDevices, outputDevices],
  );
  const outNamesHidden = hasHiddenLabels(outputDevices);
  // v4.107.0: width 36 keeps a twin suffix ("· #a1b2") readable.
  const formatDeviceOption = (device, kind, index = 0) =>
    truncateDeviceLabel(
      displayDeviceName(device, index, kind, knownLabels, kind === 'mic' ? inputDevices : outputDevices),
      36,
    );

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

  const sinkRawLabel = useMemo(() => {
    const dev = outputDevices.find((d) => d.deviceId === selectedSinkId);
    return (dev?.label || '').trim();
  }, [outputDevices, selectedSinkId]);

  const cableInRawLabel = useMemo(() => {
    const dev = inputDevices.find((d) => d.deviceId === selectedCableInputId);
    return (dev?.label || '').trim();
  }, [inputDevices, selectedCableInputId]);

  const suggestedCableSinkId = useMemo(
    () => pickVbCableSinkDevice(outputDevices),
    [outputDevices],
  );

  const cableRouteDiag = useMemo(
    () =>
      diagnoseVbCableRoute({
        cableMode: isCableMode,
        sttInputLabel: cableInRawLabel,
        sinkLabel: sinkRawLabel,
        sinkId: selectedSinkId,
      }),
    [isCableMode, cableInRawLabel, sinkRawLabel, selectedSinkId],
  );

  const fixCableSink = () => {
    if (!suggestedCableSinkId) return;
    changeSinkId(suggestedCableSinkId);
  };

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
    isActive && !mobileMicMode && configuredAudioSourceMode !== attachedSettingsMode;

  // ponytail: emoji-first 3-way STT picker (🔖 tab · 🎧 VB · 🎤 mic)
  const routeTabLabel = isTabMode && (tabStreamReady || audioAttached) ? '🔖✓' : '🔖';
  const routeCableLabel = isCableMode
    ? (cableStreamReady || isCableAttached ? '🎧✓' : '🎧')
    : '🎧';
  const routeMicLabel = mobileMicMode && audioAttached ? '🎤✓' : '🎤';

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
  // v4.100.2: a silent stall (open sockets, no results) must NOT read ok/TEXT —
  // stale/critical outrank the connected state.
  const sttState =
    critical
      ? 'err'
      : stale
        ? 'warn'
        : connectionState === 'connected' && enOk && esOk
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

  // One glance proof for the only work-call route: browser tab → Deepgram → text.
  const tabProof = (() => {
    if (!isTabMode && !tabStreamReady) return null;
    if (connectionState === 'error') {
      return { state: 'err', label: 'TAB · RETRY', title: 'Tab connection failed. Press Connect and choose the call tab with Share audio.' };
    }
    if (!tabStreamReady) {
      return { state: 'warn', label: 'TAB · PICK', title: 'Press Connect, choose the call tab, then check Share audio.' };
    }
    if (!connectProgress?.audioChunksSent) {
      return { state: 'warn', label: 'TAB ✓ · DG…', title: 'Tab audio is attached; opening Deepgram and waiting for audio packets.' };
    }
    if (connectProgress?.transcriptReceived) {
      return { state: 'ok', label: 'TAB ✓ · TEXT ✓', title: 'Tab audio reached Deepgram and text has returned.' };
    }
    return { state: 'ok', label: 'TAB ✓ · DG ✓ · SPEAK', title: 'Tab audio is reaching Deepgram. Waiting for speech text.' };
  })();

  // v4.100.3: one honest label shared by compact + full chips. "TEXT ✓" means
  // data arrived in the LAST 30s — not "ever" (the old sticky flag lied during
  // warm-socket off-call stalls). In-call gaps read DG QUIET / DG STUCK.
  const hasFreshText =
    connectProgress?.transcriptReceived && timeSincePacket > 0 && timeSincePacket < 30000;
  const dgChipLabel = critical
    ? 'DG STUCK ⚠'
    : stale
      ? 'DG QUIET ⚠'
      : hasFreshText
        ? 'TEXT ✓'
        : `DG ${enOk && esOk ? 'EN/ES' : connectionState}`;

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
        {compact && (
          <div className="audio-route-compact-proof" aria-label={`${tabProof?.label || sttInLabel}; Deepgram ${enOk && esOk ? 'EN and ES ready' : connectionState}`}>
            <div className="audio-route-compact-source-toggle" role="group" aria-label="Active call STT source">
              <button id="audio-route-active-tab-btn" type="button" className={`audio-route-compact-source-btn${isTabMode ? ' is-active is-tab' : ''}`} onClick={() => switchWorkSource('tab')} aria-pressed={isTabMode} title="TAB: choose the call tab and share audio. The current stream stays live if the picker fails.">TAB</button>
              <button id="audio-route-active-vb-btn" type="button" className={`audio-route-compact-source-btn${isCableMode ? ' is-active is-cable' : ''}`} onClick={() => switchWorkSource('virtualCable')} aria-pressed={isCableMode} title="VB: use CABLE Output for Deepgram. The current stream stays live if cable acquisition fails.">VB</button>
            </div>
            <span className="audio-route-compact-proof__dg" title={sttSummaryHintBody}>
              <Dot state={sttState === 'idle' ? 'idle' : sttState} />
              {dgChipLabel}
            </span>
            {!mobileMicMode && (
              <span
                className="audio-route-compact-proof__dg"
                title={`Greetings go out here. CABLE Input or Voicemeeter Input. Full picker is in the I/O strip off-call.${selectedSinkId ? '' : ' NOTHING PICKED — greetings will be blocked.'}`}
                style={selectedSinkId ? undefined : { color: '#f59e0b' }}
              >
                🔊 {outLabel}
              </span>
            )}
            {(micStatus === 'muted' || micStatus === 'no-signal') && (
              <button
                type="button"
                id="audio-route-restore-mic-btn-compact"
                className="audio-route-compact-proof__zap"
                onClick={() => {
                  const r = restoreLiveMic?.('panic_button_compact');
                  setMicRestoreFlash(r?.ok ? 'Mic restored' : 'No mic stream');
                  window.setTimeout(() => setMicRestoreFlash(''), 2500);
                }}
                title="Rebind your live mic to the caller path (use if a greeting cut your mic or audio died)"
                style={{ borderColor: 'rgba(239,68,68,0.7)', color: '#fca5a5' }}
              >
                🎤 RESTORE{micRestoreFlash ? ` · ${micRestoreFlash}` : ''}
              </button>
            )}
            {/* v4.100.3: ZAP whenever DG is connected but data is stale (in-call
                or warm off-call) or errored — the manual escape hatch stays up. */}
            {(isDeepgramError || (connectionState === 'connected' && timeSincePacket > 30000)) && onReconnectStream && (
              <button
                id="audio-route-zap-btn"
                type="button"
                className="audio-route-compact-proof__zap"
                onClick={onReconnectStream}
                title="Reconnect Deepgram stream"
              >
                ZAP
              </button>
            )}
            {/* v4.103.0: Soundboard entry lives on the always-visible chips line.
                It used to sit inside the hidden full strip — unreachable off-call. */}
            {onOpenSoundboard && !isActive && (
              <ElementHintTarget
                elementId="audio-route-soundboard-btn"
                heading="Soundboard Studio"
                body={soundboardOpen ? 'Hide Soundboard Studio panel.' : 'Off-call: 3-step greeting checklist (quality → hear → caller path).'}
                color="#a855f7"
              >
                <button
                  id="audio-route-soundboard-btn"
                  type="button"
                  className={`audio-route-soundboard-btn${soundboardOpen ? ' is-open' : ''}`}
                  onClick={onOpenSoundboard}
                  aria-pressed={soundboardOpen}
                  title={soundboardOpen ? 'Hide Soundboard Studio' : 'Soundboard Studio - record greetings, health check, route test'}
                >
                  {soundboardOpen ? 'Soundboard ✓' : 'Soundboard'}
                </button>
              </ElementHintTarget>
            )}
          </div>
        )}
        <div className="audio-route-status-full">
        <div className="audio-route-source-toggle" role="group" aria-label="STT route">
          <button
            type="button"
            id="audio-route-tab-mode-btn"
            className={`audio-route-source-btn${isTabMode ? ' is-active is-tab' : ''}`}
            onClick={selectTabMode}
            aria-pressed={isTabMode}
            title="Tab share STT — browser picks the interpreting tab"
          >
            {routeTabLabel}
          </button>
          <button
            type="button"
            id="audio-route-cable-mode-btn"
            className={`audio-route-source-btn${isCableMode ? ' is-active is-cable' : ''}`}
            onClick={selectCableMode}
            aria-pressed={isCableMode}
            title="VB-Cable STT — CABLE Output feeds Deepgram (no tab picker)"
          >
            {routeCableLabel}
          </button>
          <button
            type="button"
            id="audio-route-mic-mode-btn"
            data-guide="mic-test"
            className={`audio-route-source-btn${mobileMicMode ? ' is-active is-mic' : ''}`}
            onClick={selectMicMode}
            aria-pressed={mobileMicMode}
            title="Mic STT — device microphone (phone / no tab share). Soundboard plays local only."
          >
            {routeMicLabel}
          </button>
        </div>

        {tabProof && (
          <span id="audio-route-tab-proof" className="audio-route-badge" title={tabProof.title}>
            <Dot state={tabProof.state} />
            <span>{tabProof.label}</span>
          </span>
        )}

        {isCableMode && (
          <ElementHintTarget
            elementId="audio-route-cable-in-select"
            icon="📥"
            heading="STT in = CABLE Output"
            body="Recording side of VB-Cable. Deepgram listens here. Not CABLE Input. Windows “Listen to this device” on CABLE Output → headphones = hear the cable."
            color={cableRouteDiag.code?.startsWith('stt_') ? '#f59e0b' : '#38bdf8'}
          >
            <label className="audio-route-device-pick" title={`STT in: ${cableInLabel}`}>
              <span className="audio-route-device-pick-label">📥</span>
              <select
                id="audio-route-cable-in-select"
                className="audio-route-select"
                style={{
                  ...selectStyle,
                  borderColor:
                    cableRouteDiag.code?.startsWith('stt_')
                      ? 'rgba(239,68,68,0.55)'
                      : selectedCableInputId
                        ? 'rgba(16,185,129,0.45)'
                        : 'rgba(245,158,11,0.55)',
                }}
                value={selectedCableInputId}
                onChange={(e) => changeCableInputId(e.target.value)}
                onFocus={() => refreshCableInputDevices()}
                onMouseDown={() => refreshCableInputDevices()}
              >
                <option value="">{inputDevices.length ? 'Cable in…' : 'Cable (allow perm)'}</option>
                {inputDevices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {formatDeviceOption(d, 'mic', i)}
                  </option>
                ))}
              </select>
            </label>
          </ElementHintTarget>
        )}

        <ElementHintTarget
          elementId="audio-route-mic-select"
          icon="🎤"
          heading="Mic = your real mic"
          body="Physical headset/mic. App pipes it through VB out to the patient. Not CABLE Output."
          color="#a78bfa"
        >
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
              {inputDevices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {formatDeviceOption(d, 'mic', i)}
                </option>
              ))}
            </select>
          </label>
        </ElementHintTarget>

        <ElementHintTarget
          elementId="audio-route-sink-select"
          icon="🔊"
          heading="VB out = CABLE In / VM In"
          body={
            cableRouteDiag.ok
              ? 'Playback side of VB-Cable or Voicemeeter. Greetings + mic land here so the call app hears you. Speakers here = you hear it, patient does not.'
              : cableRouteDiag.tip
          }
          color={cableRouteDiag.ok ? '#34d399' : '#ef4444'}
        >
          <label className="audio-route-device-pick" title={outNamesHidden ? `VB out: names hidden — tap 🎧 once (one Allow reveals them; your mic is never used). ${outLabel}` : `VB out: ${outLabel}`}>
            <span className="audio-route-device-pick-label">🔊</span>
            <select
              id="audio-route-sink-select"
              className="audio-route-select"
              style={{
                ...selectStyle,
                borderColor:
                  isCableMode && !cableRouteDiag.ok && cableRouteDiag.code?.startsWith('sink_')
                    ? 'rgba(239,68,68,0.7)'
                    : selectedSinkId
                      ? 'rgba(16,185,129,0.45)'
                      : 'rgba(245,158,11,0.55)',
              }}
              value={selectedSinkId}
              onChange={(e) => changeSinkId(e.target.value)}
              onFocus={() => fetchDevices({ requestMicPermissionForLabels: false })}
              onMouseDown={() => fetchDevices({ requestMicPermissionForLabels: false })}
            >
              <option value="">{outputDevices.length ? (outNamesHidden ? 'VB out… (names hidden)' : 'VB out…') : 'No outputs found'}</option>
              {outputDevices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {formatDeviceOption(d, 'out', i)}
                </option>
              ))}
            </select>
          </label>
        </ElementHintTarget>

        {isCableMode && !cableRouteDiag.ok && (
          <span
            className="audio-route-warn-chip"
            title={cableRouteDiag.tip}
            style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            ⚠ {cableRouteDiag.short}
          </span>
        )}
        {isCableMode &&
          !cableRouteDiag.ok &&
          cableRouteDiag.code?.startsWith('sink_') &&
          suggestedCableSinkId &&
          suggestedCableSinkId !== selectedSinkId && (
            <button
              type="button"
              id="audio-route-fix-sink-btn"
              className="audio-route-inline-btn"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(16,185,129,0.55)',
                borderRadius: 4,
                color: '#6ee7b7',
                cursor: 'pointer',
                fontSize: compact ? '0.62rem' : '0.68rem',
                fontWeight: 800,
                lineHeight: 1,
                padding: '0.16rem 0.42rem',
                minHeight: compact ? 22 : 24,
                whiteSpace: 'nowrap',
              }}
              onClick={fixCableSink}
              title="Set VB out to detected CABLE Input / Voicemeeter Input"
            >
              Fix → VB out
            </button>
          )}

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

        {(micStatus === 'muted' || micStatus === 'no-signal') && (
          <button
            type="button"
            id="audio-route-restore-mic-btn"
            className="audio-route-inline-btn"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.7)',
              borderRadius: 4,
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: compact ? '0.62rem' : '0.68rem',
              fontWeight: 800,
              lineHeight: 1,
              padding: '0.16rem 0.42rem',
              minHeight: compact ? 22 : 24,
              whiteSpace: 'nowrap',
            }}
            onClick={() => {
              const r = restoreLiveMic?.('panic_button');
              setMicRestoreFlash(r?.ok ? 'Mic restored' : 'No mic stream');
              window.setTimeout(() => setMicRestoreFlash(''), 2500);
            }}
            title="Rebind your live mic to the caller path (use if a greeting cut your mic or audio died)"
          >
            🎤 Restore Mic{micRestoreFlash ? ` · ${micRestoreFlash}` : ''}
          </button>
        )}

        {connectionState === 'disconnected' && !isActive && !isZombieCall && (
          <span
            id="audio-route-day-totals"
            className="audio-route-day-totals"
            title="Workday totals: ON is time in calls; OFF is available plus breaks during the shift."
          >
            TODAY <b>ON {formatDailyDuration(totalOnCallSeconds)}</b> <span>OFF {formatDailyDuration(totalOffCallSeconds)}</span>
          </span>
        )}

        {virtualCableFailure && (
          <span className="audio-route-warn-chip" title={virtualCableFailure.message}>
            ⚠ Cable
          </span>
        )}

        {isCableMode && onSwitchToTabShare && (
          <button
            type="button"
            id="audio-route-tab-backup-btn"
            className="audio-route-inline-btn"
            style={{ ...btn, borderColor: 'rgba(59,130,246,0.45)', color: '#93c5fd' }}
            onClick={onSwitchToTabShare}
            title="Live fallback: switch STT to tab share now (opens tab picker)"
          >
            → 🔖
          </button>
        )}

        {isTabMode && connectionState === 'disconnected' && !audioAttached && (
          <span className="audio-route-hint-chip" title="Press Connect — pick tab + check Share audio">
            Connect picks tab
          </span>
        )}

        {mobileMicMode && connectionState === 'disconnected' && !audioAttached && (
          <span className="audio-route-hint-chip" title="Press Connect — uses your microphone">
            Connect uses mic
          </span>
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
        {/* v4.99.2: right-aligned extra controls on the chips line (off-call scoreboard) */}
        {trailing}
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
