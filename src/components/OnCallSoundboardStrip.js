/**
 * On-call quick-fire soundboard strip — compact thumbnail gallery.
 * Fires pre-recorded clips via passthrough routing during active calls.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ACTIONS } from './GreetingsPanel';
import { loadFile } from '../utils/storage';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import {
  loadManualCallOk,
  isManualCallOk,
} from '../utils/routeVerification';
import { bindAudioToSink, primePlaybackElements, rampVolume } from '../utils/audioRoute';
import { readRouteModePreference, ROUTE_MODE } from '../utils/audioRoutePassthrough';
import { logRouteEvent, ROUTE_EVENT } from '../utils/routeDiagnostics';
import { APP_VERSION } from '../constants/version';

const CALL_ROUTE_MIN_SCORE = 0.5;
const SIZE_KEY = 'catint_oncall_sb_size';

/** High-use slots for on-call strip — keeps UI compact. */
export const ON_CALL_SLOTS = [
  { actionId: 'greeting_en', dynamic: true },
  { actionId: 'greeting_es', dynamic: true },
  { actionId: 'hold_exc_en', label: 'Hold EN' },
  { actionId: 'hold_exc_es', label: 'Hold ES' },
  { actionId: 'sign_off', label: 'Sign Off' },
  { actionId: 'closer_louder', label: 'Louder' },
  { actionId: 'intake', label: 'Intake' },
];

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const resolveClipKey = (slot, timeOfDay) =>
  slot.dynamic ? `${slot.actionId}_${timeOfDay}` : slot.actionId;

const readThumbSize = () => {
  try {
    const n = parseInt(localStorage.getItem(SIZE_KEY), 10);
    return Number.isFinite(n) ? Math.min(56, Math.max(28, n)) : 36;
  } catch {
    return 36;
  }
};

