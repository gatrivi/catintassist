/**
 * On-call quick-fire soundboard strip — compact thumbnail gallery.
 * Fires pre-recorded clips via passthrough routing during active calls.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ACTIONS } from './GreetingsPanel';
import { loadFile, SOUNDBOARD_CHANGED_EVENT } from '../utils/storage';
import {
  readGalleryPicks,
  writeGalleryPicks,
  toggleGalleryPick,
  MAX_GALLERY,
} from '../utils/oncallGallery';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import {
  loadManualCallOk,
  isManualCallOk,
} from '../utils/routeVerification';
import { bindAudioToSink, primePlaybackElements, rampVolume } from '../utils/audioRoute';
import { readRouteModePreference, ROUTE_MODE } from '../utils/audioRoutePassthrough';
import { readCallerMonitor, writeCallerMonitor } from '../utils/callerMonitor';
import { logRouteEvent, ROUTE_EVENT } from '../utils/routeDiagnostics';
import { APP_VERSION } from '../constants/version';
import { getWorkSlot, getSlotAuto, getWorkClockLabel, readSlotOverride, writeSlotOverride, nearestSlotOrder, TIME_SLOTS, WORK_TIMEZONE } from '../utils/workTime';

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

/**
 * v4.171.0: short names for the original seven, so a 36px tile still reads at a
 * glance. Greetings you add yourself fall back to their full ACTIONS label.
 */
export const GALLERY_LABELS = ON_CALL_SLOTS.reduce(
  (acc, s) => (s.label ? { ...acc, [s.actionId]: s.label } : acc),
  {}
);

export const isKnownActionId = (id) => ACTIONS.some((a) => a.id === id);

/** What a tile shows, in one place: the short override, else the real label. */
export const slotLabelFor = (actionId) => GALLERY_LABELS[actionId] || ACTIONS.find((a) => a.id === actionId)?.label || actionId;

/** v4.131.0: the slot name shown in the collapsed pill. */
export const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

/** v4.131.1: the manual picker row — three slots plus "A" (auto/clock). */
export const SLOT_PICKS = [
  { value: 'morning', short: 'AM' },
  { value: 'afternoon', short: 'PM' },
  { value: 'evening', short: 'Eve' },
  { value: null, short: 'A' },
];

const resolveClipKey = (slot, timeOfDay) =>
  slot.dynamic ? `${slot.actionId}_${timeOfDay}` : slot.actionId;

/** v4.171.0: a pick becomes a slot — only `dynamic` differs per greeting. */
const slotFromActionId = (actionId) => ({
  actionId,
  dynamic: !!ACTIONS.find((a) => a.id === actionId)?.dynamic,
});

/**
 * Every clip key the strip holds in memory. ALL greetings, not just the picked
 * ones — the picker has to tell a recorded greeting from an unrecorded one
 * before you add it. ~84 IndexedDB reads once per scan: local, sub-millisecond.
 */
export const galleryScanKeys = () => ACTIONS.flatMap((a) =>
  a.dynamic ? TIME_SLOTS.map((t) => `${a.id}_${t}`) : [a.id]);

export const GALLERY_THUMB_KEYS = () => ACTIONS.map((a) => `thumb_${a.id}`);

/** v4.95.3: preferred slot key, else any saved variant — same rule for tiles and firing. */
const resolveFireKey = (slot, timeOfDay, blobs) => {
  const preferred = resolveClipKey(slot, timeOfDay);
  if (blobs[preferred]) return preferred;
  if (!slot.dynamic) return preferred;
  return nearestSlotOrder(timeOfDay).map((t) => `${slot.actionId}_${t}`).find((k) => blobs[k]) || preferred;
};

/** v4.110.0: icon shown when a non-preferred time-of-day recording fires. */
const VARIANT_ICON = { morning: '☀', afternoon: '🌤', evening: '🌙' };

const readThumbSize = () => {
  try {
    const n = parseInt(localStorage.getItem(SIZE_KEY), 10);
    return Number.isFinite(n) ? Math.min(56, Math.max(28, n)) : 36;
  } catch {
    return 36;
  }
};

