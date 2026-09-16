/**
 * useGreetingClip — shared greeting-clip data hook (v4.118.0).
 *
 * Extracts the clip-data core of GreetingsPanel (blobs, waveforms, loudness,
 * choppiness, health) so the new GreetingEditorView can reuse it without
 * dragging the 1,800-line panel along. GreetingsPanel still runs its own copy;
 * migrating it onto this hook is deferred (see docs/soundboard/).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { saveFile, loadFile, deleteFile, listStorageKeys } from '../utils/storage';
import { getScriptForClip } from '../services/soundboardMetaService';
import { getEffectiveDeepgramKey } from '../utils/deepgramRuntimeKey';
import {
  classifyLoudness, measureChannelLoudness, measureChoppiness, classifyChoppiness,
} from '../utils/loudness';
import { analyzeClipLegibility } from '../utils/audioSelfTest';
import { routeFamilyKey, MANUAL_CALL_OK_STORAGE, LEGACY_CALL_PATH_STORAGE } from '../utils/routeVerification';

const withoutKey = (store, key) => {
  const next = { ...store };
  delete next[key];
  return next;
};



/** One decode pass → peaks + loudness + choppiness (no second pass). */
export const analyzeClipAudio = async (blob, bars = 56) => {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const level = measureChannelLoudness(channel);
    const loudness = classifyLoudness(level.rmsDb, level.peakDb);
    const chopMeasure = measureChoppiness(channel, audioBuffer.sampleRate);
    const chop = {
      ...classifyChoppiness(chopMeasure.per10s),
      dropouts: chopMeasure.dropouts,
      activeSecs: chopMeasure.activeSecs,
    };
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
    return { peaks: peaks.map((p) => p / max), loudness, chop };
  } finally {
    ctx.close().catch(() => {});
  }
};

const readJson = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
};
const writeJson = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
};

const LS = {
  health: 'catint_audio_health',
  heard: 'catint_audio_health_heard',
  loudness: 'catint_loudness',
  chop: 'catint_sb_chop',
};

/** Reload every clip blob from IndexedDB (excludes thumbs/backgrounds). */
const loadAllBlobs = async () => {
  const next = {};
  const keys = (await listStorageKeys()).filter(
    (k) => typeof k === 'string' && !k.startsWith('url_') && !k.startsWith('thumb_') && k !== 'bg_app',
  );
  for (const key of keys) {
    const blob = await loadFile(key);
    if (!blob?.size) throw new Error(`Recording ${key} is missing or unreadable. Retry loading.`);
    next[key] = blob;
  }
  return next;
};