export function OnCallSoundboardStrip({ micTestMode = false, collapsed: collapsedProp, onToggleCollapse }) {
  const {
    selectedSinkId,
    selectedMicId,
    localVolume,
    sinkVolume,
    playClipToSink,
    stopClipToSink,
  } = useAudioSettings();

  const [collapsed, setCollapsed] = useState(collapsedProp ?? true);
  const [blobs, setBlobs] = useState({});
  const [thumbs, setThumbs] = useState({});
  const [healthScores] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('catint_audio_health')) || {};
    } catch {
      return {};
    }
  });
  const [manualCallOk] = useState(() => loadManualCallOk());
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay);
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [thumbSize, setThumbSize] = useState(readThumbSize);

  const audioRefLocal = useRef(new Audio());
  const audioRefSink = useRef(new Audio());
  const rampCancelRef = useRef(null);
  const progressRafRef = useRef(null);
  const thumbUrlsRef = useRef([]);

  useEffect(() => {
    const tick = () => setTimeOfDay(getTimeOfDay());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = {};
      const thumbState = {};
      const urls = [];
      for (const slot of ON_CALL_SLOTS) {
        const key = resolveClipKey(slot, getTimeOfDay());
        const b = await loadFile(key);
        if (b && !cancelled) state[key] = b;
        const thumbBlob = await loadFile(`thumb_${slot.actionId}`);
        if (thumbBlob && !cancelled) {
          const url = URL.createObjectURL(thumbBlob);
          urls.push(url);
          thumbState[slot.actionId] = url;
        }
      }
      if (!cancelled) {
        thumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        thumbUrlsRef.current = urls;
        setBlobs(state);
        setThumbs(thumbState);
      } else {
        urls.forEach((u) => URL.revokeObjectURL(u));
      }
    })();
    return () => {
      cancelled = true;
      thumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      thumbUrlsRef.current = [];
    };
  }, [timeOfDay]);

  const flashNotice = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const stopProgress = () => {
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    progressRafRef.current = null;
    setPlaybackProgress(0);
  };

  const trackProgress = useCallback(() => {
    const a = audioRefLocal.current;
    if (a && a.duration) {
      setPlaybackProgress(a.currentTime / a.duration);
    }
    progressRafRef.current = requestAnimationFrame(trackProgress);
  }, []);

  const clearPlay = useCallback(() => {
    setPlayingKey(null);
    stopProgress();
    stopClipToSink();
    audioRefLocal.current.pause();
    audioRefSink.current.pause();
    window.__CAT_AUDIO_VOL = 0;
    if (rampCancelRef.current) rampCancelRef.current();
    rampCancelRef.current = null;
  }, [stopClipToSink]);

  const fireClip = async (slot) => {
    const key = resolveClipKey(slot, timeOfDay);
    const blob = blobs[key];
    if (!blob) {
      flashNotice(`No clip: ${slot.label || key}`);
      return;
    }

    if (playingKey === key) {
      clearPlay();
      return;
    }
    clearPlay();

    if (micTestMode) {
      const url = URL.createObjectURL(blob);
      logRouteEvent(ROUTE_EVENT.PLAY_START, { clipKey: key, routeMode: 'local_speakers', onCall: true, micTestMode: true });
      setPlayingKey(key);
      progressRafRef.current = requestAnimationFrame(trackProgress);
      primePlaybackElements(audioRefLocal.current, audioRefSink.current);
      audioRefLocal.current.src = url;
      const onEnd = () => {
        URL.revokeObjectURL(url);
        clearPlay();
        logRouteEvent(ROUTE_EVENT.PLAY_END, { clipKey: key, onCall: true, micTestMode: true });
      };
      audioRefLocal.current.onended = onEnd;
      try {
        await audioRefLocal.current.play();
        rampCancelRef.current = rampVolume(audioRefLocal.current, null, localVolume, 0);
      } catch (e) {
        console.error('On-call soundboard local play error:', e);
        logRouteEvent(ROUTE_EVENT.PLAY_FAIL, { clipKey: key, reason: e?.message, micTestMode: true });
        clearPlay();
      }
      return;
    }

    const score = healthScores[key];
    const healthOk = score !== undefined && score >= CALL_ROUTE_MIN_SCORE;
    const callOk = isManualCallOk(manualCallOk, key, selectedSinkId, selectedMicId);
    if (!healthOk || !callOk) {
      flashNotice(!healthOk ? '⛔ Health gate — record in Studio' : '📡 CALL OK required — test off-call first');
      return;
    }

    if (!selectedSinkId) {
      flashNotice('⚠️ Pick VB-Cable in header Speaker');
      return;
    }

    const url = URL.createObjectURL(blob);
    const routeMode = readRouteModePreference();
    const usePassthrough = routeMode === ROUTE_MODE.PASSTHROUGH;

    logRouteEvent(ROUTE_EVENT.PLAY_START, { clipKey: key, routeMode, onCall: true });
    setPlayingKey(key);
    progressRafRef.current = requestAnimationFrame(trackProgress);
    primePlaybackElements(audioRefLocal.current, audioRefSink.current);
    audioRefLocal.current.src = url;

    const onEnd = () => {
      URL.revokeObjectURL(url);
      clearPlay();
      logRouteEvent(ROUTE_EVENT.PLAY_END, { clipKey: key, onCall: true });
    };
    audioRefLocal.current.onended = onEnd;
    audioRefSink.current.onended = onEnd;

    try {
      await audioRefLocal.current.play();
      rampCancelRef.current = rampVolume(audioRefLocal.current, null, localVolume, 0);

      if (usePassthrough) {
        const pt = await playClipToSink(blob, sinkVolume, { clipKey: key });
        if (!pt.ok) {
          logRouteEvent(ROUTE_EVENT.FALLBACK_DUAL, { clipKey: key, reason: pt.reason });
          const bound = await bindAudioToSink(audioRefSink.current, selectedSinkId);
          if (bound) {
            audioRefSink.current.src = url;
            await audioRefSink.current.play();
            rampCancelRef.current = rampVolume(audioRefLocal.current, audioRefSink.current, localVolume, sinkVolume);
          } else {
            flashNotice('⚠️ Route failed');
            clearPlay();
          }
        }
      } else {
        const bound = await bindAudioToSink(audioRefSink.current, selectedSinkId);
        if (!bound) {
          flashNotice('⚠️ Sink bind failed');
          clearPlay();
          return;
        }
        audioRefSink.current.src = url;
        await audioRefSink.current.play();
        rampCancelRef.current = rampVolume(audioRefLocal.current, audioRefSink.current, localVolume, sinkVolume);
      }
    } catch (e) {
      console.error('On-call soundboard play error:', e);
      logRouteEvent(ROUTE_EVENT.PLAY_FAIL, { clipKey: key, reason: e?.message });
      clearPlay();
    }
  };

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onToggleCollapse?.(next);
  };

  const playingSlot = playingKey
    ? ON_CALL_SLOTS.find((s) => resolveClipKey(s, timeOfDay) === playingKey)
    : null;
  const playingLabel = playingSlot
    ? (playingSlot.label || ACTIONS.find((a) => a.id === playingSlot.actionId)?.label || playingKey)
    : null;

  return (
    <div
      className={`on-call-soundboard-strip${collapsed ? '' : ' is-expanded'}${playingKey ? ' is-playing-strip' : ''}`}
      data-guide="on-call-soundboard"
      style={{ '--oncall-thumb': `${thumbSize}px` }}
    >
      <button
        type="button"
        className="on-call-sb-toggle"
        onClick={toggle}
        title={`Quick greetings [v${APP_VERSION}]`}
      >
        {collapsed ? '▸' : '▾'} Greetings
        {playingKey && (
          <span className="on-call-sb-live" role="status">
            ▶ {micTestMode ? 'local' : 'LIVE'}{playingLabel ? ` · ${playingLabel}` : ''}
          </span>
        )}
      </button>
      {!collapsed && (
        <>
          <label className="on-call-sb-size" title="Thumbnail size">
            <input
              type="range"
              min="28"
              max="56"
              step="4"
              value={thumbSize}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setThumbSize(n);
                try { localStorage.setItem(SIZE_KEY, String(n)); } catch { /* ignore */ }
              }}
            />
          </label>
          <div className="on-call-sb-gallery">
            {ON_CALL_SLOTS.map((slot) => {
              const key = resolveClipKey(slot, timeOfDay);
              const has = !!blobs[key];
              const action = ACTIONS.find((a) => a.id === slot.actionId);
              const label = slot.label || action?.label || slot.actionId;
              const lang = action?.lang;
              const thumbUrl = thumbs[slot.actionId];
              const isPlaying = playingKey === key;
              const blocked = has && !micTestMode && (
                healthScores[key] === undefined ||
                healthScores[key] < CALL_ROUTE_MIN_SCORE ||
                !isManualCallOk(manualCallOk, key, selectedSinkId, selectedMicId)
              );
              return (
                <button
                  key={key}
                  type="button"
                  className={`on-call-sb-tile${isPlaying ? ' is-playing' : ''}${!has ? ' is-missing' : ''}${blocked ? ' is-blocked' : ''}${thumbUrl ? ' has-thumb' : ''}`}
                  disabled={!has}
                  onClick={() => fireClip(slot)}
                  style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}
                  title={
                    !has
                      ? 'Record in Soundboard Studio'
                      : micTestMode
                        ? 'Play on your speakers/headphones'
                        : blocked
                          ? 'Health or CALL OK gate — test off-call'
                          : `Fire ${label} to patient path`
                  }
                >
                  {isPlaying && (
                    <span className="on-call-sb-tile-progress" style={{ width: `${playbackProgress * 100}%` }} />
                  )}
                  <span className="on-call-sb-tile-chrome">
                    {lang && <span className="on-call-sb-lang">{lang.toUpperCase()}</span>}
                    <span className="on-call-sb-tile-label">{isPlaying ? '⏹' : label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {notice && <span className="on-call-sb-notice">{notice}</span>}
    </div>
  );
}

export default OnCallSoundboardStrip;
