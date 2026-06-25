import { useState, useEffect, useRef, useCallback } from 'react';
import {
  saveFile,
  loadFile,
  deleteFile,
  generateObjectUrl,
} from '../utils/storage';
import { bindAudioToSink, primePlaybackElements, rampVolume } from '../utils/audioRoute';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { createSpeechProcessingGraph, createNoiseGate } from '../utils/audioProcessing';
import { getRuntimeDeepgramKey } from '../utils/deepgramRuntimeKey';

export const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

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

export function useGreetingsPanel(onEditModeChange) {
  const audioSettings = useAudioSettings();
  const { selectedSinkId, localVolume, sinkVolume, setSinkPlaybackActive } = audioSettings;

  const [mode, setMode] = useState('play');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [blobs, setBlobs] = useState({});
  const [healthScores, setHealthScores] = useState(() => JSON.parse(localStorage.getItem('catint_audio_health')) || {});
  const [isAnalyzing, setIsAnalyzing] = useState(null);
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [recordingKey, setRecordingKey] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const audioRefSink = useRef(new Audio());
  const audioRefLocal = useRef(new Audio());
  const rampCancelRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordCtxRef = useRef(null);
  const recordStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationRef = useRef(null);
  const playCtxRef = useRef(null);
  const playSourceRef = useRef(null);
  const playGraphRef = useRef(null);

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
    onEditModeChange?.(mode === 'settings');
  }, [mode, onEditModeChange]);

  const reloadData = useCallback(async () => {
    const state = {};
    for (const action of ACTIONS) {
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
    setBlobs(state);
  }, []);

  useEffect(() => { reloadData(); }, [reloadData]);

  useEffect(() => {
    primePlaybackElements(audioRefLocal.current, audioRefSink.current);
    if (selectedSinkId) bindAudioToSink(audioRefSink.current, selectedSinkId);
  }, [selectedSinkId]);

  useEffect(() => {
    audioRefLocal.current.volume = Math.min(1, localVolume);
    audioRefSink.current.volume = Math.min(1, sinkVolume);
  }, [localVolume, sinkVolume]);

  const analyzeHealth = useCallback(async (key) => {
    const blob = await loadFile(key);
    if (!blob) return;
    const API_KEY =
      getRuntimeDeepgramKey() ||
      localStorage.getItem('DEEPGRAM_API_KEY') ||
      process.env.REACT_APP_DEEPGRAM_API_KEY;
    if (!API_KEY) return;
    setIsAnalyzing(key);
    try {
      const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: { Authorization: `Token ${API_KEY}`, 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      if (!res.ok) throw new Error('Deepgram error');
      const data = await res.json();
      const conf = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const finalScore = transcript.length < 3 ? 0.1 : conf;
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
  }, []);

  const handleFileUpload = useCallback(async (key, file) => {
    if (!file) return;
    await saveFile(key, file);
    await reloadData();
    if (!key.startsWith('thumb_') && key !== 'bg_app') analyzeHealth(key);
  }, [reloadData, analyzeHealth]);

  const handleClear = useCallback(async (key) => {
    await deleteFile(key);
    await reloadData();
  }, [reloadData]);

  const getHealthMeta = useCallback((score) => {
    if (score === undefined) return null;
    if (score >= 0.9) return { label: 'PEACHES 🍑', color: '#10b981', width: '100%' };
    if (score >= 0.75) return { label: 'GOOD ✅', color: '#34d399', width: '75%' };
    if (score >= 0.5) return { label: 'PASSING ⚠️', color: '#fbbf24', width: '50%' };
    return { label: 'UNACCEPTABLE ⛔', color: '#ef4444', width: '25%' };
  }, []);

  const stopPlayback = useCallback(() => {
    audioRefSink.current.pause();
    audioRefLocal.current.pause();
    if (playSourceRef.current) {
      try { playSourceRef.current.stop(); } catch (_) {}
      playSourceRef.current = null;
    }
    if (playGraphRef.current) {
      playGraphRef.current.outputGain.disconnect();
      playGraphRef.current = null;
    }
    setPlayingKey(null);
    setPlaybackProgress(0);
    window.__CAT_AUDIO_VOL = 0;
    setSinkPlaybackActive(false);
    if (rampCancelRef.current) rampCancelRef.current();
    rampCancelRef.current = null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, [setSinkPlaybackActive]);

  const startRecording = useCallback(async (key) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });
      recordStreamRef.current = stream;
      const recordCtx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
      recordCtxRef.current = recordCtx;
      const source = recordCtx.createMediaStreamSource(stream);
      const graph = createSpeechProcessingGraph(recordCtx, source);
      const gate = createNoiseGate(recordCtx, graph.outputGain);
      const dest = recordCtx.createMediaStreamDestination();
      gate.connect(dest);

      const analyser = recordCtx.createAnalyser();
      gate.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 }
        : { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(dest.stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // CPU hotfix: throttle level sampling to ~10 FPS.
      let lastSampleAt = 0;
      const updateLevel = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        const now = performance.now();
        if (now - lastSampleAt >= 100) {
          lastSampleAt = now;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const width = Math.min(100, Math.max(0, (sum / dataArray.length / 100) * 100)) || (sum > 0 ? 2 : 0);
          const bar = document.getElementById('record-vol-bar') || document.getElementById('editor-record-vol-bar');
          if (bar) bar.style.width = `${width}%`;
        }
        requestAnimationFrame(updateLevel);
      };

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        handleFileUpload(key, audioBlob);
        stream.getTracks().forEach((t) => t.stop());
        recordCtx.close().catch(() => {});
        recordCtxRef.current = null;
        recordStreamRef.current = null;
      };

      mediaRecorder.start(100);
      setRecordingKey(key);
      updateLevel();
    } catch (e) {
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  }, [handleFileUpload]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingKey(null);
    }
  }, []);

  const playAudioBlock = useCallback(async (key, routeToVirtualMic) => {
    if (playingKey === key) {
      stopPlayback();
      return;
    }
    stopPlayback();

    const blob = blobs[key];
    if (!blob) return;

    const sendToCaller = routeToVirtualMic && !testMode;
    setPlayingKey(key);

    try {
      if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
        playCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
      }
      const ctx = playCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const arrayBuf = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;
      const graph = createSpeechProcessingGraph(ctx, source);
      graph.outputGain.gain.value = localVolume;
      graph.outputGain.connect(ctx.destination);
      playSourceRef.current = source;
      playGraphRef.current = graph;

      if (sendToCaller && selectedSinkId) {
        setSinkPlaybackActive(true);
        window.__CAT_AUDIO_VOL = sinkVolume * 80;
      }

      const duration = audioBuffer.duration / playbackSpeed;
      const startTime = ctx.currentTime;
      source.start(0);
      source.onended = () => stopPlayback();

      const tick = () => {
        const elapsed = (ctx.currentTime - startTime) / playbackSpeed;
        setPlaybackProgress(Math.min(1, elapsed / audioBuffer.duration));
        if (elapsed < duration) animationRef.current = requestAnimationFrame(tick);
      };
      animationRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error('Playback error:', e);
      stopPlayback();
    }
  }, [playingKey, blobs, testMode, playbackSpeed, localVolume, sinkVolume, selectedSinkId, stopPlayback, setSinkPlaybackActive]);

  return {
    mode, setMode,
    timeOfDay,
    blobs,
    healthScores,
    isAnalyzing,
    playingKey,
    playbackProgress,
    recordingKey,
    testMode, setTestMode,
    playbackSpeed, setPlaybackSpeed,
    audioSettings,
    handleFileUpload,
    handleClear,
    startRecording,
    stopRecording,
    playAudioBlock,
    analyzeHealth,
    getHealthMeta,
    isRecording: recordingKey !== null,
    isPlaying: playingKey !== null,
  };
}
