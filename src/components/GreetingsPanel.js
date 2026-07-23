import React, { useState, useEffect, useRef } from 'react';
import {
  saveFile,
  loadFile,
  deleteFile,
  generateObjectUrl,
  getStorageSummary,
  exportStorageBackup,
  importStorageBackup,
} from '../utils/storage';
import { bindAudioToSink, primePlaybackElements, rampVolume } from '../utils/audioRoute';
import { readRouteModePreference, ROUTE_MODE } from '../utils/audioRoutePassthrough';
import {
  logRouteEvent,
  assessSttLoadRisk,
  getRouteDiagnostics,
  formatRouteDiagLine,
  ROUTE_EVENT,
} from '../utils/routeDiagnostics';
import { analyzeBlobHealth, formatHealthDisplay, truncateDeviceLabel, isLocalOnlyPlayback, getPreflightSteps, isPreflightReady, playTestToneSink } from '../utils/audioSelfTest';
import {
  buildRouteFingerprint,
  isManualCallOk,
  loadManualCallOk,
  setManualCallOk,
  warnLegacyCallPathStorage,
} from '../utils/routeVerification';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { diagnoseVbCableRoute } from '../utils/audioSourceManager';
import AudioEditorPanel from './AudioEditorPanel';
import { getRuntimeDeepgramKey } from '../utils/deepgramRuntimeKey';
import { ElementHintTarget } from './ElementHint';

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
const TIME_SLOT_META = {
  morning: { icon: '☀️', short: 'AM', name: 'Morning' },
  afternoon: { icon: '🌤', short: 'PM', name: 'Afternoon' },
  evening: { icon: '🌙', short: 'Eve', name: 'Evening' },
};

const getActionSlotPills = (action, blobs) => {
  if (!action.dynamic) return null;
  return TIME_SLOTS.map((t) => ({
    t,
    key: `${action.id}_${t}`,
    has: !!blobs[`${action.id}_${t}`],
    ...TIME_SLOT_META[t],
  }));
};
const CALL_ROUTE_MIN_SCORE = 0.5;

const getActionClipKeys = (action) =>
  action.dynamic ? TIME_SLOTS.map((t) => `${action.id}_${t}`) : [action.id];

const getActionCompletion = (action, blobs) => {
  const keys = getActionClipKeys(action);
  const saved = keys.filter((k) => blobs[k]).length;
  return { saved, total: keys.length, keys };
};

const isCallerReady = (score) => score !== undefined && score >= CALL_ROUTE_MIN_SCORE;

const isCallPathReady = (manualCallOk, clipKey, sinkId, micId) =>
  isManualCallOk(manualCallOk, clipKey, sinkId, micId);

const ROUTE_TEST_LABELS = {
  sink_played: 'sink played',
  manual_ok: 'CALL OK confirmed',
  declined: 'declined',
  fail: 'fail',
};

const buildWaveformPeaks = async (blob, bars = 56) => {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const peaks = [];
    for (let i = 0; i < bars; i += 1) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channel.length);
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += Math.abs(channel[j]);
      peaks.push(sum / (end - start || 1));
    }
    const max = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / max);
  } finally {
    ctx.close().catch(() => {});
  }
};

const ClipWaveform = ({ peaks, progress = 0, height = 28 }) => {
  if (!peaks?.length) {
    return <div className="clip-waveform clip-waveform--loading" style={{ height }} aria-hidden />;
  }
  const barW = 100 / peaks.length;
  return (
    <svg className="clip-waveform" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden>
      {peaks.map((peak, i) => {
        const h = Math.max(6, peak * 90);
        const played = (i + 1) / peaks.length <= progress;
        return (
          <rect
            key={i}
            x={i * barW}
            y={(100 - h) / 2}
            width={barW * 0.7}
            height={h}
            fill={played ? '#34d399' : '#64748b'}
            opacity={played ? 0.95 : 0.5}
            rx="0.5"
          />
        );
      })}
    </svg>
  );
};

export const ACTIONS = [
  { id: 'greeting_en', label: 'Greeting', lang: 'en', dynamic: true },
  { id: 'greeting_es', label: 'Greeting', lang: 'es', dynamic: true },
  { id: 'intake', label: 'Intake Qs', dynamic: false },
  { id: 'hold_policy', label: 'Hold Policy', dynamic: false },
  { id: 'hold_exc_en', label: 'Hold Exc', lang: 'en', dynamic: false },
  { id: 'hold_exc_es', label: 'Hold Exc', lang: 'es', dynamic: false },
  { id: 'sign_off', label: 'Sign Off', dynamic: false },
  { id: 'anyone', label: 'Anyone?', dynamic: false },
  { id: 'callout', label: 'Callout', dynamic: false },
  { id: 'closer_louder', label: 'Louder', dynamic: false },
  { id: 'limit_40_en', label: '40 Word Limit', lang: 'en', dynamic: false },
  { id: 'limit_40_es', label: '40 Word Limit', lang: 'es', dynamic: false },
];

const getSetupStats = (blobs) => {
  let saved = 0;
  let total = 0;
  ACTIONS.forEach((action) => {
    const c = getActionCompletion(action, blobs);
    saved += c.saved;
    total += c.total;
  });
  return { saved, total, missing: total - saved };
};