export function OnCallSoundboardStrip({ micTestMode = false, collapsed: collapsedProp, onToggleCollapse, onOpenGreetingEditor }) {
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
  // v4.131.0: gates the pill's "missing recording" cue — without it the warning
  // would flash for a frame before the IndexedDB load resolves.
  const [clipsLoaded, setClipsLoaded] = useState(false);
  const [thumbs, setThumbs] = useState({});
  const [healthScores, setHealthScores] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('catint_audio_health')) || {};
    } catch {
      return {};
    }
  });
  const [manualCallOk, setManualCallOk] = useState(() => loadManualCallOk());
  // v4.131.1: the slot in use. Seeded from getWorkSlot(), so a saved manual
  // pick survives a reload and the tiles show the right recording at once.
  const [timeOfDay, setTimeOfDay] = useState(getWorkSlot);
  // v4.131.1: the manual pick (`null` = follow the clock), the pick the clock
  // alone would make (shown in the "A" tooltip) and the shift clock itself.
  const [slotPick, setSlotPick] = useState(readSlotOverride);
  const [autoSlot, setAutoSlot] = useState(getSlotAuto);
  const [workClock, setWorkClock] = useState(getWorkClockLabel);
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [thumbSize, setThumbSize] = useState(readThumbSize);
  // v4.128.0: caller fires are sink-only by default — a parallel local copy
  // plus the old A1→cable loop made every greeting sound twice.
  const [monitor, setMonitor] = useState(readCallerMonitor);
  // v4.171.0: your gallery, your order. The picker edits this in place, so the
  // seven that used to be hardcoded are only a first-run default.
  const [picks, setPicks] = useState(() => readGalleryPicks(isKnownActionId));
  const [pickMode, setPickMode] = useState(false);
  // v4.171.0: a gate refusal that would only flash for 3.5s is indistinguishable
  // from a dead button on a live call, so refusals park here until answered.
  const [blockInfo, setBlockInfo] = useState(null);
  // v4.171.0: bumped whenever a clip is recorded or deleted anywhere, so the
  // in-memory copy the tiles fire from can never lag the audio.
  const [scanTick, setScanTick] = useState(0);

  const gallerySlots = useMemo(() => picks.map(slotFromActionId), [picks]);

  const audioRefLocal = useRef(new Audio());
  const audioRefSink = useRef(new Audio());
  const playbackAttemptRef = useRef(0);
  const rampCancelRef = useRef(null);
  const progressRafRef = useRef(null);
  const thumbUrlsRef = useRef([]);

  useEffect(() => {
    const tick = () => {
      setTimeOfDay(getWorkSlot());
      setAutoSlot(getSlotAuto());
      setWorkClock(getWorkClockLabel());
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Re-read gates when Studio updates them in another view/tab, or on refocus —
  // they were snapshotted once on mount, so a fresh CALL OK never unblocked tiles.
  useEffect(() => {
    const refresh = () => {
      try { setHealthScores(JSON.parse(localStorage.getItem('catint_audio_health')) || {}); } catch { /* ignore */ }
      setManualCallOk(loadManualCallOk());
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('catint_gates_updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('catint_gates_updated', refresh);
    };
  }, []);

  // v4.171.0: any recording or delete anywhere in the app re-scans the gallery.
  useEffect(() => {
    const bump = () => setScanTick((n) => n + 1);
    window.addEventListener(SOUNDBOARD_CHANGED_EVENT, bump);
    return () => window.removeEventListener(SOUNDBOARD_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = {};
      const thumbState = {};
      const urls = [];
      // v4.131.0: dynamic greetings load every time-of-day variant, so the
      // nearest-slot fallback and its pill cue work off their own slot too.
      for (const key of galleryScanKeys()) {
        const b = await loadFile(key);
        if (b && !cancelled) state[key] = b;
      }
      for (const key of GALLERY_THUMB_KEYS()) {
        const thumbBlob = await loadFile(key);
        if (thumbBlob && !cancelled) {
          const url = URL.createObjectURL(thumbBlob);
          urls.push(url);
          thumbState[key.slice('thumb_'.length)] = url;
        }
      }
      if (!cancelled) {
        thumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        thumbUrlsRef.current = urls;
        setBlobs(state);
        setThumbs(thumbState);
        setClipsLoaded(true);
      } else {
        urls.forEach((u) => URL.revokeObjectURL(u));
      }
    })();
    return () => {
      cancelled = true;
      thumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      thumbUrlsRef.current = [];
    };
  }, [timeOfDay, scanTick]);

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
    // v4.128.0: clock whichever element is actually playing (sink-only fires
    // leave the local element parked with no src).
    const l = audioRefLocal.current;
    const s = audioRefSink.current;
    const a = (l && l.duration && !l.paused) ? l : s;
    if (a && a.duration) {
      setPlaybackProgress(a.currentTime / a.duration);
    }
    progressRafRef.current = requestAnimationFrame(trackProgress);
  }, []);

  const clearPlay = useCallback((stopSink = true) => {
    playbackAttemptRef.current += 1;
    setPlayingKey(null);
    stopProgress();
    if (stopSink) stopClipToSink();
    audioRefLocal.current.pause();
    audioRefSink.current.pause();
    window.__CAT_AUDIO_VOL = 0;
    if (rampCancelRef.current) rampCancelRef.current();
    rampCancelRef.current = null;
  }, [stopClipToSink]);

  const fireClip = async (slot) => {
    const key = resolveFireKey(slot, timeOfDay, blobs);
    const blob = blobs[key];
    if (!blob) {
      // v4.171.0: this tile used to be `disabled`, so a tap did nothing at all.
      // Say which slot is empty instead — it never reaches a play path.
      const label = slotLabelFor(slot.actionId);
      flashNotice(
        slot.dynamic
          ? `No ${label} recording for the ${SLOT_LABEL[timeOfDay]} slot — pick AM/PM/Eve, or record it in the Greeting Editor`
          : `No ${label} recording yet — record it in the Greeting Editor`
      );
      return;
    }

    if (playingKey === key) {
      clearPlay();
      return;
    }
    clearPlay();
    setBlockInfo(null);

    const attempt = ++playbackAttemptRef.current;
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
    const label = slotLabelFor(slot.actionId);
    // v4.103.0 user agency: weak legibility warns but never blocks — the
    // interpreter decides. CALL OK (proven route) stays a hard gate.
    if (!callOk) {
      // v4.171.0: re-recording a family wipes its CALL OK, so this is the most
      // common "dead button" on a live call. Park it with a way out.
      setBlockInfo({
        key,
        text: `${label} is not verified for this route (CALL OK)`,
        fix: onOpenGreetingEditor ? 'Test it' : null,
        hint: onOpenGreetingEditor ? null : 'off-call only',
      });
      return;
    }
    if (!healthOk) {
      flashNotice(
        score === undefined
          ? '⚠ Untested clip — firing anyway (health check pending)'
          : `⚠ Legibility ${Math.round((score || 0) * 100)}% — firing anyway, your call`
      );
    }

    if (!selectedSinkId) {
      setBlockInfo({
        key,
        text: `${label} cannot play — no caller output picked`,
        fix: null,
        hint: 'Pick VB out (CABLE Input) in header Speaker',
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const routeMode = readRouteModePreference();
    const usePassthrough = routeMode === ROUTE_MODE.PASSTHROUGH;
    // v4.128.0: sink-only caller fire. The old always-on local copy is what
    // the interpreter heard as greeting #1 (greeting #2 was the A1→cable loop).
    const withMonitor = readCallerMonitor();

    logRouteEvent(ROUTE_EVENT.PLAY_START, { clipKey: key, routeMode, onCall: true, withMonitor });
    setPlayingKey(key);
    progressRafRef.current = requestAnimationFrame(trackProgress);
    primePlaybackElements(withMonitor ? audioRefLocal.current : null, audioRefSink.current);
    if (withMonitor) audioRefLocal.current.src = url;

    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      URL.revokeObjectURL(url);
      clearPlay();
      logRouteEvent(ROUTE_EVENT.PLAY_END, { clipKey: key, onCall: true });
    };
    audioRefLocal.current.onended = onEnd;
    audioRefSink.current.onended = onEnd;

    try {
      if (withMonitor) {
        await audioRefLocal.current.play();
        rampCancelRef.current = rampVolume(audioRefLocal.current, null, localVolume, 0);
      }

      if (usePassthrough) {
        const pt = await playClipToSink(blob, sinkVolume, {
          clipKey: key,
          onProgress: (p) => { if (!withMonitor) setPlaybackProgress(p); },
        });
        if (pt.cancelled) {
          if (attempt !== playbackAttemptRef.current) return;
          clearPlay(false); // Cancellation must not stop the shared sink's replacement clip.
          if (pt.reason === 'sink_changed') {
            flashNotice('Output changed — play again on the new route.');
          }
          return;
        }
        if (!pt.ok) {
          logRouteEvent(ROUTE_EVENT.FALLBACK_DUAL, { clipKey: key, reason: pt.reason });
          const bound = await bindAudioToSink(audioRefSink.current, selectedSinkId);
          if (bound) {
            audioRefSink.current.src = url;
            await audioRefSink.current.play();
            rampCancelRef.current = rampVolume(withMonitor ? audioRefLocal.current : null, audioRefSink.current, localVolume, sinkVolume);
          } else {
            flashNotice('⚠️ Route failed');
            clearPlay();
          }
        } else if (!withMonitor) {
          // Passthrough owns the sink element — no local/sink element will end,
          // so close the tile state from its progress callback instead of hanging on ▶.
          onEnd();
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
        rampCancelRef.current = rampVolume(withMonitor ? audioRefLocal.current : null, audioRefSink.current, localVolume, sinkVolume);
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

  // v4.131.0: one writer for the caller-monitor pref — the pill control and the
  // expanded checkbox can never drift. fireClip still re-reads it at fire time.
  const applyMonitor = (next) => {
    setMonitor(next);
    writeCallerMonitor(next);
  };

  // v4.171.0: one writer for the gallery list — the picker edits the state, the
  // persistence, the re-scan and the notice all hang off this single call.
  const togglePick = (actionId) => {
    const result = toggleGalleryPick(picks, actionId, isKnownActionId);
    if (result.full) {
      flashNotice(`Max ${MAX_GALLERY} greetings on the strip — drop one first`);
      return;
    }
    setPicks(result.picks);
    writeGalleryPicks(result.picks, isKnownActionId);
    if (result.added) setNotice('');
  };

  // v4.131.1: manual slot pick. Persist first (so every caller of workTime obeys
  // it), then switch this strip on the SAME click — tiles and pill move together.
  // `null` clears the key and hands control back to the work clock.
  const pickSlot = (slot) => {
    writeSlotOverride(slot);
    const saved = readSlotOverride(); // junk input normalises to "auto"
    setSlotPick(saved);
    setTimeOfDay(saved || getWorkSlot());
  };

  const playingSlot = playingKey
    ? gallerySlots.find((s) => resolveClipKey(s, timeOfDay) === playingKey)
    : null;
  const playingLabel = playingSlot ? slotLabelFor(playingSlot.actionId) : null;

  // v4.131.0 pill cues: which recording the two dynamic greetings would fire,
  // and whether any of them has no recording at all.
  const langOf = (actionId) => (ACTIONS.find((a) => a.id === actionId)?.lang || '').toUpperCase();
  const greetingSlots = gallerySlots.filter((s) => s.dynamic);
  const greetingCues = greetingSlots.map((slot) => {
    const key = resolveFireKey(slot, timeOfDay, blobs);
    return { slot, has: !!blobs[key], variant: key.slice(slot.actionId.length + 1) };
  });
  const fallbackVariants = [...new Set(
    greetingCues.filter((c) => c.has && c.variant !== timeOfDay).map((c) => c.variant)
  )];
  const missingLangs = greetingCues.filter((c) => !c.has).map((c) => langOf(c.slot.actionId));

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
        <span className="on-call-sb-slot">· {SLOT_LABEL[timeOfDay]}</span>
        {playingKey && (
          <span className="on-call-sb-live" role="status">
            ▶ {micTestMode ? 'local' : 'LIVE'}{playingLabel ? ` · ${playingLabel}` : ''}
          </span>
        )}
      </button>
      {/* v4.131.1: manual time-of-day pick — the interpreter's choice beats the
          work clock. A sibling of the pill controls, never inside a button. */}
      <span
        className="on-call-sb-picks"
        data-guide="on-call-slot-pick"
        role="group"
        aria-label="Greeting time of day"
      >
        {SLOT_PICKS.map(({ value, short }) => {
          const active = slotPick === value;
          return (
            <button
              key={short}
              type="button"
              className={`on-call-sb-pick${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => pickSlot(value)}
              title={value
                ? `Play the ${SLOT_LABEL[value]} recording`
                : `Automatic - follows the work clock (${SLOT_LABEL[autoSlot].toLowerCase()} now, ${workClock} ${WORK_TIMEZONE})`}
            >
              {short}
            </button>
          );
        })}
      </span>
      {collapsed && fallbackVariants.map((v) => (
        <span
          key={`variant-${v}`}
          className="on-call-sb-slot-variant"
          title={`No ${SLOT_LABEL[timeOfDay]} recording — this fires the ${SLOT_LABEL[v]} clip`}
        >
          {VARIANT_ICON[v]} using {SLOT_LABEL[v]}
        </span>
      ))}
      {collapsed && clipsLoaded && missingLangs.map((lang) => (
        <span
          key={`missing-${lang}`}
          className="on-call-sb-slot-missing"
          title={`No ${lang} greeting recorded for any time of day — record it in Soundboard Studio`}
        >
          · {lang} missing
        </span>
      ))}
      <button
        type="button"
        className={`on-call-sb-hear${monitor ? ' is-on' : ''}`}
        aria-pressed={monitor}
        onClick={() => applyMonitor(!monitor)}
        title="OFF: greeting goes to the caller only. ON: you also hear a local copy."
      >
        {monitor ? '🔊' : '🔇'} Hear
      </button>
      {playingKey && (
        <button
          type="button"
          className="on-call-sb-stop"
          onClick={() => clearPlay()}
          title="Stop the greeting now — patient path goes silent"
        >
          ⏹ Stop
        </button>
      )}
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
          <label
            className="on-call-sb-monitor"
            title="OFF = greeting goes to the caller only (no double-hear). ON = you also hear a local copy."
          >
            <input
              type="checkbox"
              checked={monitor}
              onChange={(e) => applyMonitor(e.target.checked)}
            />
            Monitor
          </label>
          {!pickMode && (
            <div className="on-call-sb-gallery">
              {gallerySlots.map((slot) => {
                const key = resolveFireKey(slot, timeOfDay, blobs);
                const has = !!blobs[key];
                const action = ACTIONS.find((a) => a.id === slot.actionId);
                const label = slotLabelFor(slot.actionId);
                const lang = action?.lang;
                const thumbUrl = thumbs[slot.actionId];
                const isPlaying = playingKey === key;
                // v4.110.0: cue when a fallback time-of-day recording is used
                const variantUsed = slot.dynamic && key !== resolveClipKey(slot, timeOfDay)
                  ? key.slice(slot.actionId.length + 1)
                  : null;
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
                    // v4.171.0: aria-disabled, not disabled — the tap still
                    // explains itself instead of vanishing. No play path here.
                    aria-disabled={!has}
                    onClick={() => fireClip(slot)}
                    style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}
                    title={
                      !has
                        ? `No ${label} recording for the ${SLOT_LABEL[timeOfDay]} slot — tap for options`
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
                    {lang && <span className={`on-call-sb-lang lang-${lang}`}>{lang.toUpperCase()}</span>}
                    {!has && <span className="on-call-sb-tile-empty" title="Not recorded for this slot">○</span>}
                    {variantUsed && (
                      <span className="on-call-sb-variant" title={`Using the ${variantUsed} recording`}>
                        {VARIANT_ICON[variantUsed]}
                      </span>
                    )}
                    <span className="on-call-sb-tile-chrome">
                      <span className="on-call-sb-tile-label">{isPlaying ? '⏹' : label}</span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="on-call-sb-tile on-call-sb-pick-btn"
                onClick={() => setPickMode(true)}
                title="Choose which greetings sit here (up to 8)"
              >
                <span className="on-call-sb-tile-chrome">
                  <span className="on-call-sb-tile-label">⚙</span>
                </span>
              </button>
            </div>
          )}
          {/* v4.171.0: the picker. All 24 greetings, not the seven that used to
              be hardcoded. Lives inside the strip so it is reachable mid-call
              without leaving the call UI. */}
          {pickMode && (
            <div className="on-call-sb-picker" role="dialog" aria-label="Choose on-call greetings">
              <div className="on-call-sb-picker-head">
                <span title="Tap to add or drop. To move one, drop it and add it again in the spot you want.">
                  {picks.length}/{MAX_GALLERY} on the strip
                </span>
                <button type="button" onClick={() => setPickMode(false)}>Done</button>
              </div>
              <div className="on-call-sb-picker-grid">
                {ACTIONS.map((action) => {
                  const on = picks.includes(action.id);
                  // The scan loaded every greeting, so "recorded" is knowable
                  // before you add it — not only for what is already on the row.
                  const recorded = !!blobs[resolveFireKey(slotFromActionId(action.id), timeOfDay, blobs)];
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`on-call-sb-chip${on ? ' is-on' : ''}${recorded ? '' : ' is-unrecorded'}`}
                      aria-pressed={on}
                      onClick={() => togglePick(action.id)}
                      title={recorded ? action.label : `${action.label} — nothing recorded for ${SLOT_LABEL[timeOfDay]}`}
                    >
                      {on ? `${picks.indexOf(action.id) + 1}. ` : ''}{slotLabelFor(action.id)}
                      {action.lang && <span className={`on-call-sb-lang lang-${action.lang}`}>{action.lang.toUpperCase()}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {blockInfo && (
        <span className="on-call-sb-block" role="status">
          🔒 {blockInfo.text}
          {blockInfo.hint && <span className="on-call-sb-block-hint"> · {blockInfo.hint}</span>}
          {blockInfo.fix && (
            <button type="button" className="on-call-sb-block-fix" onClick={() => onOpenGreetingEditor(blockInfo.key)}>
              {blockInfo.fix}
            </button>
          )}
          <button type="button" className="on-call-sb-block-dismiss" onClick={() => setBlockInfo(null)} aria-label="Dismiss">
            ✕
          </button>
        </span>
      )}
      {notice && <span className="on-call-sb-notice">{notice}</span>}
    </div>
  );
}

export default OnCallSoundboardStrip;
