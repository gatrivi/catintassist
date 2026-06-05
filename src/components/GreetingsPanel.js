import React, { useState, useEffect, useRef } from 'react';
import { saveFile, loadFile, deleteFile, generateObjectUrl } from '../utils/storage';
import { useAudioSettings } from '../contexts/AudioSettingsContext';

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
const TIME_SLOT_META = {
  morning: { icon: '☀️', short: 'AM' },
  afternoon: { icon: '🌤', short: 'PM' },
  evening: { icon: '🌙', short: 'Eve' },
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

export const GreetingsPanel = ({ onEditModeChange }) => {
  const { selectedSinkId, localVolume, sinkVolume, changeLocalVolume, changeSinkVolume, monitorMic, setMonitorMic, monitorVolume, setMonitorVolume } = useAudioSettings();
  const [mode, setMode] = useState('play'); // 'play' | 'settings'
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [blobs, setBlobs] = useState({});
  const [healthScores, setHealthScores] = useState(() => JSON.parse(localStorage.getItem('catint_audio_health')) || {});
  const [isAnalyzing, setIsAnalyzing] = useState(null); // key of item being analyzed
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [recordingKey, setRecordingKey] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [safetyNotice, setSafetyNotice] = useState('');
  const [waveforms, setWaveforms] = useState({});
  const [collapsedActions, setCollapsedActions] = useState(() => new Set());
  const [missingOnly, setMissingOnly] = useState(false);

  const audioRefSink = useRef(new Audio());
  const audioRefLocal = useRef(new Audio());
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
  };

  useEffect(() => {
    reloadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(blobs).filter(
      (k) => !k.startsWith('url_') && !k.startsWith('thumb_') && k !== 'bg_app' && blobs[k] instanceof Blob
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
    
    const API_KEY = localStorage.getItem('DEEPGRAM_API_KEY');
    if (!API_KEY) return;

    setIsAnalyzing(key);
    try {
      const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${API_KEY}`,
          'Content-Type': blob.type || 'audio/webm'
        },
        body: blob
      });
      
      if (!res.ok) throw new Error('Deepgram error');
      const data = await res.json();
      const conf = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      
      // Heuristic: If it failed to transcribe anything but has confidence 0, it sucks
      const finalScore = transcript.length < 3 ? 0.1 : conf;
      
      setHealthScores(prev => {
        const next = { ...prev, [key]: finalScore };
        localStorage.setItem('catint_audio_health', JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.warn("Health check failed:", e);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const getHealthMeta = (score) => {
    if (score === undefined) return null;
    if (score >= 0.9) return { label: 'PEACHES 🍑', color: '#10b981', width: '100%' };
    if (score >= 0.75) return { label: 'GOOD ✅', color: '#34d399', width: '75%' };
    if (score >= 0.5) return { label: 'PASSING ⚠️', color: '#fbbf24', width: '50%' };
    return { label: 'UNACCEPTABLE ⛔', color: '#ef4444', width: '25%' };
  };

  const handleClear = async (key) => {
    await deleteFile(key);
    setWaveforms((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    reloadData();
  };

  const startRecording = async (key) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      if (!testMode && playingKey && callerRouteRef.current) {
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
    window.__CAT_AUDIO_VOL = 0;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const openSettings = (focusKey = null) => {
    const collapsed = new Set();
    ACTIONS.forEach((action) => {
      const { saved, total } = getActionCompletion(action, blobs);
      if (saved === total) collapsed.add(action.id);
    });
    if (focusKey) {
      const action = ACTIONS.find((a) => getActionClipKeys(a).includes(focusKey));
      if (action) collapsed.delete(action.id);
    }
    setCollapsedActions(collapsed);
    setMissingOnly(false);
    setMode('settings');
    if (focusKey) {
      setTimeout(() => {
        document.getElementById(`settings-row-${focusKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    let sendToCaller = routeToVirtualMic && !testMode;
    if (sendToCaller && !bypassGate && !isCallerReady(healthScores[key])) {
      const score = healthScores[key];
      setSafetyNotice(
        score === undefined
          ? '⛔ Untested clip — run health check in Setup, or use 🧪 Test Mode'
          : '⛔ Health gate — clip blocked from virtual mic; previewing locally'
      );
      window.setTimeout(() => setSafetyNotice(''), 4500);
      sendToCaller = false;
    }

    let playLocal = !callerOnly;
    let playSink = sendToCaller;
    callerRouteRef.current = playSink;

    const url = blobs[`url_${key}`] || generateObjectUrl(blob);
    audioRefSink.current.src = url;
    audioRefLocal.current.src = url;
    audioRefLocal.current.volume = 0;
    audioRefSink.current.volume = 0;

    const onEnd = clearPlaybackState;
    audioRefLocal.current.onended = onEnd;
    audioRefLocal.current.onpause = onEnd;
    audioRefSink.current.onended = onEnd;
    audioRefSink.current.onpause = onEnd;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(trackProgress);

    const startPlayback = async () => {
      setPlayingKey(key);
      try {
        const plays = [];
        if (playLocal) plays.push(audioRefLocal.current.play());
        if (playSink) plays.push(audioRefSink.current.play());
        if (!plays.length) plays.push(audioRefLocal.current.play());
        await Promise.all(plays);

        let vol = 0;
        const rampIntv = setInterval(() => {
          vol += 0.1;
          if (vol >= 1) {
            if (playLocal) audioRefLocal.current.volume = localVolume;
            if (playSink) audioRefSink.current.volume = sinkVolume;
            clearInterval(rampIntv);
          } else {
            if (playLocal) audioRefLocal.current.volume = vol * localVolume;
            if (playSink) audioRefSink.current.volume = vol * sinkVolume;
          }
        }, 10);
      } catch (e) {
        console.error('Playback error:', e);
        clearPlaybackState();
      }
    };

    if (playSink && selectedSinkId && audioRefSink.current.setSinkId) {
      try {
        await audioRefSink.current.setSinkId(selectedSinkId);
      } catch (e) {
        console.error('setSinkId failed', e);
        if (callerOnly) {
          setSafetyNotice('⚠️ Virtual mic route failed — check speaker/output in header');
          window.setTimeout(() => setSafetyNotice(''), 4500);
          return;
        }
        playSink = false;
        callerRouteRef.current = false;
        setSafetyNotice('⚠️ Virtual mic route failed — playing on local speakers only');
        window.setTimeout(() => setSafetyNotice(''), 4500);
      }
    }
    await startPlayback();
  };

  const renderClipCard = (key, label, compact = false) => {
    const hasBlob = !!blobs[key];
    const health = getHealthMeta(healthScores[key]);
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
              <button type="button" className="sb-btn sb-btn--preview" onClick={() => playAudioBlock(key, false)}>
                {playingKey === key ? '⏹' : '▶'}
              </button>
              <button
                type="button"
                className="sb-btn sb-btn--call"
                onClick={() => playAudioBlock(key, true, { bypassGate: true, callerOnly: true })}
                disabled={!selectedSinkId}
                title={selectedSinkId ? 'Route to virtual mic — hear patient path' : 'Pick speaker/output in header first'}
              >
                📡
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
          <label className="sb-file-btn">
            Upload
            <input type="file" accept="audio/*" hidden onChange={(e) => { handleFileUpload(key, e.target.files[0]); e.target.value = ''; }} />
          </label>
          {hasBlob && (
            <button type="button" className="sb-delete-btn" onClick={() => handleClear(key)}>Delete</button>
          )}
        </div>
      </div>
    );
  };

  if (mode === 'settings') {
    const stats = getSetupStats(blobs);
    const pct = stats.total ? Math.round((stats.saved / stats.total) * 100) : 0;

    return (
      <div className="sb-setup glass-panel" style={{ border: 'none' }}>
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
            <button type="button" className="btn btn-primary" onClick={() => setMode('play')} style={{ padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem' }}>
              Save & Back
            </button>
          </div>
        </div>

        <div className="sb-global-card">
          <strong>🖼️ Global App Background</strong>
          <div className="sb-thumb-row">
            <label className="sb-file-btn">
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
          const clipSlots = action.dynamic
            ? TIME_SLOTS.map((t) => ({ key: `${action.id}_${t}`, label: `${TIME_SLOT_META[t].icon} ${TIME_SLOT_META[t].short}` }))
            : [{ key: action.id, label: '🔈 Clip' }];

          const visibleSlots = missingOnly
            ? clipSlots.filter((s) => !blobs[s.key])
            : clipSlots;
          if (missingOnly && !visibleSlots.length) return null;

          return (
            <div key={action.id} className={`sb-action-card ${isComplete ? 'is-complete' : 'is-incomplete'}`}>
              <button type="button" className="sb-action-head" onClick={() => toggleActionCollapsed(action.id)}>
                <span className="sb-action-chevron">{isCollapsed ? '▸' : '▾'}</span>
                <span className="sb-action-name">{action.label}</span>
                {action.lang && (
                  <span className={`sb-lang-badge sb-lang-badge--${action.lang}`}>{action.lang.toUpperCase()}</span>
                )}
                <span className={`sb-action-count ${isComplete ? 'sb-action-count--ok' : 'sb-action-count--warn'}`}>
                  {completion.saved}/{completion.total}
                </span>
              </button>

              {!isCollapsed && (
                <div className="sb-action-body">
                  <div className="sb-thumb-row">
                    <span>Thumbnail</span>
                    <label className="sb-file-btn">
                      {blobs[`thumb_${action.id}`] ? 'Replace' : 'Add cover'}
                      <input type="file" accept="image/*" hidden onChange={(e) => { handleFileUpload(`thumb_${action.id}`, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                    {blobs[`thumb_${action.id}`] && (
                      <button type="button" className="sb-delete-btn" style={{ marginLeft: 0 }} onClick={() => handleClear(`thumb_${action.id}`)}>Clear</button>
                    )}
                  </div>

                  {action.dynamic ? (
                    <div className="sb-time-grid">
                      {visibleSlots.map((slot) => renderClipCard(slot.key, slot.label, true))}
                    </div>
                  ) : (
                    visibleSlots.map((slot) => renderClipCard(slot.key, slot.label))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const playStats = getSetupStats(blobs);

  return (
    <div className="sb-play-wrap">
      {safetyNotice && (
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '6px', padding: '0.35rem 0.5rem' }}>
          {safetyNotice}
        </div>
      )}

      <div className="sb-play-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span className={`sb-play-title ${testMode ? 'is-test' : ''}`}>Soundboard · {timeOfDay}</span>
          {playStats.missing > 0 && (
            <span style={{ fontSize: '0.62rem', color: '#f87171', fontWeight: 600 }}>{playStats.missing} clip{playStats.missing !== 1 ? 's' : ''} missing — tap ⚙️</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: testMode ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', background: testMode ? 'rgba(245, 158, 11, 0.1)' : 'transparent', padding: '0.2rem 0.4rem', borderRadius: '4px', border: testMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent', transition: 'all 0.2s' }} title="Test Mode: local speakers only — nothing to virtual mic">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} style={{ cursor: 'pointer' }} />
            🧪 Test
          </label>

          <button type="button" className="btn" onClick={openSettings} style={{ padding: '0.2rem 0.45rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '1rem', border: 'none' }} title="Setup Soundboard">
            ⚙️
          </button>
        </div>
      </div>

      <div className="sb-vol-strip">
        <div className="sb-vol-row">
          <span style={{ color: testMode ? '#f59e0b' : 'var(--text-muted)' }}>🔊 You (Local)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="range" min="0" max="1" step="0.05" value={localVolume} onChange={(e) => changeLocalVolume(parseFloat(e.target.value))} style={{ width: '60px', accentColor: '#3b82f6' }} title="Your Speakers Volume" />
            <div style={{ width: '30px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: playingKey ? `${localVolume * (40 + Math.random() * 60)}%` : '0%', height: '100%', background: testMode ? '#f59e0b' : '#3b82f6', transition: 'width 0.1s' }} />
            </div>
          </div>
        </div>
        <div className="sb-vol-row">
          <span style={{ color: testMode ? 'rgba(255,255,255,0.2)' : 'var(--text-muted)' }}>🎤 Call (Virtual Mic)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: testMode ? 0.3 : 1 }}>
            <input type="range" disabled={testMode} min="0" max="1" step="0.05" value={sinkVolume} onChange={(e) => changeSinkVolume(parseFloat(e.target.value))} style={{ width: '60px', accentColor: '#10b981' }} title="Interpreter Call Volume" />
            <div style={{ width: '30px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: (playingKey && blobs[playingKey] && !testMode) ? `${sinkVolume * (40 + Math.random() * 60)}%` : '0%', height: '100%', background: '#10b981', transition: 'width 0.1s' }} />
            </div>
          </div>
        </div>
        <div className="sb-vol-row">
          <button
            onClick={() => setMonitorMic(m => !m)}
            style={{
              background: monitorMic ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: monitorMic ? '#fbbf24' : 'var(--text-muted)',
              border: monitorMic ? '1px solid rgba(245,158,11,0.4)' : '1px solid transparent',
              borderRadius: '4px', padding: '0.1rem 0.4rem', cursor: 'pointer', fontSize: '0.7rem',
              fontWeight: monitorMic ? 700 : 400,
              animation: monitorMic ? 'pulseGlow 2s infinite' : 'none'
            }}
            title="Hear your own mic through your local speakers"
          >
            {monitorMic ? '🔴 Mic Monitor ON' : '👂 Mic Monitor'}
          </button>
          {monitorMic && (
            <input type="range" min="0" max="1" step="0.05" value={monitorVolume}
              onChange={e => setMonitorVolume(parseFloat(e.target.value))}
              style={{ width: '60px', accentColor: '#f59e0b' }} title="Monitor Volume" />
          )}
        </div>
      </div>
      
      <div className="sb-grid">
        {ACTIONS.map(action => {
           const activeKey = action.dynamic ? `${action.id}_${timeOfDay}` : action.id;
           const hasAudio = !!blobs[activeKey];
           const callerReady = isCallerReady(healthScores[activeKey]);
           const callerBlocked = hasAudio && !testMode && !callerReady;
           const bgImage = blobs[`url_thumb_${action.id}`] ? `url(${blobs[`url_thumb_${action.id}`]})` : 'none';
           const isItPlaying = playingKey === activeKey;
           
           return (
             <button
               key={action.id}
               onClick={() => playAudioBlock(activeKey, !testMode, { bypassGate: false })}
               style={{
                 height: '55px',
                 borderRadius: '6px',
                 border: isItPlaying ? '2px solid #10b981' : callerBlocked ? '1px solid rgba(239, 68, 68, 0.45)' : (action.lang === 'es' ? '1px solid rgba(16, 185, 129, 0.3)' : (action.lang === 'en' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--panel-border)')),
                 boxShadow: isItPlaying ? '0 0 15px rgba(16, 185, 129, 0.8)' : 'none',
                 animation: isItPlaying ? 'pulseGlow 1.5s infinite' : 'none',
                 background: bgImage !== 'none' ? bgImage : (action.lang === 'es' ? 'rgba(16, 185, 129, 0.05)' : (action.lang === 'en' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.05)')),
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 color: 'white',
                 fontWeight: 600,
                 textShadow: '0 2px 4px rgba(0,0,0,1)',
                 cursor: 'pointer',
                 opacity: hasAudio ? 1 : 0.4,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 position: 'relative',
                 overflow: 'hidden',
                 fontSize: '0.8rem',
                 lineHeight: 1.2
               }}
               title={
                 !hasAudio
                   ? 'Empty Audio - Click to add'
                   : callerBlocked
                     ? 'Blocked from virtual mic — local preview only (use Setup → Call Test or 🧪 Test Mode)'
                     : 'Play Audio'
               }
             >
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', transition: 'background 0.2s' }} />
                {action.lang && (
                  <div style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '0.4rem', fontWeight: 900, color: action.lang === 'es' ? '#10b981' : '#3b82f6', opacity: 0.8, zIndex: 2 }}>
                    {action.lang.toUpperCase()}
                  </div>
                )}
                {isItPlaying && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, left: 0, bottom: 0, 
                    width: `${playbackProgress * 100}%`,
                    background: 'rgba(16, 185, 129, 0.4)',
                    transition: 'width 0.1s linear',
                    zIndex: 0
                  }} />
                )}
                
                <span style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {!hasAudio ? `➕ Add ${action.label}` : (isItPlaying ? '⏹ STOP' : action.label)}
                  {hasAudio && healthScores[activeKey] !== undefined && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.3)' }}>
                         <div style={{ height: '100%', width: getHealthMeta(healthScores[activeKey])?.width || '0%', backgroundColor: getHealthMeta(healthScores[activeKey])?.color || '#94a3b8' }} />
                      </div>
                      <span style={{ fontSize: '0.45rem', fontWeight: 900, color: getHealthMeta(healthScores[activeKey])?.color || '#94a3b8', marginTop: '1px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {getHealthMeta(healthScores[activeKey])?.label}
                      </span>
                    </div>
                  )}
                </span>
             </button>
           )
        })}
      </div>
    </div>
  );
};
