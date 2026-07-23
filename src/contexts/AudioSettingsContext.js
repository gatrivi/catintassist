import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  decodeBlobToBuffer,
  playBufferViaPassthrough,
  readRouteModePreference,
  ROUTE_MODE,
} from '../utils/audioRoutePassthrough';
import { logRouteEvent, ROUTE_EVENT } from '../utils/routeDiagnostics';
import {
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  needsVbCableSinkAutoFix,
  pickVbCableSinkDevice,
  readAudioSourceMode,
} from '../utils/audioSourceManager';

const AudioSettingsContext = createContext();

export const AudioSettingsProvider = ({ children }) => {
  const [outputDevices, setOutputDevices] = useState([]);
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedSinkId, setSelectedSinkId] = useState(() => localStorage.getItem('CATINTASSIST_SINK_ID') || '');
  const [selectedMicId, setSelectedMicId] = useState(() => localStorage.getItem('CATINTASSIST_MIC_ID') || '');
  
  const [localVolume, setLocalVolume] = useState(() => parseFloat(localStorage.getItem('CATINTASSIST_LOCAL_VOL') || '1'));
  const [sinkVolume, setSinkVolume] = useState(() => parseFloat(localStorage.getItem('CATINTASSIST_SINK_VOL') || '1'));
  const [monitorMic, setMonitorMic] = useState(false);
  const [monitorVolume, setMonitorVolume] = useState(0.5);
  const monitorCtxRef = useRef(null);
  const monitorGainRef = useRef(null);
  const monitorStreamRef = useRef(null);

  const changeLocalVolume = (vol) => { setLocalVolume(vol); localStorage.setItem('CATINTASSIST_LOCAL_VOL', vol); };
  const changeSinkVolume = (vol) => { setSinkVolume(vol); localStorage.setItem('CATINTASSIST_SINK_VOL', vol); };
  
  // Hidden element: physical mic → virtual output (when mic is selected)
  const passthroughAudioRef = useRef(new Audio());
  const micStreamRef = useRef(null);
  const clipPlaybackStopRef = useRef(null);
  const sinkPlaybackActiveRef = useRef(false);
  const [sinkPlaybackActive, setSinkPlaybackActiveState] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micStatus, setMicStatus] = useState('idle'); // idle | ok | no-signal | clip | muted
  const micThrottleRef = useRef(0);
  const micSilentSinceRef = useRef(0);

  /** Mute mic passthrough while soundboard/TTS plays to the same sink (avoids garbled mix). */
  const setSinkPlaybackActive = useCallback((active) => {
    sinkPlaybackActiveRef.current = active;
    setSinkPlaybackActiveState(active);
    const el = passthroughAudioRef.current;
    if (!el) return;
    el.volume = active ? 0 : 1;
    el.muted = active;
  }, []);

  // Fetch available devices
  const fetchDevices = useCallback(async ({ requestMicPermissionForLabels = false } = {}) => {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      const needsPermission = devices.some(d => d.label === '' || d.label.toLowerCase() === 'speaker' || d.label.toLowerCase() === 'microphone');
      if (needsPermission && requestMicPermissionForLabels) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          console.warn('Microphone permission denied.', e);
        }
      }
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const inputs = devices.filter(d => d.kind === 'audioinput');
      setOutputDevices(outputs);
      setInputDevices(inputs);
      let nextSinkId = selectedSinkId;
      if (nextSinkId && !outputs.some((d) => d.deviceId === nextSinkId)) {
        nextSinkId = '';
        setSelectedSinkId('');
      }
      // ponytail: cable mode — auto-fix VB out when empty or stuck on speakers/default.
      if (readAudioSourceMode() === AUDIO_SOURCE_MODE_VIRTUAL_CABLE) {
        const pickedSink = pickVbCableSinkDevice(outputs);
        const sinkLabel = outputs.find((d) => d.deviceId === nextSinkId)?.label || '';
        if (
          pickedSink &&
          needsVbCableSinkAutoFix({ sinkId: nextSinkId, sinkLabel })
        ) {
          nextSinkId = pickedSink;
          setSelectedSinkId(pickedSink);
          try {
            localStorage.setItem('CATINTASSIST_SINK_ID', pickedSink);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err);
    }
  }, [selectedSinkId]);

  useEffect(() => {
    fetchDevices({ requestMicPermissionForLabels: false });
    const onDeviceChange = () => {
      // Avoid triggering mic permission during casual device changes.
      fetchDevices({ requestMicPermissionForLabels: false });
    };
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => {
      try {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      } catch (_) {}
    };
  }, [fetchDevices]);

  // Core Mixer Logic: If both Mic and Sink are selected, pipe them together.
  useEffect(() => {
    let stream = null;
    let isMounted = true;

    const setupPassthrough = async () => {
      // 1. Point the pipeline's output to the Virtual Microphone
      if (passthroughAudioRef.current.setSinkId) {
        try { await passthroughAudioRef.current.setSinkId(selectedSinkId || ''); } 
        catch (e) { console.error("setSinkId fail on passthrough:", e); }
      }

      // 2. Feed the actual Physical Mic into the pipeline
      if (selectedMicId && isMounted) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
             audio: { deviceId: { exact: selectedMicId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
          });
          if (isMounted) {
            micStreamRef.current = stream;
            if (!clipPlaybackStopRef.current) {
              passthroughAudioRef.current.srcObject = stream;
              passthroughAudioRef.current.volume = sinkPlaybackActiveRef.current ? 0 : 1;
              passthroughAudioRef.current.muted = sinkPlaybackActiveRef.current;
              passthroughAudioRef.current.play().catch(e => console.error(e));
            }
            
            // Attach visualizer without React state to avoid massive re-renders
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyzer = audioCtx.createAnalyser();
            analyzer.fftSize = 256;
            source.connect(analyzer);
            
            const dataArray = new Uint8Array(analyzer.frequencyBinCount);
            
            const updateVolume = () => {
              if (!isMounted) {
                audioCtx.close().catch(console.error);
                return;
              }
              analyzer.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              
              // Scale volume. Average is rarely > 60 in normal talking.
              const micVol = Math.min(100, (avg / 60) * 100);
              const appVol = window.__CAT_AUDIO_VOL || 0;
              const vol = Math.min(100, micVol + appVol);

              // Throttled React state + global ref for legacy top-mic-bar
              const now = Date.now();
              if (now - micThrottleRef.current > 100) {
                micThrottleRef.current = now;
                window.__CAT_MIC_LEVEL = vol;
                setMicLevel(vol);
                if (sinkPlaybackActiveRef.current) {
                  setMicStatus('muted');
                } else if (vol > 90) {
                  setMicStatus('clip');
                } else if (vol > 2) {
                  micSilentSinceRef.current = 0;
                  setMicStatus('ok');
                } else {
                  if (!micSilentSinceRef.current) micSilentSinceRef.current = now;
                  setMicStatus(now - micSilentSinceRef.current > 3000 ? 'no-signal' : 'ok');
                }
              }
              
              const bar = document.getElementById('top-mic-bar');
              if (bar) {
                if (vol > 2) {
                  bar.style.width = `${vol}%`;
                  bar.style.opacity = Math.min(1, (vol / 40) + 0.2).toString();
                  // Change color based on clipping
                  if (vol > 90) {
                     bar.style.background = '#ef4444';
                     bar.style.boxShadow = '0 0 10px #ef4444';
                  } else if (vol > 70) {
                     bar.style.background = '#f59e0b';
                     bar.style.boxShadow = '0 0 10px #f59e0b';
                  } else {
                     bar.style.background = '#10b981';
                     bar.style.boxShadow = '0 0 10px #10b981';
                  }
                } else {
                  bar.style.width = '0%';
                  bar.style.opacity = '0';
                }
              }
              requestAnimationFrame(updateVolume);
            };
            updateVolume();
          }
        } catch (e) {
          console.error("Failed to capture physical mic for passthrough", e);
          setMicStatus('no-signal');
          setMicLevel(0);
        }
      } else {
        micStreamRef.current = null;
        if (!clipPlaybackStopRef.current) {
          passthroughAudioRef.current.srcObject = null;
        }
        setMicLevel(0);
        setMicStatus('idle');
      }
    };
    
    setupPassthrough();

    const currentPipeline = passthroughAudioRef.current;
    return () => {
      isMounted = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      if (!clipPlaybackStopRef.current) {
        currentPipeline.srcObject = null;
      }
    };
  }, [selectedMicId, selectedSinkId]);

  /** Stop passthrough clip playback and restore live mic stream. */
  const stopClipToSink = useCallback(() => {
    if (clipPlaybackStopRef.current) {
      clipPlaybackStopRef.current();
      clipPlaybackStopRef.current = null;
    }
    sinkPlaybackActiveRef.current = false;
    setSinkPlaybackActiveState(false);
    const el = passthroughAudioRef.current;
    const mic = micStreamRef.current;
    if (el && mic) {
      el.srcObject = mic;
      el.volume = 1;
      el.muted = false;
      el.play().catch(() => {});
    }
    logRouteEvent(ROUTE_EVENT.PASSTHROUGH_RESTORE, { routeMode: ROUTE_MODE.PASSTHROUGH });
  }, []);

  /**
   * Route clip through passthrough element (same VB-Cable path as live mic).
   * @returns {Promise<{ ok: boolean, mode?: string, reason?: string }>}
   */
  const playClipToSink = useCallback(async (blob, volume = 1, { clipKey, onProgress } = {}) => {
    if (!blob || !selectedSinkId) {
      return { ok: false, reason: 'no_sink_or_blob' };
    }
    stopClipToSink();

    const el = passthroughAudioRef.current;
    const savedMic = micStreamRef.current;

    try {
      const { ctx, buffer } = await decodeBlobToBuffer(blob);
      sinkPlaybackActiveRef.current = true;
      setSinkPlaybackActiveState(true);

      const session = playBufferViaPassthrough(el, buffer, ctx, {
        volume,
        sinkId: selectedSinkId,
        savedSrcObject: savedMic,
        onProgress,
      });
      clipPlaybackStopRef.current = session.stop;

      logRouteEvent(ROUTE_EVENT.PASSTHROUGH_INJECT, {
        clipKey,
        routeMode: ROUTE_MODE.PASSTHROUGH,
        sinkId: selectedSinkId,
      });

      await session.promise;

      clipPlaybackStopRef.current = null;
      sinkPlaybackActiveRef.current = false;
      setSinkPlaybackActiveState(false);
      if (el && savedMic) {
        el.srcObject = savedMic;
        el.volume = 1;
        el.muted = false;
        el.play().catch(() => {});
      }
      logRouteEvent(ROUTE_EVENT.PLAY_END, { clipKey, routeMode: ROUTE_MODE.PASSTHROUGH });
      return { ok: true, mode: ROUTE_MODE.PASSTHROUGH };
    } catch (err) {
      console.error('playClipToSink failed:', err);
      clipPlaybackStopRef.current = null;
      sinkPlaybackActiveRef.current = false;
      setSinkPlaybackActiveState(false);
      if (el && savedMic) {
        el.srcObject = savedMic;
        el.play().catch(() => {});
      }
      logRouteEvent(ROUTE_EVENT.PLAY_FAIL, {
        clipKey,
        routeMode: ROUTE_MODE.PASSTHROUGH,
        reason: err?.message || 'unknown',
      });
      return { ok: false, reason: err?.message || 'play_failed', mode: ROUTE_MODE.PASSTHROUGH };
    }
  }, [selectedSinkId, stopClipToSink]);

  // Mic Monitor: hear your own voice through local speakers
  useEffect(() => {
    if (monitorMic) {
      const constraints = selectedMicId
        ? { audio: { deviceId: { exact: selectedMicId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }
        : { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
      navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        monitorStreamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        monitorCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = monitorVolume;
        monitorGainRef.current = gain;
        source.connect(gain);
        gain.connect(ctx.destination); // local speakers only
      }).catch(e => { console.error('Mic monitor failed:', e); setMonitorMic(false); });
    } else {
      if (monitorStreamRef.current) { monitorStreamRef.current.getTracks().forEach(t => t.stop()); monitorStreamRef.current = null; }
      if (monitorCtxRef.current) { monitorCtxRef.current.close().catch(()=>{}); monitorCtxRef.current = null; }
    }
    return () => {
      if (monitorStreamRef.current) { monitorStreamRef.current.getTracks().forEach(t => t.stop()); monitorStreamRef.current = null; }
      if (monitorCtxRef.current) { monitorCtxRef.current.close().catch(()=>{}); monitorCtxRef.current = null; }
    };
  }, [monitorMic, selectedMicId, monitorVolume]);

  useEffect(() => {
    if (monitorGainRef.current) monitorGainRef.current.gain.value = monitorVolume;
  }, [monitorVolume]);

  const changeSinkId = (deviceId) => {
    setSelectedSinkId(deviceId);
    localStorage.setItem('CATINTASSIST_SINK_ID', deviceId);
  };

  const changeMicId = (deviceId) => {
    setSelectedMicId(deviceId);
    localStorage.setItem('CATINTASSIST_MIC_ID', deviceId);
    try {
      window.dispatchEvent(
        new CustomEvent('catint_mic_device_changed', { detail: { deviceId } }),
      );
    } catch (_) {}
  };

  return (
    <AudioSettingsContext.Provider value={{
      outputDevices,
      inputDevices,
      selectedSinkId,
      selectedMicId,
      changeSinkId,
      changeMicId,
      fetchDevices,
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
      micLevel,
      micStatus,
      playClipToSink,
      stopClipToSink,
      routeModePreference: readRouteModePreference(),
    }}>
      {children}
    </AudioSettingsContext.Provider>
  );
};

export const useAudioSettings = () => useContext(AudioSettingsContext);
