import { useState, useRef } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { bindAudioToSink, primePlaybackElements } from '../utils/audioRoute';
import { readRouteModePreference, ROUTE_MODE } from '../utils/audioRoutePassthrough';
import { logRouteEvent, ROUTE_EVENT } from '../utils/routeDiagnostics';
import { readMicTestMode } from '../utils/micMode';
import { isLocalOnlyPlayback } from '../utils/audioSelfTest';

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const activeAudioLocalRef = useRef(null);
  const activeAudioSinkRef = useRef(null);
  const requestRef = useRef(0);
  const { selectedSinkId, localVolume, sinkVolume, setSinkPlaybackActive, playClipToSink, stopClipToSink } = useAudioSettings();

  const stopTTS = () => {
    requestRef.current += 1;
    if (activeAudioLocalRef.current) {
      activeAudioLocalRef.current.pause();
      activeAudioLocalRef.current = null;
    }
    if (activeAudioSinkRef.current) {
      activeAudioSinkRef.current.pause();
      activeAudioSinkRef.current = null;
    }
    stopClipToSink();
    window.__CAT_AUDIO_VOL = 0;
    setSinkPlaybackActive(false);
    setIsPlaying(false);
    setPlayingUrl(null);
  };

  const prefetchTTS = async (text, lang) => {
    if (!text) return null;
    
    // Inworld TTS disabled temporarily due to 402 Payment Required errors.
    // Returning null to immediately trigger the browser TTS fallback.
    return null;
  };

  const playTTS = async (text, lang, preloadedAudioUrl = null) => {
    if (!text && !preloadedAudioUrl) return;
    
    // Stop any currently playing audio before starting a new one
    stopTTS();
    const request = requestRef.current;
    const isCurrent = () => requestRef.current === request;
    
    setIsPlaying(true);
    const localOnly = isLocalOnlyPlayback(readMicTestMode());

    try {
      let audioUrl = preloadedAudioUrl;
      if (!audioUrl) {
        audioUrl = await prefetchTTS(text, lang);
      }
      if (!isCurrent()) return;
      if (!audioUrl) {
        // FALLBACK: Browser Speech Synthesis — always local speakers
        console.log("Using browser synthesis fallback...");
        logRouteEvent(ROUTE_EVENT.PLAY_START, {
          clipKey: 'tts',
          routeMode: localOnly ? 'local_speakers' : 'speech_synthesis',
          micTestMode: localOnly,
        });
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
        utterance.rate = 1.1;
        utterance.onend = () => { if (isCurrent()) setIsPlaying(false); };
        utterance.onerror = () => { if (isCurrent()) setIsPlaying(false); };
        window.speechSynthesis.speak(utterance);
        return;
      }
      
      setPlayingUrl(audioUrl);
      
      const audioLocal = new Audio(audioUrl);
      primePlaybackElements(audioLocal, null);
      activeAudioLocalRef.current = audioLocal;
      audioLocal.volume = localVolume;
      audioLocal.src = audioUrl;

      if (localOnly) {
        logRouteEvent(ROUTE_EVENT.PLAY_START, {
          clipKey: 'tts',
          routeMode: 'local_speakers',
          micTestMode: true,
        });
        audioLocal.onended = () => {
          if (!isCurrent()) return;
          setIsPlaying(false);
          setPlayingUrl(null);
          activeAudioLocalRef.current = null;
          logRouteEvent(ROUTE_EVENT.PLAY_END, { clipKey: 'tts', micTestMode: true });
        };
        await audioLocal.play();
        return;
      }

      const audioSink = new Audio(audioUrl);
      primePlaybackElements(audioLocal, audioSink);
      activeAudioSinkRef.current = audioSink;

      const routeMode = readRouteModePreference();
      const usePassthrough = selectedSinkId && routeMode === ROUTE_MODE.PASSTHROUGH;
      let sinkViaPassthrough = false;

      logRouteEvent(ROUTE_EVENT.PLAY_START, {
        clipKey: 'tts',
        routeMode: usePassthrough ? ROUTE_MODE.PASSTHROUGH : ROUTE_MODE.DUAL_ELEMENT,
      });

      if (usePassthrough) {
        const resp = await fetch(audioUrl);
        if (!isCurrent()) return;
        const blob = await resp.blob();
        if (!isCurrent()) return;
        const pt = await playClipToSink(blob, sinkVolume, { clipKey: 'tts' });
        if (!isCurrent()) return;
        if (pt.cancelled) {
          // Another player may now own the sink. Clear only this TTS request.
          setIsPlaying(false);
          setPlayingUrl(null);
          activeAudioLocalRef.current = null;
          activeAudioSinkRef.current = null;
          return;
        }
        if (pt.ok) {
          sinkViaPassthrough = true;
        } else {
          logRouteEvent(ROUTE_EVENT.FALLBACK_DUAL, { clipKey: 'tts', reason: pt.reason });
          await bindAudioToSink(audioSink, selectedSinkId);
          if (!isCurrent()) return;
          setSinkPlaybackActive(true);
          audioSink.src = audioUrl;
        }
      } else if (selectedSinkId) {
        await bindAudioToSink(audioSink, selectedSinkId);
        if (!isCurrent()) return;
        setSinkPlaybackActive(true);
        audioSink.src = audioUrl;
      }
      
      const ttsTimer = setInterval(() => {
        if (!isCurrent()) return clearInterval(ttsTimer);
        if (!activeAudioLocalRef.current) {
          window.__CAT_AUDIO_VOL = 0;
          return clearInterval(ttsTimer);
        }
        window.__CAT_AUDIO_VOL = (40 + Math.random() * 60) * sinkVolume;
      }, 50);

      audioLocal.onended = () => {
        clearInterval(ttsTimer);
        if (!isCurrent()) return;
        window.__CAT_AUDIO_VOL = 0;
        stopClipToSink();
        setSinkPlaybackActive(false);
        setIsPlaying(false);
        setPlayingUrl(null);
        activeAudioLocalRef.current = null;
        activeAudioSinkRef.current = null;
      };
      audioSink.onended = () => {};

      audioLocal.play().catch((e) => {
        clearInterval(ttsTimer);
        if (!isCurrent()) return;
        window.__CAT_AUDIO_VOL = 0;
        console.error('Local play error:', e);
      });
      if (selectedSinkId && !sinkViaPassthrough) {
        audioSink.play().catch((e) => console.error('Sink play error:', e));
      }
    } catch (err) {
      if (!isCurrent()) return;
      window.__CAT_AUDIO_VOL = 0;
      setIsPlaying(false);
      setPlayingUrl(null);
    }
  };

  return { playTTS, prefetchTTS, stopTTS, isPlaying, playingUrl };
};
