import { useState, useRef } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const activeAudioLocalRef = useRef(null);
  const activeAudioSinkRef = useRef(null);
  const { selectedSinkId, localVolume, sinkVolume } = useAudioSettings();

  const stopTTS = () => {
    if (activeAudioLocalRef.current) {
      activeAudioLocalRef.current.pause();
      activeAudioLocalRef.current = null;
    }
    if (activeAudioSinkRef.current) {
      activeAudioSinkRef.current.pause();
      activeAudioSinkRef.current = null;
    }
    window.__CAT_AUDIO_VOL = 0;
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
    
    setIsPlaying(true);
    try {
      let audioUrl = preloadedAudioUrl;
      if (!audioUrl) {
        audioUrl = await prefetchTTS(text, lang);
      }
      if (!audioUrl) {
        // FALLBACK: Browser Speech Synthesis
        console.log("Using browser synthesis fallback...");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
        utterance.rate = 1.1;
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        return;
      }
      
      setPlayingUrl(audioUrl);
      
      // AUDIO DOBLE: Hacemos que el sonido suene en dos lados.
      // Uno para tus OÍDOS (auriculares) y otro para el CABLE VIRTUAL (la llamada).
      const audioLocal = new Audio(audioUrl);
      const audioSink = new Audio(audioUrl);
      
      audioLocal.volume = localVolume;
      audioSink.volume = sinkVolume;

      activeAudioLocalRef.current = audioLocal;
      activeAudioSinkRef.current = audioSink;
      
      // Auto-route it directly into the Virtual Cable!
      if (audioSink.setSinkId && selectedSinkId) {
        try {
          await audioSink.setSinkId(selectedSinkId);
        } catch (e) {
          console.error("setSinkId failed, falling back to default:", e);
        }
      }
      
      const ttsTimer = setInterval(() => {
        if (!activeAudioLocalRef.current) {
          window.__CAT_AUDIO_VOL = 0;
          return clearInterval(ttsTimer);
        }
        window.__CAT_AUDIO_VOL = (40 + Math.random() * 60) * sinkVolume;
      }, 50);

      audioLocal.onended = () => {
        clearInterval(ttsTimer);
        window.__CAT_AUDIO_VOL = 0;
        setIsPlaying(false);
        setPlayingUrl(null);
        activeAudioLocalRef.current = null;
        activeAudioSinkRef.current = null;
      };
      audioSink.onended = () => {};
      
      audioLocal.play().catch(e => {
        clearInterval(ttsTimer);
        window.__CAT_AUDIO_VOL = 0;
        console.error("Local play error:", e);
      });
      if (selectedSinkId) {
        audioSink.play().catch(e => console.error("Sink play error:", e));
      }
    } catch (err) {
      window.__CAT_AUDIO_VOL = 0;
      setIsPlaying(false);
      setPlayingUrl(null);
    }
  };

  return { playTTS, prefetchTTS, stopTTS, isPlaying, playingUrl };
};
