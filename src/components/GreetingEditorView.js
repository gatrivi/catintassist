/**
 * GreetingEditorView — focused per-greeting workspace (v4.118.0).
 *
 * Master/detail: slim left rail lists every soundboard clip family; the main
 * pane shows ONE greeting at a time (script → record/upload → waveform editor
 * → health). ◀/▶ or ←/→ keys move between greetings; Escape exits.
 * Relationships: "Studio" jumps to the overview view; Exit returns to the
 * scoreboard. Reached from the header ✎ button, Studio, or cat_open_greeting_editor.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACTIONS } from './GreetingsPanel';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { useGreetingClip, useGreetingRecorder } from '../hooks/useGreetingClip';
import { getScriptForClip } from '../services/soundboardMetaService';
import { formatHealthDisplay, explainHealth, playTestToneSink, capSinkTestVolume, SINK_TEST_TONE_VOL } from '../utils/audioSelfTest';
import {
  loadManualCallOk, setManualCallOk, isManualCallOk, warnLegacyCallPathStorage,
} from '../utils/routeVerification';
import { readRouteModePreference } from '../utils/audioRoutePassthrough';
import { generateObjectUrl } from '../utils/storage';
import AudioEditorPanel from './AudioEditorPanel';
import { APP_VERSION_LABEL } from '../constants/version';
import './GreetingEditorView.css';

const SLOT_META = {
  morning: { icon: '☀️', short: 'AM', name: 'Morning' },
  afternoon: { icon: '🌤', short: 'PM', name: 'Afternoon' },
  evening: { icon: '🌙', short: 'Eve', name: 'Evening' },
};
const SLOTS = ['morning', 'afternoon', 'evening'];

/** Flat clip list: [{key, family, label, slot, lang}] — the rail + ◀/▶ order. */
export const buildClipIndex = (blobs = {}) =>
  ACTIONS.flatMap((action) => {
    if (action.dynamic) {
      return SLOTS.map((slot) => ({
        key: `${action.id}_${slot}`,
        familyId: action.id,
        label: action.label,
        slot,
        slotMeta: SLOT_META[slot],
        lang: action.lang,
      }));
    }
    return [{
      key: action.id, familyId: action.id, label: action.label, slot: null, lang: action.lang,
    }];
  });

/** Per-family completion: how many of its clips have recordings. */
export const familyCompletion = (family, clips, blobs) => {
  const mine = clips.filter((c) => c.familyId === family.id);
  const saved = mine.filter((c) => blobs[c.key]).length;
  return { saved, total: mine.length };
};