export const GreetingsPanel = ({ onEditModeChange, onExitStudio, micTestMode = false }) => {
  const {
    selectedSinkId,
    selectedMicId,
    outputDevices,
    inputDevices,
    localVolume,
    sinkVolume,
    changeLocalVolume,
    changeSinkVolume,
    monitorMic,
    setMonitorMic,
    monitorVolume,
    setMonitorVolume,
    setSinkPlaybackActive,
    sinkPlaybackActive,
    playClipToSink,
    stopClipToSink,
  } = useAudioSettings();
  const [mode, setMode] = useState('play'); // 'play' | 'settings'
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [blobs, setBlobs] = useState({});
  const [healthScores, setHealthScores] = useState(() => JSON.parse(localStorage.getItem('catint_audio_health')) || {});
  const [manualCallOk, setManualCallOkStore] = useState(() => loadManualCallOk());
  const [pendingRouteConfirm, setPendingRouteConfirm] = useState(null);
  const [lastRouteTest, setLastRouteTest] = useState(null);
  const [routeDebugOpen, setRouteDebugOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(null); // key of item being analyzed
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [routeLive, setRouteLive] = useState(false); // patient-path play (for LIVE banner)
  const [recordingKey, setRecordingKey] = useState(null);
  const [checkLang, setCheckLang] = useState('en');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // ponytail: gallery prefs — localStorage only, no settings schema
  const [showChrome, setShowChrome] = useState(() => {
    try { return localStorage.getItem('catint_sb_show_chrome') === '1'; } catch { return false; }
  });
  const [tileSize, setTileSize] = useState(() => {
    try {
      const n = parseInt(localStorage.getItem('catint_sb_tile_size'), 10);
      return Number.isFinite(n) ? Math.min(160, Math.max(64, n)) : 100;
    } catch { return 100; }
  });
  const localOnlyPlayback = isLocalOnlyPlayback(micTestMode);
  const sinkRawLabel = (outputDevices.find((d) => d.deviceId === selectedSinkId)?.label || '').trim();
  const sinkRouteDiag = diagnoseVbCableRoute({
    cableMode: !micTestMode,
    sttInputLabel: '',
    sinkLabel: sinkRawLabel,
    sinkId: selectedSinkId,
  });
  // ponytail: studio tip only cares about sink; STT in is handled by I/O strip
  const showSinkRouteTip =
    !micTestMode &&
    !localOnlyPlayback &&
    (!sinkRouteDiag.ok && sinkRouteDiag.code?.startsWith('sink_'));
  const [safetyNotice, setSafetyNotice] = useState('');
  const [waveforms, setWaveforms] = useState({});
  const [collapsedActions, setCollapsedActions] = useState(() => new Set());
  const [missingOnly, setMissingOnly] = useState(false);
  const [storageSummary, setStorageSummary] = useState(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [editingKey, setEditingKey] = useState(null);

  const audioRefSink = useRef(new Audio());
  const audioRefLocal = useRef(new Audio());
  const rampCancelRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationRef = useRef(null);
  const callerRouteRef = useRef(false);

  useEffect(() => {
    const updateTime = () => {
      const h = new Date().getHours();
      if (h < 12) setTimeOfDay('morning');
      else if (h < 17) setTimeOfDay('afternoon');
      else setTimeOfDay('evening');
    };
    updateTime();
    const intv = setInterval(updateTime, 60000);
    return () => clearInterval(intv);
  }, []);

  useEffect(() => {
    if (onEditModeChange) {
      onEditModeChange(mode === 'settings');
    }
  }, [mode, onEditModeChange]);

  const refreshStorageSummary = async () => {
    try {
      setStorageSummary(await getStorageSummary());
    } catch (e) {
      console.warn('Storage summary failed:', e);
    }
  };

  const reloadData = async () => {
    const state = {};
    for (const action of ACTIONS) {
       const thumb = await loadFile(`thumb_${action.id}`);
       if (thumb) {
           state[`thumb_${action.id}`] = thumb;
           state[`url_thumb_${action.id}`] = generateObjectUrl(thumb);
       }
       if (action.dynamic) {
          for (const t of TIME_SLOTS) {
            const b = await loadFile(`${action.id}_${t}`);
            if (b) {
               state[`${action.id}_${t}`] = b;
               state[`url_${action.id}_${t}`] = generateObjectUrl(b);
            }
          }
       } else {
          const b = await loadFile(action.id);
          if (b) {
             state[action.id] = b;
             state[`url_${action.id}`] = generateObjectUrl(b);
          }
       }
    }
    const bgApp = await loadFile('bg_app');
    if (bgApp) {
        state.bg_app = bgApp;
    }
    setBlobs(state);
    refreshStorageSummary();
  };

  const getExpectedStorageKeys = () => {
    const expected = new Set(['bg_app']);
    ACTIONS.forEach((action) => {
      expected.add(`thumb_${action.id}`);
      getActionClipKeys(action).forEach((k) => expected.add(k));
    });
    return expected;
  };

  const handleExportBackup = async () => {
    setStorageBusy(true);
    try {
      const payload = await exportStorageBackup();
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catintassist-soundboard-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed — see console');
      console.error(e);
    } finally {
      setStorageBusy(false);
    }
  };

  const handleImportBackup = async (file) => {
    if (!file) return;
    setStorageBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const count = await importStorageBackup(payload);
      await reloadData();
      alert(`Restored ${count} item(s) from backup.`);
    } catch (e) {
      alert('Import failed — invalid or corrupt backup file');
      console.error(e);
    } finally {
      setStorageBusy(false);
    }
  };

  useEffect(() => {
    reloadData();
    warnLegacyCallPathStorage();
    // Mount-only hydrate; reloadData is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    primePlaybackElements(audioRefLocal.current, audioRefSink.current);
    if (selectedSinkId) bindAudioToSink(audioRefSink.current, selectedSinkId);
  }, [selectedSinkId]);

  const sinkLabel = truncateDeviceLabel(
    outputDevices.find((d) => d.deviceId === selectedSinkId)?.label || (selectedSinkId ? 'Virtual out' : 'Default out'),
    18,
  );
  const micLabel = truncateDeviceLabel(
    inputDevices.find((d) => d.deviceId === selectedMicId)?.label || (selectedMicId ? 'Mic' : 'Default mic'),
    18,
  );

  const getRouteBadge = (clipKey) => {
    if (isManualCallOk(manualCallOk, clipKey, selectedSinkId, selectedMicId)) {
      return {
        className: 'sb-call-ok',
        label: 'CALL OK ✓',
        title: 'Remote side confirmed clean audio manually',
      };
    }
    const fp = buildRouteFingerprint(clipKey, selectedSinkId, selectedMicId);
    if (pendingRouteConfirm?.clipKey === clipKey && pendingRouteConfirm?.fingerprint === fp) {
      return {
        className: 'sb-sink-played',
        label: 'SINK PLAYED',
        title: 'Browser played into selected sink — confirm remote heard it cleanly',
      };
    }
    return null;
  };

  const confirmManualCallOk = () => {
    if (!pendingRouteConfirm) return;
    const { clipKey } = pendingRouteConfirm;
    setManualCallOkStore((prev) => setManualCallOk(prev, clipKey, selectedSinkId, selectedMicId));
    setPendingRouteConfirm(null);
    setLastRouteTest({ clipKey, result: 'manual_ok', at: Date.now() });
  };

  const declineManualCallOk = () => {
    if (!pendingRouteConfirm) return;
    const { clipKey } = pendingRouteConfirm;
    setPendingRouteConfirm(null);
    setLastRouteTest({ clipKey, result: 'declined', at: Date.now() });
  };

  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(blobs).filter(
      (k) => !k.startsWith('url_') && !k.startsWith('thumb_') && k !== 'bg_app' && blobs[k]?.size > 0
    );

    (async () => {
      const next = {};
      for (const key of keys) {
        if (cancelled) return;
        try {
          next[key] = await buildWaveformPeaks(blobs[key]);
        } catch (e) {
          console.warn('Waveform decode failed:', key, e);
        }
      }
      if (!cancelled) setWaveforms(next);
    })();

    return () => { cancelled = true; };
  }, [blobs]);

  // Sync volumes when sliders change
  useEffect(() => {
    // Sane limits to prevent 'screaming' audio: clip to 1.0 but ensure gain isn't excessive
    const safeLocal = Math.min(1, localVolume);
    const safeSink = Math.min(1, sinkVolume);
    audioRefLocal.current.volume = safeLocal;
    audioRefSink.current.volume = safeSink;
  }, [localVolume, sinkVolume]);

  const handleFileUpload = async (key, file) => {
    if (!file) return;
    await saveFile(key, file);
    if (key === 'bg_app') {
       window.dispatchEvent(new CustomEvent('cat_bg_changed'));
    }
    reloadData();
    // Auto-analyze newly recorded/uploaded greetings
    if (key !== 'bg_app' && !key.startsWith('thumb_')) {
      analyzeHealth(key);
    }
  };

  const analyzeHealth = async (key) => {
    const blob = await loadFile(key);
    if (!blob) return;

    const API_KEY =
      getRuntimeDeepgramKey() ||
      localStorage.getItem('DEEPGRAM_API_KEY') ||
      process.env.REACT_APP_DEEPGRAM_API_KEY;
    if (!API_KEY) return;

    setIsAnalyzing(key);
    try {
      const finalScore = await analyzeBlobHealth(blob, API_KEY);
      if (finalScore === null) return;
      setHealthScores((prev) => {
        const next = { ...prev, [key]: finalScore };
        localStorage.setItem('catint_audio_health', JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.warn('Health check failed:', e);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const getHealthMeta = (score) => formatHealthDisplay(score);

  const handleClear = async (key) => {
    await deleteFile(key);
    if (key === 'bg_app') {
      window.dispatchEvent(new CustomEvent('cat_bg_changed'));
    }
    setWaveforms((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    reloadData();
  };

  const startRecording = async (key) => {
    try {
      const constraints = selectedMicId
        ? { audio: { deviceId: { exact: selectedMicId } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Use higher bitrate and webm/opus for better reliability
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
      const mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        let avg = sum / dataArray.length;
        
        let width = Math.min(100, Math.max(0, (avg / 100) * 100));
        if (width < 2 && avg > 0) width = 2; // small indicator it's alive
        
        const bar = document.getElementById('record-vol-bar');
        if (bar) bar.style.width = width + '%';
        requestAnimationFrame(updateLevel);
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
        handleFileUpload(key, audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecordingKey(key);
      updateLevel();
    } catch (e) {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingKey(null);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(()=>{});
        audioCtxRef.current = null;
      }
    }
  };

  const trackProgress = () => {
    if (audioRefLocal.current && audioRefLocal.current.duration) {
      setPlaybackProgress(audioRefLocal.current.currentTime / audioRefLocal.current.duration);
      if (!localOnlyPlayback && playingKey && callerRouteRef.current) {
        window.__CAT_AUDIO_VOL = (40 + Math.random() * 60) * sinkVolume;
      } else {
        window.__CAT_AUDIO_VOL = 0;
      }
    } else {
      window.__CAT_AUDIO_VOL = 0;
    }
    animationRef.current = requestAnimationFrame(trackProgress);
  };

  const clearPlaybackState = () => {
    setPlayingKey(null);
    setPlaybackProgress(0);
    setRouteLive(false);
    window.__CAT_AUDIO_VOL = 0;
    stopClipToSink();
    setSinkPlaybackActive(false);
    audioRefSink.current.pause();
    audioRefLocal.current.pause();
    if (rampCancelRef.current) rampCancelRef.current();
    rampCancelRef.current = null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const openSettings = (focusKey = null) => {
    // Default: everything collapsed — expanding 15 sections at once was illegible
    const collapsed = new Set(ACTIONS.map((a) => a.id));
    if (focusKey && focusKey !== 'bg_app') {
      const action = ACTIONS.find((a) => getActionClipKeys(a).includes(focusKey));
      if (action) collapsed.delete(action.id);
    } else if (!focusKey) {
      const firstGap = ACTIONS.find((a) => getActionCompletion(a, blobs).saved < getActionCompletion(a, blobs).total);
      if (firstGap) collapsed.delete(firstGap.id);
    }
    setCollapsedActions(collapsed);
    setMissingOnly(false);
    setMode('settings');
    if (focusKey) {
      setTimeout(() => {
        const el = focusKey === 'bg_app'
          ? document.getElementById('settings-bg-app')
          : document.getElementById(`settings-row-${focusKey}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const toggleActionCollapsed = (actionId) => {
    setCollapsedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  };

  const jumpToFirstMissing = () => {
    for (const action of ACTIONS) {
      const { keys } = getActionCompletion(action, blobs);
      const missingKey = keys.find((k) => !blobs[k]);
      if (missingKey) {
        openSettings(missingKey);
        return;
      }
    }
  };

  const playAudioBlock = async (key, routeToVirtualMic, opts = {}) => {
    const { bypassGate = false, callerOnly = false } = opts;

    if (playingKey === key) {
      audioRefSink.current.pause();
      audioRefLocal.current.pause();
      clearPlaybackState();
      return;
    }

    if (playingKey) {
      audioRefSink.current.pause();
      audioRefLocal.current.pause();
      clearPlaybackState();
    }

    const blob = blobs[key];
    if (!blob) {
      openSettings(key);
      return;
    }

    let sendToCaller = routeToVirtualMic && !localOnlyPlayback;
    if (sendToCaller && !bypassGate) {
      const score = healthScores[key];
      const healthOk = isCallerReady(score);
      const callOk = isCallPathReady(manualCallOk, key, selectedSinkId, selectedMicId);
      if (!healthOk || !callOk) {
        setSafetyNotice(
          !healthOk
            ? (score === undefined
              ? '⛔ Untested clip — health check in Setup first'
              : '⛔ Health gate — virtual mic blocked; local preview only')
            : '📡 Run Call Test and confirm CALL OK before firing to patient path'
        );
        window.setTimeout(() => setSafetyNotice(''), 4500);
        sendToCaller = false;
      }
    }

    let playLocal = !callerOnly;
    let playSink = sendToCaller;
    callerRouteRef.current = playSink;
    setRouteLive(!!playSink);
    const routeMode = readRouteModePreference();
    const usePassthrough = playSink && routeMode === ROUTE_MODE.PASSTHROUGH;

    logRouteEvent(ROUTE_EVENT.PLAY_START, {
      clipKey: key,
      routeMode: usePassthrough ? ROUTE_MODE.PASSTHROUGH : ROUTE_MODE.DUAL_ELEMENT,
      playSink,
      testMode: localOnlyPlayback,
      micTestMode,
    });
    const sttRisk = assessSttLoadRisk({
      sttActive: undefined,
      routeMode: usePassthrough ? ROUTE_MODE.PASSTHROUGH : ROUTE_MODE.DUAL_ELEMENT,
      sinkBound: !!selectedSinkId,
    });
    if (sttRisk.risky) {
      logRouteEvent(ROUTE_EVENT.STT_LOAD_WARN, { clipKey: key, reason: sttRisk.reason });
    }

    const url = blobs[`url_${key}`] || generateObjectUrl(blob);
    primePlaybackElements(audioRefLocal.current, audioRefSink.current);

    if (playSink && selectedSinkId && !usePassthrough) {
      const bound = await bindAudioToSink(audioRefSink.current, selectedSinkId);
      logRouteEvent(ROUTE_EVENT.SINK_BIND, { clipKey: key, ok: bound, routeMode: ROUTE_MODE.DUAL_ELEMENT });
      if (!bound) {
        if (callerOnly) {
          setLastRouteTest({ clipKey: key, result: 'fail', at: Date.now() });
          setSafetyNotice('⚠️ Virtual mic route failed — pick VB-Cable in header Speaker');
          window.setTimeout(() => setSafetyNotice(''), 4500);
          return;
        }
        playSink = false;
        callerRouteRef.current = false;
        setRouteLive(false);
        setSafetyNotice('⚠️ Virtual mic route failed — local only');
        window.setTimeout(() => setSafetyNotice(''), 4500);
      }
    }

    if (playLocal) {
      audioRefLocal.current.src = url;
    }
    if (playSink && !usePassthrough) {
      audioRefSink.current.src = url;
    }

    const wasCallTest = callerOnly;
    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      clearPlaybackState();
      logRouteEvent(ROUTE_EVENT.PLAY_END, { clipKey: key });
      if (wasCallTest && playSink) {
        const fingerprint = buildRouteFingerprint(key, selectedSinkId, selectedMicId);
        setPendingRouteConfirm({ clipKey: key, fingerprint, playedAt: Date.now() });
        setLastRouteTest({ clipKey: key, result: 'sink_played', at: Date.now() });
      }
    };
    audioRefLocal.current.onended = onEnd;
    audioRefSink.current.onended = onEnd;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(trackProgress);

    if (playSink && !usePassthrough) setSinkPlaybackActive(true);
    setPlayingKey(key);

    try {
      const plays = [];
      if (playLocal) plays.push(audioRefLocal.current.play());

      if (playSink && usePassthrough) {
        plays.push(
          playClipToSink(blob, sinkVolume, {
            clipKey: key,
            onProgress: (p) => {
              if (!playLocal) setPlaybackProgress(p);
            },
          }).then(async (pt) => {
            if (!pt.ok) {
              logRouteEvent(ROUTE_EVENT.FALLBACK_DUAL, { clipKey: key, reason: pt.reason });
              const bound = await bindAudioToSink(audioRefSink.current, selectedSinkId);
              logRouteEvent(ROUTE_EVENT.SINK_BIND, { clipKey: key, ok: bound, routeMode: ROUTE_MODE.DUAL_ELEMENT });
              if (bound) {
                audioRefSink.current.src = url;
                setSinkPlaybackActive(true);
                await audioRefSink.current.play();
                if (rampCancelRef.current) rampCancelRef.current();
                rampCancelRef.current = rampVolume(null, audioRefSink.current, 0, sinkVolume);
              } else {
                setSafetyNotice('⚠️ Passthrough + dual route failed — local only');
                window.setTimeout(() => setSafetyNotice(''), 4500);
              }
            } else if (!playLocal) {
              onEnd();
            }
          }),
        );
      } else if (playSink) {
        plays.push(audioRefSink.current.play());
      }

      if (!plays.length && playLocal) plays.push(audioRefLocal.current.play());
      await Promise.all(plays);

      if (playSink && !usePassthrough) {
        if (rampCancelRef.current) rampCancelRef.current();
        rampCancelRef.current = rampVolume(
          playLocal ? audioRefLocal.current : null,
          playSink ? audioRefSink.current : null,
          playLocal ? localVolume : 0,
          playSink ? sinkVolume : 0,
        );
      } else if (playLocal) {
        if (rampCancelRef.current) rampCancelRef.current();
        rampCancelRef.current = rampVolume(audioRefLocal.current, null, localVolume, 0);
      }
    } catch (e) {
      console.error('Playback error:', e);
      logRouteEvent(ROUTE_EVENT.PLAY_FAIL, { clipKey: key, reason: e?.message });
      if (wasCallTest) {
        setLastRouteTest({ clipKey: key, result: 'fail', at: Date.now() });
      }
      clearPlaybackState();
    }
  };

  const renderClipCard = (key, label, compact = false) => {
    const hasBlob = !!blobs[key];
    const health = getHealthMeta(healthScores[key]);
    const routeBadge = getRouteBadge(key);
    return (
      <div
        key={key}
        id={`settings-row-${key}`}
        className={`sb-clip-card ${hasBlob ? 'is-saved' : 'is-missing'}`}
      >
        <div className="sb-clip-top">
          <span className="sb-clip-label">{label}</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }}>
            {isAnalyzing === key ? (
              <span className="sb-clip-status sb-clip-status--test" style={{ animation: 'pulseGlow 2s infinite' }}>…</span>
            ) : hasBlob ? (
              <div className="sb-health-pill" onClick={() => analyzeHealth(key)} title="Click to re-run health check">
                <span style={{ color: health?.color || '#94a3b8' }}>{health?.label || 'UNTESTED'}</span>
                <div className="sb-health-pill-bar">
                  <div className="sb-health-pill-fill" style={{ width: health?.width || '0%', backgroundColor: health?.color || '#94a3b8' }} />
                </div>
              </div>
            ) : null}
            <span className={`sb-clip-status ${hasBlob ? 'sb-clip-status--saved' : 'sb-clip-status--missing'}`}>
              {hasBlob ? 'SAVED' : 'MISSING'}
            </span>
            {routeBadge && (
              <span className={routeBadge.className} title={routeBadge.title}>
                {routeBadge.label}
              </span>
            )}
          </div>
        </div>

        {hasBlob && (
          <ClipWaveform peaks={waveforms[key]} progress={playingKey === key ? playbackProgress : 0} height={compact ? 22 : 28} />
        )}

        <div className="sb-clip-actions">
          {recordingKey === key ? (
            <button type="button" className="sb-btn sb-btn--stop" onClick={stopRecording}>⏹ Stop</button>
          ) : (
            <button type="button" className="sb-btn sb-btn--record" onClick={() => startRecording(key)} disabled={recordingKey !== null}>🎙 Record</button>
          )}
          {hasBlob && (
            <>
              <button type="button" className="sb-btn sb-btn--preview" onClick={() => playAudioBlock(key, false)} title="Hear on your speakers only">
                {playingKey === key ? '⏹' : '🔊 You'}
              </button>
              <button
                type="button"
                className="sb-btn sb-btn--call"
                onClick={() => playAudioBlock(key, true, { bypassGate: true, callerOnly: true })}
                disabled={!selectedSinkId}
                title={selectedSinkId ? 'Send through VB-Cable — confirm CALL OK on remote side' : 'Pick VB-Cable in header Speaker first'}
              >
                📡 Caller
              </button>
              <button
                type="button"
                className="sb-btn sb-btn--edit"
                onClick={() => setEditingKey(key)}
                title="Edit waveform — crop, re-record, remove silences"
              >
                ✏️
              </button>
            </>
          )}
        </div>

        {recordingKey === key && (
          <div className="sb-record-meter">
            <div id="record-vol-bar" className="sb-record-meter-fill" style={{ width: '0%' }} />
          </div>
        )}

        <div className="sb-clip-footer">
          <label className="sb-audio-btn">
            Upload audio
            <input type="file" accept="audio/*" hidden onChange={(e) => { handleFileUpload(key, e.target.files[0]); e.target.value = ''; }} />
          </label>
          {hasBlob && (
            <button type="button" className="sb-delete-btn" onClick={() => handleClear(key)}>Delete</button>
          )}
        </div>
      </div>
    );
  };

  const editorOverlay = editingKey && blobs[editingKey] ? (
    <div className="sb-editor-overlay" role="dialog" aria-label={`Edit ${editingKey}`}>
      <div className="sb-editor-modal glass-panel">
        <div className="sb-editor-modal-head">
          <strong>Edit clip — {editingKey}</strong>
          <button type="button" className="sb-filter-chip" onClick={() => setEditingKey(null)}>✕ Close</button>
        </div>
        <AudioEditorPanel
          key={editingKey}
          blob={blobs[editingKey]}
          label={editingKey}
          localVolume={localVolume}
          onSave={async (editedBlob) => {
            await handleFileUpload(editingKey, editedBlob);
            setEditingKey(null);
          }}
          onDelete={() => {
            handleClear(editingKey);
            setEditingKey(null);
          }}
          onClose={() => setEditingKey(null)}
        />
      </div>
    </div>
  ) : null;

  if (mode === 'settings') {
    const stats = getSetupStats(blobs);
    const pct = stats.total ? Math.round((stats.saved / stats.total) * 100) : 0;

    return (
      <div className="sb-setup glass-panel" style={{ border: 'none' }}>
        {editorOverlay}
        {pendingRouteConfirm && mode === 'settings' && (
          <div className="sb-route-confirm">
            <span>Did remote side hear it cleanly? ({pendingRouteConfirm.clipKey})</span>
            <div className="sb-route-confirm-actions">
              <button type="button" className="sb-btn sb-btn--call" onClick={confirmManualCallOk}>
                Yes, mark CALL OK
              </button>
              <button type="button" className="sb-filter-chip" onClick={declineManualCallOk}>
                No
              </button>
            </div>
          </div>
        )}
        <div className="sb-setup-head">
          <span className="sb-setup-title">⚙️ Setup Soundboard</span>
          <div className="sb-setup-actions">
            <div className="sb-setup-progress" title={`${stats.saved} of ${stats.total} clips saved`}>
              <span>{stats.saved}/{stats.total} clips</span>
              <div className="sb-setup-progress-bar">
                <div className="sb-setup-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {stats.missing > 0 && (
              <button type="button" className="sb-filter-chip" onClick={jumpToFirstMissing}>
                ↓ Next missing
              </button>
            )}
            <button
              type="button"
              className={`sb-filter-chip ${missingOnly ? 'is-on' : ''}`}
              onClick={() => setMissingOnly((v) => !v)}
            >
              {missingOnly ? 'Showing gaps' : 'Missing only'}
            </button>
            <button type="button" className="sb-btn sb-btn--call" onClick={() => setMode('play')}>
              Save & Play
            </button>
            {onExitStudio && (
              <button type="button" className="soundboard-hide-btn" onClick={onExitStudio}>
                ← Scoreboard
              </button>
            )}
          </div>
        </div>

        <div id="settings-bg-app" className="sb-global-card sb-thumb-zone">
          <strong className="sb-zone-label">🖼️ Image only — app background</strong>
          <p className="sb-zone-hint">
            Not a soundboard clip. Does not play on calls.
            {!blobs.bg_app && ' Until you upload, stock photos from /bg rotate each visit.'}
          </p>
          <div className="sb-thumb-row">
            <label className="sb-img-btn">
              Choose image
              <input type="file" accept="image/*" hidden onChange={(e) => { handleFileUpload('bg_app', e.target.files[0]); e.target.value = ''; }} />
            </label>
            {blobs.bg_app && <button type="button" className="sb-delete-btn" style={{ marginLeft: 0 }} onClick={() => handleClear('bg_app')}>Clear</button>}
          </div>
        </div>

        {ACTIONS.map((action) => {
          const completion = getActionCompletion(action, blobs);
          const isComplete = completion.saved === completion.total;
          if (missingOnly && isComplete) return null;

          const isCollapsed = collapsedActions.has(action.id);
          const slotPills = getActionSlotPills(action, blobs);
          const clipSlots = action.dynamic
            ? TIME_SLOTS.map((t) => ({ key: `${action.id}_${t}`, label: `${TIME_SLOT_META[t].icon} ${TIME_SLOT_META[t].name}` }))
            : [{ key: action.id, label: '🔈 Clip' }];

          const visibleSlots = missingOnly
            ? clipSlots.filter((s) => !blobs[s.key])
            : clipSlots;
          if (missingOnly && !visibleSlots.length) return null;

          return (
            <div key={action.id} className={`sb-action-card ${isComplete ? 'is-complete' : 'is-incomplete'}`}>
              <button type="button" className="sb-action-head" onClick={() => toggleActionCollapsed(action.id)}>
                <span className="sb-action-chevron">{isCollapsed ? '▸' : '▾'}</span>
                <div className="sb-action-head-main">
                  <span className="sb-action-name">{action.label}</span>
                  {slotPills && (
                    <span className="sb-slot-pills">
                      {slotPills.map((p) => (
                        <span key={p.key} className={`sb-slot-pill ${p.has ? 'is-saved' : 'is-missing'}`}>
                          {p.icon} {p.name}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                {action.lang && (
                  <span className={`sb-lang-badge sb-lang-badge--${action.lang}`}>{action.lang.toUpperCase()}</span>
                )}
                <span className={`sb-action-count ${isComplete ? 'sb-action-count--ok' : 'sb-action-count--warn'}`}>
                  {completion.saved}/{completion.total}
                </span>
              </button>

              {!isCollapsed && (
                <div className="sb-action-body">
                  <div className="sb-thumb-zone">
                    <strong className="sb-zone-label">🖼️ Button cover image</strong>
                    <p className="sb-zone-hint">Visual only — never plays audio.</p>
                    <div className="sb-thumb-row">
                      {blobs[`url_thumb_${action.id}`] && (
                        <div className="sb-thumb-preview" style={{ backgroundImage: `url(${blobs[`url_thumb_${action.id}`]})` }} aria-hidden />
                      )}
                      <label className="sb-img-btn">
                        {blobs[`thumb_${action.id}`] ? 'Replace image' : 'Add cover image'}
                        <input type="file" accept="image/*" hidden onChange={(e) => { handleFileUpload(`thumb_${action.id}`, e.target.files[0]); e.target.value = ''; }} />
                      </label>
                      {blobs[`thumb_${action.id}`] && (
                        <button type="button" className="sb-delete-btn" style={{ marginLeft: 0 }} onClick={() => handleClear(`thumb_${action.id}`)}>Remove image</button>
                      )}
                    </div>
                  </div>

                  <div className="sb-audio-zone">
                    <strong className="sb-zone-label">🎙️ Audio clips</strong>
                    <p className="sb-zone-hint">Record or upload — these fire on the soundboard.</p>
                    {action.dynamic ? (
                      <div className="sb-time-grid">
                        {visibleSlots.map((slot) => renderClipCard(slot.key, slot.label, true))}
                      </div>
                    ) : (
                      visibleSlots.map((slot) => renderClipCard(slot.key, slot.label))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="sb-storage-panel">
          <strong className="sb-zone-label">💾 Clip storage (IndexedDB)</strong>
          <p className="sb-zone-hint">
            Clips live in <em>this browser</em> at <code>{storageSummary?.origin || window.location.origin}</code>.
            {' '}Changing URL (localhost vs 127.0.0.1) or clearing site data looks like &quot;everything gone&quot; — check backup below.
          </p>
          {storageSummary && (
            <p className="sb-storage-stat">
              {storageSummary.keyCount} key(s) in DB · {Math.round(storageSummary.bytes / 1024)} KB
              {storageSummary.keyCount > 0 && getSetupStats(blobs).saved === 0 && (
                <span className="sb-storage-warn"> — keys exist but app did not map them; try Import or check orphan list</span>
              )}
            </p>
          )}
          {storageSummary?.keys?.length > 0 && (() => {
            const expected = getExpectedStorageKeys();
            const orphans = storageSummary.keys.filter((k) => !expected.has(k));
            if (!orphans.length) return null;
            return (
              <p className="sb-storage-orphans">
                Orphan keys in DB: {orphans.join(', ')}
              </p>
            );
          })()}
          <div className="sb-thumb-row">
            <button type="button" className="sb-audio-btn" disabled={storageBusy} onClick={handleExportBackup}>Export backup</button>
            <label className="sb-audio-btn">
              Import backup
              <input type="file" accept="application/json,.json" hidden disabled={storageBusy} onChange={(e) => { handleImportBackup(e.target.files[0]); e.target.value = ''; }} />
            </label>
            <button type="button" className="sb-filter-chip" disabled={storageBusy} onClick={refreshStorageSummary}>Refresh scan</button>
          </div>
        </div>
      </div>
    );
  }

  const playStats = getSetupStats(blobs);
  const checkKey = `greeting_${checkLang}_${timeOfDay}`;
  const checkHasClip = !!blobs[checkKey];
  const checkCallOk = isCallPathReady(manualCallOk, checkKey, selectedSinkId, selectedMicId);
  const checkAwaiting = pendingRouteConfirm?.clipKey === checkKey;
  const preflight = getPreflightSteps({
    hasClip: checkHasClip,
    healthScore: healthScores[checkKey],
    callPathOk: checkCallOk,
    awaitingConfirm: checkAwaiting,
  });
  const preflightReady = isPreflightReady(preflight);
  const checkHealth = getHealthMeta(healthScores[checkKey]);

  const preflightDot = (state) => {
    if (state === 'ok') return 'sb-pf-dot sb-pf-dot--ok';
    if (state === 'fail') return 'sb-pf-dot sb-pf-dot--fail';
    if (state === 'confirm') return 'sb-pf-dot sb-pf-dot--confirm';
    if (state === 'missing') return 'sb-pf-dot sb-pf-dot--missing';
    return 'sb-pf-dot sb-pf-dot--pending';
  };

  const playingAction = playingKey
    ? ACTIONS.find((a) => playingKey === a.id || playingKey.startsWith(`${a.id}_`))
    : null;
  const playingToPatient = !!(playingKey && routeLive);

  return (
    <div className={`sb-play-wrap${showChrome ? ' sb-show-chrome' : ''}`} style={{ '--sb-tile-size': `${tileSize}px` }}>
      {editorOverlay}
      {safetyNotice && (
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '6px', padding: '0.35rem 0.5rem' }}>
          {safetyNotice}
        </div>
      )}

      {playingKey && (
        <div className={`sb-now-playing${playingToPatient ? ' is-live' : ' is-local'}`} role="status">
          <span className="sb-now-playing-pulse" aria-hidden />
          <span className="sb-now-playing-label">
            {playingToPatient ? '▶ LIVE to patient' : '▶ Playing (local)'}
            {playingAction ? ` · ${playingAction.label}` : ''}
          </span>
          <div className="sb-now-playing-bar">
            <div className="sb-now-playing-fill" style={{ width: `${playbackProgress * 100}%` }} />
          </div>
          <button type="button" className="sb-now-playing-stop" onClick={() => playAudioBlock(playingKey, false)} title="Stop">
            ⏹
          </button>
        </div>
      )}

      <div className="sb-play-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span className={`sb-play-title ${localOnlyPlayback ? 'is-test' : ''}`}>
            Soundboard · {timeOfDay}
            {preflightReady && !micTestMode && <span className="sb-ready-pill">CALL READY</span>}
          </span>
          {micTestMode && (
            <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 700 }}>
              🎤 Mic mode — speakers only (quality check)
            </span>
          )}
          {!micTestMode && (
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Tap tiles = your speakers · finish checklist to arm patient path
            </span>
          )}
          {playStats.missing > 0 && (
            <span style={{ fontSize: '0.62rem', color: '#f87171', fontWeight: 600 }}>{playStats.missing} clip{playStats.missing !== 1 ? 's' : ''} missing — ⚙️ Setup</span>
          )}
        </div>

        <div className="sb-play-head-controls">
          <label className="sb-gallery-ctrl" title="Tile size">
            <span>Size</span>
            <input
              type="range"
              min="64"
              max="160"
              step="8"
              value={tileSize}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setTileSize(n);
                try { localStorage.setItem('catint_sb_tile_size', String(n)); } catch { /* ignore */ }
              }}
            />
          </label>
          <label className="sb-gallery-ctrl" title="Show labels on all tiles">
            <input
              type="checkbox"
              checked={showChrome}
              onChange={(e) => {
                const on = e.target.checked;
                setShowChrome(on);
                try { localStorage.setItem('catint_sb_show_chrome', on ? '1' : '0'); } catch { /* ignore */ }
              }}
            />
            Labels
          </label>
          <button type="button" className="sb-open-setup-btn" onClick={() => openSettings('bg_app')} title="App background image">
            🖼️
          </button>
          <button type="button" className="sb-open-setup-btn" onClick={openSettings} title="Record / upload clips">
            ⚙️ Setup
          </button>
          {onExitStudio && (
            <button type="button" className="soundboard-hide-btn" onClick={onExitStudio} title="Back to scoreboard (Escape)">
              ← Scoreboard
            </button>
          )}
        </div>
      </div>

      {micTestMode && (
        <div className="sb-preflight sb-preflight--mic">
          <span className="sb-preflight-sub">Tap tiles — your speakers only. ⚙️ Setup for health check.</span>
          <label className="sb-pf-vol" title="Speaker volume">
            <span>🔊</span>
            <input type="range" min="0" max="1" step="0.05" value={localVolume} onChange={(e) => changeLocalVolume(parseFloat(e.target.value))} />
          </label>
        </div>
      )}

      {!micTestMode && (
        <div className="sb-preflight" id="sb-preflight-check" data-guide="greeting-preflight">
          <div className="sb-preflight-head">
            <strong>Will callers hear it?</strong>
            <span className="sb-preflight-sub">3 steps — same order every time</span>
          </div>

          <div className="sb-preflight-pick">
            <span>Clip:</span>
            <button type="button" className={`sb-pf-lang${checkLang === 'en' ? ' is-on' : ''}`} onClick={() => setCheckLang('en')}>EN</button>
            <button type="button" className={`sb-pf-lang${checkLang === 'es' ? ' is-on' : ''}`} onClick={() => setCheckLang('es')}>ES</button>
            <span className="sb-preflight-slot">{TIME_SLOT_META[timeOfDay].icon} {TIME_SLOT_META[timeOfDay].name}</span>
            {!checkHasClip && (
              <button type="button" className="sb-filter-chip" onClick={() => openSettings(checkKey)}>Add clip</button>
            )}
          </div>

          <div className="sb-preflight-steps">
            <div className={`sb-pf-step${preflight.quality === 'ok' ? ' is-done' : ''}${preflight.quality === 'fail' ? ' is-fail' : ''}`}>
              <span className={preflightDot(preflight.quality)} aria-hidden />
              <div className="sb-pf-step-body">
                <span className="sb-pf-step-title">1 · Clip quality</span>
                <span className="sb-pf-step-hint">
                  {checkHasClip
                    ? (checkHealth?.label || 'Not checked — Deepgram scores legibility')
                    : 'Record this greeting in Setup first'}
                </span>
              </div>
              <button
                type="button"
                className="sb-pf-btn"
                disabled={!checkHasClip || isAnalyzing === checkKey}
                onClick={() => analyzeHealth(checkKey)}
              >
                {isAnalyzing === checkKey ? '…' : checkHealth ? 'Re-check' : 'Check'}
              </button>
            </div>

            <div className={`sb-pf-step${playingKey === checkKey && !routeLive ? ' is-active' : ''}`}>
              <span className={preflightDot(preflight.quality === 'ok' ? 'ok' : 'pending')} aria-hidden />
              <div className="sb-pf-step-body">
                <span className="sb-pf-step-title">2 · You hear it</span>
                <span className="sb-pf-step-hint">Your speakers — not the patient path</span>
              </div>
              <button
                type="button"
                className="sb-pf-btn sb-pf-btn--you"
                disabled={!checkHasClip}
                onClick={() => playAudioBlock(checkKey, false)}
              >
                {playingKey === checkKey && !routeLive ? '⏹ Stop' : '🔊 Hear'}
              </button>
            </div>

            <div className={`sb-pf-step${preflight.caller === 'ok' ? ' is-done' : ''}${preflight.caller === 'confirm' ? ' is-active' : ''}`}>
              <span className={preflightDot(preflight.caller)} aria-hidden />
              <div className="sb-pf-step-body">
                <span className="sb-pf-step-title">3 · Caller hears it</span>
                <span className="sb-pf-step-hint">
                  {preflight.caller === 'ok'
                    ? 'CALL OK ✓ — tiles fire to patient path'
                    : `VB out → ${sinkLabel}${showSinkRouteTip ? ' · fix routing in header' : ''}`}
                </span>
              </div>
              <div className="sb-pf-step-actions">
                <button
                  type="button"
                  className="sb-pf-btn sb-pf-btn--caller"
                  disabled={!checkHasClip || !selectedSinkId || preflight.quality === 'fail'}
                  onClick={() => playAudioBlock(checkKey, true, { bypassGate: true, callerOnly: true })}
                  title={selectedSinkId ? 'Same path as on-call greetings' : 'Pick CABLE Input in header 🔊'}
                >
                  {playingKey === checkKey && routeLive ? '⏹ Stop' : '📡 Send'}
                </button>
                {preflight.caller === 'confirm' && (
                  <>
                    <button type="button" className="sb-pf-btn sb-pf-btn--ok" onClick={confirmManualCallOk}>CALL OK</button>
                    <button type="button" className="sb-pf-btn" onClick={declineManualCallOk}>No</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {showSinkRouteTip && (
            <div className="sb-route-tip" role="status">
              <strong>Routing:</strong> {sinkRouteDiag.tip}
            </div>
          )}

          <div className="sb-preflight-foot">
            <label className="sb-pf-vol" title="Speaker volume for step 2">
              <span>🔊 You</span>
              <input type="range" min="0" max="1" step="0.05" value={localVolume} onChange={(e) => changeLocalVolume(parseFloat(e.target.value))} />
            </label>
            <label className="sb-pf-vol" title="Patient-path volume for step 3">
              <span>📡 Caller</span>
              <input type="range" min="0" max="1" step="0.05" value={sinkVolume} onChange={(e) => changeSinkVolume(parseFloat(e.target.value))} />
            </label>
            <button
              type="button"
              className="sb-pf-btn sb-pf-btn--ghost"
              disabled={!selectedSinkId}
              onClick={() => playTestToneSink(selectedSinkId, sinkVolume).catch(() => {
                setSafetyNotice('⚠️ VB beep failed — check 🔊 in header');
                window.setTimeout(() => setSafetyNotice(''), 4500);
              })}
              title="Short beep through VB-Cable (no clip needed)"
            >
              Beep cable
            </button>
            <button type="button" className="sb-pf-btn sb-pf-btn--ghost" onClick={() => setAdvancedOpen((v) => !v)}>
              {advancedOpen ? 'Less ▴' : 'More ▾'}
            </button>
          </div>
        </div>
      )}

      {advancedOpen && (
        <div className="sb-advanced">
          <div className="sb-vol-row">
            <ElementHintTarget
              elementId="sb-mic-monitor-btn"
              icon="👂"
              heading="Mic Monitor"
              body="Hear your live mic on speakers (record path check). Not for greeting playback."
              color="#f59e0b"
            >
              <button
                id="sb-mic-monitor-btn"
                type="button"
                onClick={() => setMonitorMic((m) => !m)}
                className={`sb-pf-monitor${monitorMic ? ' is-on' : ''}`}
              >
                {monitorMic ? '🔴 Mic Monitor ON' : '👂 Mic Monitor'}
              </button>
            </ElementHintTarget>
            {monitorMic && (
              <input type="range" min="0" max="1" step="0.05" value={monitorVolume}
                onChange={(e) => setMonitorVolume(parseFloat(e.target.value))}
                style={{ width: '60px', accentColor: '#f59e0b' }} title="Monitor Volume" />
            )}
          </div>
          <div className="sb-route-debug">
            <button
              type="button"
              className="sb-route-debug-toggle"
              onClick={() => setRouteDebugOpen((v) => !v)}
              aria-expanded={routeDebugOpen}
            >
              {routeDebugOpen ? '▾' : '▸'} Route debug
            </button>
            {routeDebugOpen && (
              <div className="sb-route-debug-body">
                <div>Route mode: {readRouteModePreference()}</div>
                <div>STT active: {typeof window !== 'undefined' && window.__CAT_STT_ACTIVE ? 'YES' : 'no'}</div>
                <div>Sink: {sinkLabel}</div>
                <div>Mic: {micLabel}</div>
                <div>Mic mode: {micTestMode ? 'ON' : 'OFF'}</div>
                <div>Passthrough: {sinkPlaybackActive ? 'MUTED/CLIP' : 'OPEN'}</div>
                <div>
                  Last route test:{' '}
                  {lastRouteTest
                    ? `${ROUTE_TEST_LABELS[lastRouteTest.result] || lastRouteTest.result} (${lastRouteTest.clipKey})`
                    : '—'}
                </div>
                <div className="sb-route-diag-log" style={{ marginTop: '0.35rem', fontSize: '0.65rem', opacity: 0.85, maxHeight: '72px', overflow: 'auto' }}>
                  {getRouteDiagnostics().slice(0, 6).map((e, i) => (
                    <div key={i}>{formatRouteDiagLine(e)}</div>
                  ))}
                  {!getRouteDiagnostics().length && <div>— no route events yet —</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="sb-grid sb-grid--gallery">
        {ACTIONS.map((action) => {
          const activeKey = action.dynamic ? `${action.id}_${timeOfDay}` : action.id;
          const hasAudio = !!blobs[activeKey];
          const callReady = !micTestMode
            && isCallerReady(healthScores[activeKey])
            && isCallPathReady(manualCallOk, activeKey, selectedSinkId, selectedMicId);
          const callerBlocked = hasAudio && !callReady && !micTestMode;
          const hasThumb = !!blobs[`url_thumb_${action.id}`];
          const bgImage = hasThumb ? `url(${blobs[`url_thumb_${action.id}`]})` : undefined;
          const isItPlaying = playingKey === activeKey;
          const otherSlotsSaved = action.dynamic
            ? TIME_SLOTS.filter((t) => t !== timeOfDay && blobs[`${action.id}_${t}`]).map((t) => TIME_SLOT_META[t].short)
            : [];

          if (!hasAudio) {
            return (
              <div key={action.id} className={`sb-slot sb-slot--empty ${action.lang ? `sb-slot--${action.lang}` : ''}`}>
                {action.lang && <span className={`sb-lang-badge sb-lang-badge--${action.lang}`}>{action.lang.toUpperCase()}</span>}
                <span className="sb-slot-name">{action.label}</span>
                <span className="sb-slot-empty-label">No {timeOfDay} clip</span>
                {otherSlotsSaved.length > 0 && (
                  <span className="sb-slot-other-hint">Saved: {otherSlotsSaved.join(', ')} — add {timeOfDay} in Setup</span>
                )}
                <button type="button" className="sb-slot-setup-btn" onClick={() => openSettings(activeKey)}>
                  🎙 Add audio in Setup
                </button>
              </div>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              className={`sb-slot sb-slot--ready${hasThumb ? ' has-thumb' : ''}${isItPlaying ? ' is-playing' : ''}${callerBlocked ? ' is-blocked' : ''}${action.lang ? ` sb-slot--${action.lang}` : ''}`}
              onClick={() => playAudioBlock(activeKey, callReady, { bypassGate: false })}
              style={bgImage ? { backgroundImage: bgImage } : undefined}
              title={
                micTestMode
                  ? `${action.label} — your speakers`
                  : callerBlocked
                    ? 'Local preview — finish checklist above to arm patient path'
                    : `${action.label} — fires to patient path`
              }
            >
              <div className="sb-slot-overlay" />
              {action.lang && <span className={`sb-lang-badge sb-lang-badge--${action.lang}`}>{action.lang.toUpperCase()}</span>}
              {isItPlaying && <div className="sb-slot-progress" style={{ width: `${playbackProgress * 100}%` }} />}
              {isItPlaying && <span className="sb-slot-live-badge">{playingToPatient ? 'LIVE' : '▶'}</span>}
              <span className="sb-slot-chrome">
                <span className="sb-slot-label">
                  {isItPlaying ? '⏹ STOP' : action.label}
                  {healthScores[activeKey] !== undefined && (
                    <span className="sb-slot-health" style={{ color: getHealthMeta(healthScores[activeKey])?.color }}>
                      {getHealthMeta(healthScores[activeKey])?.label}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
