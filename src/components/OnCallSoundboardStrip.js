/**
 * On-call quick-fire soundboard strip (v4.75.0).
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
  const [notice, setNotice] = useState('');

  const audioRefLocal = useRef(new Audio());
  const audioRefSink = useRef(new Audio());
  const rampCancelRef = useRef(null);

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
      for (const slot of ON_CALL_SLOTS) {
        const key = resolveClipKey(slot, getTimeOfDay());
        const b = await loadFile(key);
        if (b && !cancelled) state[key] = b;
      }
      if (!cancelled) setBlobs(state);
    })();
    return () => { cancelled = true; };
  }, [timeOfDay]);

  const flashNotice = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const clearPlay = useCallback(() => {
    setPlayingKey(null);
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

  return (
    <div className="on-call-soundboard-strip" data-guide="on-call-soundboard">
      <button
        type="button"
        className="on-call-sb-toggle"
        onClick={toggle}
        title={`Quick greetings [v${APP_VERSION}]`}
      >
        {collapsed ? '▸' : '▾'} Greetings
      </button>
      {!collapsed && (
        <div className="on-call-sb-buttons">
          {ON_CALL_SLOTS.map((slot) => {
            const key = resolveClipKey(slot, timeOfDay);
            const has = !!blobs[key];
            const action = ACTIONS.find((a) => a.id === slot.actionId);
            const label = slot.label || action?.label || slot.actionId;
            const lang = action?.lang;
            const blocked = has && !micTestMode && (
              healthScores[key] === undefined ||
              healthScores[key] < CALL_ROUTE_MIN_SCORE ||
              !isManualCallOk(manualCallOk, key, selectedSinkId, selectedMicId)
            );
            return (
              <button
                key={key}
                type="button"
                className={`on-call-sb-btn${playingKey === key ? ' is-playing' : ''}${!has ? ' is-missing' : ''}${blocked ? ' is-blocked' : ''}`}
                disabled={!has}
                onClick={() => fireClip(slot)}
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
                {lang && <span className="on-call-sb-lang">{lang.toUpperCase()}</span>}
                {label}
              </button>
            );
          })}
        </div>
      )}
      {notice && <span className="on-call-sb-notice">{notice}</span>}
    </div>
  );
}

export default OnCallSoundboardStrip;