export const useGreetingClip = ({ onChange } = {}) => {
  const [blobs, setBlobs] = useState({});
  const [waveforms, setWaveforms] = useState({});
  const [loudness, setLoudness] = useState(() => readJson(LS.loudness));
  const [chop, setChop] = useState(() => readJson(LS.chop));
  const [healthScores, setHealthScores] = useState(() => readJson(LS.health));
  const [heardByRobot, setHeardByRobot] = useState(() => readJson(LS.heard));
  const [isAnalyzing, setIsAnalyzing] = useState(null); // clip key currently health-probing
  const [isSaving, setIsSaving] = useState(null); // clip key while writing/deleting
  const [isLoading, setIsLoading] = useState(true);
  const [isDecoding, setIsDecoding] = useState(false);
  const [error, setError] = useState(null); // actionable text; never an alert
  const savingRef = useRef(false);
  const probeRef = useRef(null);
  const probeSeqRef = useRef(0);
  const decodeRef = useRef(0);
  const mountedRef = useRef(true);
  const reloadRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      reloadRef.current += 1;
      probeRef.current = null;
    };
  }, []);

  const reloadData = useCallback(async () => {
    if (!mountedRef.current) return false;
    const request = ++reloadRef.current;
    setIsLoading(true);
    try {
      const next = await loadAllBlobs();
      if (!mountedRef.current || request !== reloadRef.current) return false;
      setBlobs(next);
      onChangeRef.current?.(next);
      return true;
    } catch (e) {
      if (mountedRef.current && request === reloadRef.current) setError(`Load failed: ${e.message || e}`);
      return false;
    } finally {
      if (mountedRef.current && request === reloadRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { reloadData(); }, [reloadData]);

  // Decode waveforms + ride-along loudness/chop verdicts (persisted).
  useEffect(() => {
    let cancelled = false;
    const generation = ++decodeRef.current;
    const stale = () => cancelled || !mountedRef.current || generation !== decodeRef.current;
    setIsDecoding(true);
    const keys = Object.keys(blobs)
      .filter((k) => !k.startsWith('url_') && blobs[k]?.size > 0)
      .filter((k) => typeof blobs[k].arrayBuffer === 'function'); // jsdom Blobs can't decode
    (async () => {
      const nextWave = {};
      const nextLoud = {};
      const nextChop = {};
      for (const key of keys) {
        if (stale()) return;
        try {
          const res = await analyzeClipAudio(blobs[key]);
          nextWave[key] = res.peaks;
          if (res.loudness) nextLoud[key] = res.loudness;
          if (res.chop) nextChop[key] = res.chop;
        } catch (e) {
          if (!stale()) setError(`Cannot decode ${key} — upload a supported audio file or record again.`);
        }
      }
      if (stale()) return;
      setIsDecoding(false);
      setWaveforms(nextWave);
      if (Object.keys(nextLoud).length) {
        const merged = { ...readJson(LS.loudness), ...nextLoud };
        writeJson(LS.loudness, merged);
        setLoudness(merged);
      }
      if (Object.keys(nextChop).length) {
        const merged = { ...readJson(LS.chop), ...nextChop };
        writeJson(LS.chop, merged);
        setChop(merged);
      }
    })();
    return () => { cancelled = true; };
  }, [blobs]);

  /** Deepgram legibility probe: score transcript recall against the known script. */
  const analyzeHealth = useCallback(async (key) => {
    if (!mountedRef.current || savingRef.current || probeRef.current) return false;
    if (!key) { setError('Choose a recording to check.'); return false; }
    const probeId = `${++probeSeqRef.current}`;
    probeRef.current = probeId;
    const current = () => mountedRef.current && probeRef.current === probeId;
    setError(null);
    setIsAnalyzing(key);
    try {
      const blob = await loadFile(key);
      if (!current()) return false;
      if (!blob?.size) throw new Error('Recording missing or unreadable — upload or record first.');
      const apiKey = getEffectiveDeepgramKey();
      if (!apiKey) {
        throw new Error('Health check needs a Deepgram key — add it in Settings first.');
      }
      const script = getScriptForClip(key);
      const probe = await analyzeClipLegibility(blob, apiKey, script);
      if (!current()) return false;
      if (!probe || !Number.isFinite(probe.score)) {
        throw new Error('Health check returned no score — retry.');
      }
      const scores = { ...readJson(LS.health), [key]: probe.score };
      const heard = {
        ...readJson(LS.heard),
        [key]: { text: probe.transcript, recall: probe.recall, confidence: probe.confidence, at: Date.now() },
      };
      writeJson(LS.health, scores);
      writeJson(LS.heard, heard);
      setHealthScores(scores);
      setHeardByRobot(heard);
      window.dispatchEvent(new Event('catint_gates_updated'));
      return true;
    } catch (e) {
      console.warn('Health check failed:', e);
      if (mountedRef.current && probeRef.current === probeId) {
        setError(e.message || 'Health check failed — check connection or Deepgram key, then retry.');
      }
      return false;
    } finally {
      if (mountedRef.current && probeRef.current === probeId) {
        probeRef.current = null;
        setIsAnalyzing(null);
      }
    }
  }, []);

  const invalidateClip = useCallback((key) => {
    // Cancel pending reads/probes/decodes before storage can change underneath them.
    probeRef.current = null;
    reloadRef.current += 1;
    decodeRef.current += 1;
    const setters = { health: setHealthScores, heard: setHeardByRobot, loudness: setLoudness, chop: setChop };
    Object.entries(setters).forEach(([name, setter]) => {
      const next = withoutKey(readJson(LS[name]), key);
      writeJson(LS[name], next);
      if (mountedRef.current) setter(next);
    });
    // A time-slot replacement invalidates every sink/mic proof in its family,
    // including old slot-specific fingerprints. Other families remain intact.
    [MANUAL_CALL_OK_STORAGE, LEGACY_CALL_PATH_STORAGE].forEach((storageKey) => {
      const store = readJson(storageKey);
      Object.keys(store).forEach((fp) => {
        if (routeFamilyKey(fp.split('|')[0]) === routeFamilyKey(key)) delete store[fp];
      });
      writeJson(storageKey, store);
    });
    if (mountedRef.current) {
      setIsAnalyzing(null);
      setIsDecoding(false);
      setIsLoading(false);
      setWaveforms((prev) => withoutKey(prev, key));
    }
    window.dispatchEvent(new Event('catint_gates_updated'));
  }, []);

  const changeClip = useCallback(async (key, file, removing) => {
    if (!mountedRef.current || savingRef.current) return false;
    if (!key || (!removing && !file?.size)) {
      setError('Choose a non-empty recording first.');
      return false;
    }
    savingRef.current = true;
    setIsSaving(key);
    setError(null);
    // Fail closed: an unsuccessful write requires re-verification, never stale proof.
    invalidateClip(key);
    try {
      const ok = removing ? await deleteFile(key) : await saveFile(key, file);
      if (!ok) throw new Error(removing ? 'Could not delete recording. Retry.' : 'Could not save recording. Check browser storage and retry.');
      invalidateClip(key);
      if (mountedRef.current) await reloadData();
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e.message || String(e));
      return false;
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setIsSaving(null);
    }
  }, [invalidateClip, reloadData]);

  // Paid checks are explicit only: upload/edit/record/reload never probes Deepgram.
  const uploadFile = useCallback((key, file) => changeClip(key, file, false), [changeClip]);
  const clearClip = useCallback((key) => changeClip(key, null, true), [changeClip]);

  return {
    blobs, waveforms, loudness, chop, healthScores, heardByRobot, isAnalyzing,
    analyzeHealth, uploadFile, clearClip, reloadData,
    isLoading, isDecoding, isSaving, error,
    busy: isLoading || isDecoding || isSaving !== null || isAnalyzing !== null,
  };
};

/**
 * useGreetingRecorder — raw-mic recorder (no browser DSP; dedicated rec mic
 * with default-mic fallback). Level meter writes to `#gee-record-bar`.
 */
export const useGreetingRecorder = ({ selectedRecMicId, selectedMicId, onSaved } = {}) => {
  const [recordingKey, setRecordingKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef(null); // lock covers permission, recording and save
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;

  const release = useCallback((s) => {
    if (s.frame != null) cancelAnimationFrame(s.frame);
    s.frame = null;
    s.stream?.getTracks().forEach((track) => track.stop());
    s.stream = null;
    if (s.ctx) {
      try { Promise.resolve(s.ctx.close()).catch(() => {}); } catch { /* closed */ }
      s.ctx = null;
    }
    const bar = document.getElementById('gee-record-bar');
    if (bar) bar.style.width = '0%';
  }, []);

  const finish = useCallback((s) => {
    release(s);
    if (sessionRef.current !== s) return;
    sessionRef.current = null;
    if (mountedRef.current) { setRecordingKey(null); setBusy(false); }
  }, [release]);

  const discard = useCallback((s) => {
    s.cancelled = true;
    if (s.recorder) {
      s.recorder.onstop = null;
      s.recorder.ondataavailable = null;
      s.recorder.onerror = null;
      try { if (s.recorder.state !== 'inactive') s.recorder.stop(); } catch { /* release anyway */ }
    }
    finish(s);
  }, [finish]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (sessionRef.current) discard(sessionRef.current); // never save on unmount
    };
  }, [discard]);

  const stopRecording = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.stopping) return;
    if (!s.recorder) { discard(s); return; } // cancel permission wait
    s.stopping = true;
    try {
      s.recorder.stop(); // final data and onstop arrive asynchronously
      release(s);
      if (mountedRef.current) setRecordingKey(null);
    } catch (e) {
      if (mountedRef.current) setError(`Recording failed: ${e.message || e}`);
      discard(s);
    }
  }, [discard, release]);

  const startRecording = useCallback(async (key) => {
    if (!mountedRef.current || sessionRef.current) return false;
    if (!key) { setError('Choose a greeting to record.'); return false; }
    const s = { chunks: [], cancelled: false, stopping: false };
    sessionRef.current = s;
    const current = () => mountedRef.current && !s.cancelled && sessionRef.current === s;
    setBusy(true);
    setError(null);
    const fail = (e) => {
      if (current()) setError(`Recording failed: ${e?.message || e}`);
      discard(s);
    };
    try {
      const recMicId = selectedRecMicId || selectedMicId;
      const constraints = (id) => ({ audio: {
        ...(id ? { deviceId: { exact: id } } : {}),
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      } });
      try {
        s.stream = await navigator.mediaDevices.getUserMedia(constraints(recMicId));
      } catch (e) {
        if (!current()) return false;
        if (!recMicId || !['NotFoundError', 'OverconstrainedError', 'NotReadableError'].includes(e.name)) throw e;
        s.stream = await navigator.mediaDevices.getUserMedia(constraints(null));
      }
      if (!current()) { release(s); return false; }
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
      const recorder = new MediaRecorder(s.stream,
        MediaRecorder.isTypeSupported?.(options.mimeType) ? options : undefined);
      s.recorder = recorder;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      s.ctx = ctx;
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(s.stream).connect(analyser);
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!current() || s.stopping || recorder.state !== 'recording') return;
        try {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
          const bar = document.getElementById('gee-record-bar');
          if (bar) bar.style.width = `${Math.min(100, avg > 0 ? Math.max(2, avg) : 0)}%`;
          s.frame = requestAnimationFrame(updateLevel);
        } catch (e) { fail(e); }
      };
      recorder.ondataavailable = (e) => {
        if (current() && e.data?.size) s.chunks.push(e.data);
      };
      recorder.onerror = (e) => fail(e.error || new Error('Microphone recorder error.'));
      recorder.onstop = async () => {
        release(s);
        if (!current()) return;
        s.stopping = true;
        setRecordingKey(null);
        try {
          const blob = new Blob(s.chunks, { type: recorder.mimeType || 'audio/webm' });
          if (!blob.size) throw new Error('Empty recording — please try again.');
          if (!savedRef.current) throw new Error('No recording save handler.');
          if (await savedRef.current(key, blob) === false) throw new Error('Could not save recording. Retry.');
        } catch (e) {
          if (current()) setError(`Recording failed: ${e.message || e}`);
        } finally { finish(s); }
      };
      recorder.start();
      setRecordingKey(key);
      s.frame = requestAnimationFrame(updateLevel);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }, [selectedRecMicId, selectedMicId, discard, finish, release]);

  return { recordingKey, startRecording, stopRecording, busy, error };
};