/** Friendly short label for the currently picked sink. */
export const sinkLabelShort = (outputDevices = [], sinkId) => {
  const dev = outputDevices.find((d) => d.deviceId === sinkId);
  const label = (dev?.label || '').trim();
  if (!label) return 'output';
  const first = label.split(/[(,]/)[0].trim();
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
};

export const GREETING_EDITOR_VIEW = 'greeting-editor';

export const GreetingEditorView = ({ onExit, onOpenStudio, initialClipKey = null, micTestMode = false }) => {
  const {
    selectedSinkId, selectedMicId, selectedRecMicId,
    outputDevices, inputDevices,
    localVolume, sinkVolume,
    playClipToSink,
    monitorMic, setMonitorMic,
    monitorVolume, setMonitorVolume,
  } = useAudioSettings();

  const clips = useMemo(() => buildClipIndex(), []);
  const clipsRef = useRef(clips);

  // ── Shared clip data (blobs / waveforms / health) ──────────────────────────
  const clipStore = useGreetingClip();
  const {
    blobs, loudness, chop, healthScores, heardByRobot, isAnalyzing,
    isLoading, isDecoding, isSaving, error: clipError,
  } = clipStore;
  const { analyzeHealth, uploadFile, clearClip } = clipStore;
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Empty slots must be deep-linkable too; selection never waits for storage.
  const [selIdx, setSelIdx] = useState(() => Math.max(0, clips.findIndex(
    (c) => c.key === initialClipKey || c.familyId === initialClipKey,
  )));

  const current = clips[selIdx] || clips[0];
  const key = current?.key;

  // ── Route state (CALL OK gate — family-wide, same as the panel) ────────────
  const [manualCallOk, setManualCallOkStore] = useState(() => loadManualCallOk());
  useEffect(() => { warnLegacyCallPathStorage(); }, []);
  const routeOk = isManualCallOk(manualCallOk, key, selectedSinkId, selectedMicId);

  // ── Playback (You + Caller preview) ────────────────────────────────────────
  const localAudioRef = useRef(null);
  const sinkAudioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const urlRef = useRef(null); // revoke on stop — object URLs leak otherwise
  const [routeLive, setRouteLive] = useState(false);
  const [notice, setNotice] = useState('');
  const [playError, setPlayError] = useState('');
  // CALL OK is only offered after a caller test that played to the end.
  const [pendingRouteConfirm, setPendingRouteConfirm] = useState(false);

  const flashNotice = useCallback((msg, ms = 5000) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), ms);
  }, []);

  const stopPlayback = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    localAudioRef.current?.pause();
    sinkAudioRef.current?.pause();
    if (urlRef.current) {
      try { URL.revokeObjectURL(urlRef.current); } catch { /* already revoked */ }
      urlRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
    setRouteLive(false);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const play = useCallback(async ({ toCaller = false } = {}) => {
    if (!key) return;
    const blob = blobs[key];
    setPlayError('');
    if (!blob) { flashNotice('Nothing recorded yet — record or upload first.'); return; }
    stopPlayback();
    const url = generateObjectUrl(blob);
    urlRef.current = url;
    const localEl = localAudioRef.current;
    localEl.src = url;
    localEl.volume = Math.min(1, localVolume);
    const sinkEl = sinkAudioRef.current;
    const usePassthrough = toCaller && readRouteModePreference() === 'passthrough';
    const sinkVol = capSinkTestVolume(sinkVolume); // studio tests are capped quiet
    try {
      if (toCaller && !usePassthrough && !selectedSinkId) {
        setPlayError('No caller output picked — choose 🔊 in the header, then retry.');
        return;
      }
      if (toCaller && !usePassthrough) {
        const bound = await sinkEl.setSinkId(selectedSinkId).then(() => true).catch(() => false);
        if (!bound) {
          setPlayError(`Could not bind ${sinkLabelShort(outputDevices, selectedSinkId)} — re-pick 🔊 in header, then retry.`);
          return;
        }
      }
      await localEl.play();
      if (toCaller && !usePassthrough) {
        sinkEl.src = url;
        sinkEl.volume = sinkVol;
        await sinkEl.play();
      }
      if (toCaller && usePassthrough) {
        // Shared patient path; cancelled means the route changed mid-test.
        const pt = await playClipToSink(blob, sinkVol, { clipKey: key });
        if (pt?.cancelled) {
          setPlayError('Call test cancelled — the output changed mid-test. Retry.');
          stopPlayback();
          return;
        }
        if (pt?.ok === false) {
          setPlayError(`Caller play failed (${pt.reason || 'route'}) — re-pick 🔊 in header, retry.`);
          stopPlayback();
          return;
        }
      }
      setPlaying(true);
      setRouteLive(toCaller);
      const tick = () => {
        const el = localAudioRef.current;
        if (el && Number.isFinite(el.duration) && el.duration > 0) {
          setProgress(el.currentTime / el.duration);
          if (el.ended) {
            setPlaying(false);
            setProgress(0);
            // CALL OK is only offered after a test that actually reached the end.
            if (toCaller) setPendingRouteConfirm(true);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error('Preview play failed:', e);
      setPlayError(`Playback failed: ${e?.message || e}. Check the 🔊 output and retry.`);
      stopPlayback();
    }
  }, [key, blobs, localVolume, sinkVolume, selectedSinkId, stopPlayback, flashNotice,
    outputDevices, playClipToSink]);

  // ── Recording (raw mic — dedicated rec mic w/ default fallback) ────────────
  const {
    recordingKey, startRecording, stopRecording, error: recError, busy: recBusy,
  } = useGreetingRecorder({
    selectedRecMicId,
    selectedMicId,
    onSaved: (k, blob) => uploadFile(k, blob),
  });
  // Failures stay on screen next to the buttons that caused them.
  const failureText = clipError || recError || playError;

  // ── Caller route confirm (CALL OK attestation) ─────────────────────────────
  const confirmCallOk = useCallback(() => {
    setManualCallOkStore(setManualCallOk(manualCallOk, key, selectedSinkId, selectedMicId));
    window.dispatchEvent(new Event('catint_gates_updated'));
    setPendingRouteConfirm(false);
    flashNotice('✅ CALL OK — this greeting is armed for the patient path.', 6000);
  }, [manualCallOk, key, selectedSinkId, selectedMicId, flashNotice]);
  const declineCallOk = useCallback(() => {
    setPendingRouteConfirm(false);
    flashNotice('Marked NOT heard — re-record or re-test the route.', 6000);
  }, [flashNotice]);
  // Switching greeting or re-recording drops a stale ask (the tick in play()
  // is what raises it, so a stopped/failed test can never earn CALL OK).
  useEffect(() => { setPendingRouteConfirm(false); }, [key, recordingKey]);

  // ── Navigation (rail + ◀/▶ + arrow keys; Escape exits) ─────────────────────
  const move = useCallback((delta) => {
    stopPlayback();
    setSelIdx((i) => (i + delta + clipsRef.current.length) % clipsRef.current.length);
  }, [stopPlayback]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') onExit?.();
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, onExit]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!current) return null;
  const script = getScriptForClip(key);
  const hasBlob = !!blobs[key];
  const health = formatHealthDisplay(healthScores[key]);
  const heard = heardByRobot[key];
  const healthExplain = hasBlob && health?.label.startsWith('UNACCEPTABLE')
    ? explainHealth({ score: healthScores[key], recall: heard?.recall, confidence: heard?.confidence })
    : null;
  const loud = loudness[key];
  const chopV = chop[key];
  const sinkName = sinkLabelShort(outputDevices, selectedSinkId);

  return (
    <div className="gee glass-panel" data-guide="greeting-editor" data-off-call-view="greeting-editor">
      {/* 32px micro-header */}
      <div className="gee-head">
        <button type="button" className="gee-btn" onClick={() => onExit?.()} title="Back (Esc)">← Exit</button>
        <strong className="gee-title">✎ Greeting Editor</strong>
        <span className={`gee-lang gee-lang--${current.lang || 'en'}`}>{(current.lang || 'en').toUpperCase()}</span>
        <button type="button" className="gee-btn" onClick={() => move(-1)} title="Previous greeting (←)">◀</button>
        <button type="button" className="gee-btn" onClick={() => move(1)} title="Next greeting (→)">▶</button>
        <span className="gee-head-spacer" />
        {onOpenStudio && (
          <button type="button" className="gee-btn gee-btn--ghost" onClick={onOpenStudio} title="Back to the Soundboard Studio overview">
            🗂 Studio
          </button>
        )}
        <span className="gee-version">{APP_VERSION_LABEL}</span>
      </div>

      {notice && <div className="gee-notice" role="status">{notice}</div>}
      {failureText && (
        <div className="gee-notice gee-notice--error" role="alert">{failureText}</div>
      )}
      {(isLoading || isDecoding) && (
        <div className="gee-status" role="status">
          {isLoading ? 'Loading recordings…' : 'Reading waveforms…'}
        </div>
      )}

      {pendingRouteConfirm && (
        <div className="gee-notice gee-notice--ask">
          <span>Did the remote side hear it cleanly? ({current.label})</span>
          <button type="button" className="gee-btn gee-btn--ok" onClick={confirmCallOk}>Yes — mark CALL OK</button>
          <button type="button" className="gee-btn" onClick={declineCallOk}>No</button>
        </div>
      )}

      <div className="gee-body">
        {/* Master rail — all families + slot variants */}
        <nav className="gee-rail" aria-label="Greeting clips">
          {ACTIONS.map((action) => {
            const mine = clips.filter((c) => c.familyId === action.id);
            const comp = familyCompletion(action, clips, blobs);
            const isCurrent = current.familyId === action.id;
            return (
              <div key={action.id} className={`gee-rail-family${isCurrent ? ' is-current' : ''}`}>
                <div className="gee-rail-head">
                  <span className="gee-rail-name">{action.label}</span>
                  {action.lang && <span className={`gee-lang gee-lang--${action.lang}`}>{action.lang.toUpperCase()}</span>}
                  <span className={`gee-rail-count${comp.saved === comp.total ? ' is-ok' : ''}`}>{comp.saved}/{comp.total}</span>
                </div>
                {mine.length > 1 ? (
                  <div className="gee-rail-slots">
                    {mine.map((c) => {
                      const idx = clips.indexOf(c);
                      return (
                        <button
                          key={c.key}
                          type="button"
                          className={`gee-slot-pill${blobs[c.key] ? ' is-saved' : ' is-missing'}${idx === selIdx ? ' is-current' : ''}`}
                          onClick={() => { stopPlayback(); setSelIdx(idx); }}
                        >
                          {c.slotMeta.icon} {c.slotMeta.short}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`gee-slot-pill gee-slot-pill--wide${blobs[action.id] ? ' is-saved' : ' is-missing'}`}
                    onClick={() => { stopPlayback(); setSelIdx(clips.indexOf(mine[0])); }}
                  >
                    {blobs[action.id] ? '● saved' : '○ empty'}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
        {/* DETAIL_PANE */}
        <div className="gee-main">
          <h2 className="gee-main-title">
            {current.label}
            {current.slot && <span className="gee-main-slot">{current.slotMeta.icon} {current.slotMeta.name}</span>}
            <span className={`gee-route-badge ${routeOk ? 'is-ok' : 'is-warn'}`} title="Patient-path attestation">
              {routeOk ? 'CALL OK' : 'LOCAL ONLY'}
            </span>
          </h2>

          {script && (
            <div className="gee-script" title="The script Deepgram scores your recording against">
              <p>{script}</p>
            </div>
          )}

          <div className="gee-controls">
            {recordingKey === key ? (
              <button type="button" className="gee-btn gee-btn--stop" onClick={stopRecording}>⏹ Stop</button>
            ) : (
              <button
                type="button"
                className="gee-btn gee-btn--record"
                onClick={() => startRecording(key)}
                disabled={recBusy || isSaving !== null}
              >
                🎙 {hasBlob ? 'Re-record' : 'Record'}
              </button>
            )}
            <button type="button" className="gee-btn" onClick={() => play({ toCaller: false })} disabled={!hasBlob}>
              {playing && !routeLive ? '⏹' : '🔊 You'}
            </button>
            <button
              type="button"
              className="gee-btn gee-btn--call"
              onClick={() => play({ toCaller: true })}
              disabled={!hasBlob || !selectedSinkId}
              title={selectedSinkId ? `Send a quiet test to ${sinkName}` : 'Pick an output (🔊) in the header first'}
            >
              📡 Caller
            </button>
            <label className="gee-btn gee-btn--upload" title="Upload an audio file (wav/webm/mp3)">
              ⬆ Upload
              <input
                type="file" accept="audio/*" hidden disabled={isSaving !== null}
                onChange={(e) => { uploadFile(key, e.target.files[0]); e.target.value = ''; }}
              />
            </label>
            {hasBlob && (
              <button type="button" className="gee-btn gee-btn--danger" onClick={() => setConfirmDelete(true)}>
                🗑 Delete
              </button>
            )}
          </div>

          {(routeLive || playing) && (
            <div className="gee-play-meter" title={routeLive ? 'Playing to the caller path' : 'Playing on your speakers'}>
              <div className="gee-play-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}

          {confirmDelete && (
            <div className="gee-confirm" role="alertdialog" aria-label="Delete recording">
              <span>Delete the recording for this greeting? This cannot be undone.</span>
              <button type="button" className="gee-btn gee-btn--danger" onClick={() => { setConfirmDelete(false); clearClip(key); }}>
                Yes, delete
              </button>
              <button type="button" className="gee-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}

          {recordingKey === key && (
            <div className="gee-record-meter"><div id="gee-record-bar" className="gee-record-bar-fill" style={{ width: '0%' }} /></div>
          )}

          {/* Health row — legibility / loudness / choppiness */}
          {hasBlob && (
            <div className="gee-health">
              <button type="button" className="gee-pill" onClick={() => analyzeHealth(key)} disabled={isAnalyzing === key}
                title={heard?.text ? `Robot heard: "${heard.text}" (${Math.round((heard.recall || 0) * 100)}% of script). Click to re-check.` : 'Sends clip to Deepgram, scores vs script. Click to run.'}>
                <span style={{ color: health?.color }}>{health?.label || 'UNTESTED'}</span>
                <span className="gee-pill-bar"><span className="gee-pill-fill" style={{ width: health?.width || '0%', backgroundColor: health?.color || '#94a3b8' }} /></span>
              </button>
              {loud && (
                <span className="gee-pill" title={`Loudness ${loud.rmsDb} dBFS RMS · peak ${loud.peakDb} dBFS — re-record closer to the mic when SOFT.`}>
                  🔊 {loud.label} {loud.rmsDb} dB
                </span>
              )}
              {chopV && chopV.label !== 'UNTESTED' && (
                <span className="gee-pill" title={`${chopV.dropouts} stutter events in ${chopV.activeSecs}s of speech.`}>
                  〰️ {chopV.label}
                </span>
              )}
              {routeOk && <span className="gee-pill is-ok">✅ CALL OK verified</span>}
            </div>
          )}

          {healthExplain && (
            <div className="gee-why">
              <strong>Why:</strong> {healthExplain.why}<br />
              <strong>Fix:</strong> {healthExplain.fix}
              {heard?.text && (<><br /><em>Robot heard: “{heard.text}”</em></>)}
            </div>
          )}
          {/* DETAIL_EDITOR */}
          {hasBlob ? (
            <AudioEditorPanel
              key={key}
              blob={blobs[key]}
              label={key}
              localVolume={localVolume}
              onSave={(editedBlob) => uploadFile(key, editedBlob)}
              onDelete={() => clearClip(key)}
            />
          ) : (
            <div className="gee-empty">
              <p>Empty slot — <strong>🎙 Record</strong> or <strong>⬆ Upload</strong> a take, then judge it here.</p>
            </div>
          )}

          {/* Advanced — collapsed by default, keeps the main pane calm */}
          <details className="gee-advanced">
            <summary>Advanced (volumes · mic monitor · route debug)</summary>
            <div className="gee-advanced-body">
              <button type="button" className="gee-btn" disabled={!selectedSinkId}
                onClick={() => playTestToneSink(selectedSinkId, SINK_TEST_TONE_VOL).catch(() => flashNotice('Sink beep failed — re-pick 🔊 in header.'))}
                title="Soft beep into the caller output — watch its mixer meter">
                Beep sink (quiet)
              </button>
              <button type="button" className={`gee-btn${monitorMic ? ' is-on' : ''}`} onClick={() => setMonitorMic((m) => !m)}>
                {monitorMic ? '🔴 Mic Monitor ON' : '👂 Mic Monitor'}
              </button>
              {monitorMic && (
                <input type="range" min="0" max="1" step="0.05" value={monitorVolume}
                  onChange={(e) => setMonitorVolume(parseFloat(e.target.value))} title="Monitor volume" />
              )}
              <div className="gee-route-debug">
                <div>Route mode: {readRouteModePreference()}</div>
                <div>Sink: {sinkName}</div>
                <div>Mic: {(inputDevices.find((d) => d.deviceId === selectedMicId)?.label || 'Default').slice(0, 30)}</div>
                <div>Mic mode: {micTestMode ? 'ON' : 'OFF'}</div>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Hidden playback elements */}
      <audio ref={localAudioRef} hidden onEnded={() => { setPlaying(false); setProgress(0); }} />
      <audio ref={sinkAudioRef} hidden onEnded={() => setPlaying(false)} />
    </div>
  );
};

export default GreetingEditorView;